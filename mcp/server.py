"""
Sushi RAG MCP Server
====================
Exposes the Sushi RAG knowledge base as MCP tools callable by any
MCP-compatible client (Claude Desktop, custom agents, etc.).

Stack: FastMCP · LangChain 1.x (LCEL) · ChromaDB · OpenAI embeddings
Transport: stdio (local) or streamable HTTP (remote)

Usage:
    python server.py                    # stdio (Claude Desktop)
    python server.py --http             # HTTP on port 8000
"""

import json
import os
import argparse
from contextlib import asynccontextmanager
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict
from mcp.server.fastmcp import FastMCP, Context

# LangChain 1.x LCEL imports (no langchain.chains)
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
# CHROMA_COLLECTION  = os.getenv("CHROMA_COLLECTION", "sushi_knowledge")

CHROMA_HOST       = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT       = int(os.getenv("CHROMA_PORT", "8000"))
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "sushi_menu")

OPENAI_MODEL       = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
EMBEDDING_MODEL    = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
DEFAULT_K_DOCS     = 4
MAX_K_DOCS         = 10

RAG_SYSTEM_PROMPT = (
    "You are a knowledgeable sushi chef and expert. "
    "Use the following retrieved context to answer the question accurately. "
    "If you are unsure or the context doesn't cover the question, say so clearly.\n\n"
    "{context}"
)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def _format_docs(docs: list) -> str:
    """Concatenate page content for LCEL context injection."""
    return "\n\n".join(doc.page_content for doc in docs)


def _build_chain(vectorstore: Chroma, llm: ChatOpenAI, k: int):
    """Build a fresh LCEL RAG chain with the given k."""
    retriever = vectorstore.as_retriever(search_kwargs={"k": k})
    prompt = ChatPromptTemplate.from_messages([
        ("system", RAG_SYSTEM_PROMPT),
        ("human", "{question}"),
    ])
    return (
        {"context": retriever | _format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )


class ResponseFormat(str, Enum):
    MARKDOWN = "markdown"
    JSON = "json"


def _format_sources(source_docs: list, fmt: ResponseFormat) -> str:
    """Format retrieved source documents for inclusion in a response."""
    if not source_docs:
        return ""
    if fmt == ResponseFormat.JSON:
        return json.dumps(
            [{"content": doc.page_content, "metadata": doc.metadata} for doc in source_docs],
            indent=2,
        )
    lines = ["\n\n---\n**Sources retrieved:**"]
    for i, doc in enumerate(source_docs, 1):
        meta = doc.metadata
        source_label = meta.get("source", meta.get("title", f"Document {i}"))
        lines.append(f"\n**{i}. {source_label}**\n{doc.page_content[:300]}…")
    return "\n".join(lines)


def _handle_error(e: Exception) -> str:
    """Return a clear, actionable error message."""
    if "OPENAI_API_KEY" in str(e):
        return "Error: OPENAI_API_KEY is not set. Export it before starting the server."
    if "does not exist" in str(e).lower() or "no such" in str(e).lower():
        return (
            "Error: ChromaDB collection not found. "
            f"Run the ingestion script to populate '{CHROMA_COLLECTION}' first."
        )
    return f"Error: {type(e).__name__}: {e}"


# ---------------------------------------------------------------------------
# Lifespan — initialise shared resources once at startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def app_lifespan(app):

    import chromadb

    """Initialise LangChain / Chroma resources shared across all tool calls."""

    # embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    # vectorstore = Chroma(
    #     persist_directory=CHROMA_PERSIST_DIR,
    #     collection_name=CHROMA_COLLECTION,
    #     embedding_function=embeddings,
    # )

    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    http_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    vectorstore = Chroma(
        client=http_client,
        collection_name=CHROMA_COLLECTION,
        embedding_function=embeddings,
    )

    llm = ChatOpenAI(model=OPENAI_MODEL, temperature=0.2)
    # Build default chain at startup
    qa_chain = _build_chain(vectorstore, llm, DEFAULT_K_DOCS)

    yield {
        "vectorstore": vectorstore,
        "qa_chain": qa_chain,
        "llm": llm,
    }


# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------
mcp = FastMCP("sushi_rag_mcp", lifespan=app_lifespan)


# ---------------------------------------------------------------------------
# Tool: sushi_rag_query
# ---------------------------------------------------------------------------
class SushiQueryInput(BaseModel):
    """Input for sushi_rag_query."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    question: str = Field(
        ...,
        description="Natural language question about sushi (e.g. 'What fish is safe for nigiri?')",
        min_length=3,
        max_length=500,
    )
    k_docs: Optional[int] = Field(
        default=DEFAULT_K_DOCS,
        description=f"Number of context documents to retrieve (1-{MAX_K_DOCS})",
        ge=1,
        le=MAX_K_DOCS,
    )
    include_sources: Optional[bool] = Field(
        default=True,
        description="Whether to include the source passages used to generate the answer",
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' (human-readable) or 'json' (structured)",
    )


@mcp.tool(
    name="sushi_rag_query",
    annotations={
        "title": "Ask the Sushi Knowledge Base",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sushi_rag_query(params: SushiQueryInput, ctx: Context) -> str:
    """Answer any question about sushi using the RAG knowledge base.

    Performs semantic retrieval over the Chroma vector store and generates
    a grounded answer via the configured LLM.

    Args:
        params (SushiQueryInput): Validated query parameters including:
            - question (str): Natural language question
            - k_docs (int): Number of context chunks to retrieve
            - include_sources (bool): Append source passages to answer
            - response_format (ResponseFormat): 'markdown' or 'json'

    Returns:
        str: Answer with optional source passages, in the requested format.
             JSON format: {"question": str, "answer": str, "sources": [...]}
    """
    await ctx.report_progress(0.1, "Retrieving relevant documents...")

    try:
        vectorstore = ctx.request_context.lifespan_context["vectorstore"]
        llm         = ctx.request_context.lifespan_context["llm"]

        # Rebuild chain only if k_docs differs from default
        if params.k_docs != DEFAULT_K_DOCS:
            chain = _build_chain(vectorstore, llm, params.k_docs)
        else:
            chain = ctx.request_context.lifespan_context["qa_chain"]

        await ctx.report_progress(0.4, "Generating answer...")
        answer = await chain.ainvoke(params.question)

        # Fetch source docs separately if requested
        source_docs = []
        if params.include_sources:
            source_docs = vectorstore.similarity_search(params.question, k=params.k_docs)

        await ctx.report_progress(1.0, "Done")

        if params.response_format == ResponseFormat.JSON:
            return json.dumps({
                "question": params.question,
                "answer": answer,
                "sources": (
                    [{"content": d.page_content, "metadata": d.metadata} for d in source_docs]
                    if params.include_sources else []
                ),
            }, indent=2)

        output = f"**Answer:**\n\n{answer}"
        if params.include_sources:
            output += _format_sources(source_docs, params.response_format)
        return output

    except Exception as e:
        ctx.error(f"sushi_rag_query failed: {e}")
        return _handle_error(e)


# ---------------------------------------------------------------------------
# Tool: sushi_semantic_search
# ---------------------------------------------------------------------------
class SushiSearchInput(BaseModel):
    """Input for sushi_semantic_search."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str = Field(
        ...,
        description="Keyword or phrase to search the knowledge base (e.g. 'umami', 'knife technique')",
        min_length=2,
        max_length=300,
    )
    k: Optional[int] = Field(
        default=5,
        description="Number of results to return (1-10)",
        ge=1,
        le=10,
    )
    score_threshold: Optional[float] = Field(
        default=None,
        description="Minimum similarity score (0.0-1.0). Omit to return top-k regardless of score.",
        ge=0.0,
        le=1.0,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' or 'json'",
    )


@mcp.tool(
    name="sushi_semantic_search",
    annotations={
        "title": "Semantic Search — Sushi Knowledge Base",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sushi_semantic_search(params: SushiSearchInput, ctx: Context) -> str:
    """Search the sushi knowledge base by semantic similarity without LLM synthesis.

    Useful when you want to browse raw passages rather than a generated answer.
    Returns ranked chunks with similarity scores.

    Args:
        params (SushiSearchInput): Search parameters including:
            - query (str): Search phrase
            - k (int): Number of results
            - score_threshold (float | None): Optional minimum score filter
            - response_format (ResponseFormat): Output format

    Returns:
        str: Ranked passages with similarity scores in the requested format.
             JSON format: [{"rank": int, "score": float, "content": str, "metadata": dict}]
    """
    await ctx.report_progress(0.2, "Running semantic search...")

    try:
        vectorstore: Chroma = ctx.request_context.lifespan_context["vectorstore"]

        docs_and_scores = vectorstore.similarity_search_with_relevance_scores(
            params.query, k=params.k
        )

        if params.score_threshold is not None:
            docs_and_scores = [
                (doc, score) for doc, score in docs_and_scores
                if score >= params.score_threshold
            ]

        await ctx.report_progress(1.0, "Done")

        if not docs_and_scores:
            return f"No results found for query: '{params.query}'"

        if params.response_format == ResponseFormat.JSON:
            return json.dumps([
                {
                    "rank": i + 1,
                    "score": round(score, 4),
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                }
                for i, (doc, score) in enumerate(docs_and_scores)
            ], indent=2)

        lines = [f"**Semantic search results for:** `{params.query}`\n"]
        for i, (doc, score) in enumerate(docs_and_scores, 1):
            meta = doc.metadata
            source = meta.get("source", meta.get("title", "Unknown source"))
            lines.append(f"**{i}. {source}** _(score: {score:.3f})_\n{doc.page_content}\n")
        return "\n".join(lines)

    except Exception as e:
        ctx.error(f"sushi_semantic_search failed: {e}")
        return _handle_error(e)


# ---------------------------------------------------------------------------
# Tool: sushi_list_topics
# ---------------------------------------------------------------------------
class ListTopicsInput(BaseModel):
    """Input for sushi_list_topics."""
    model_config = ConfigDict(extra="forbid")

    limit: Optional[int] = Field(
        default=20,
        description="Maximum number of unique metadata topics to return (1-100)",
        ge=1,
        le=100,
    )


@mcp.tool(
    name="sushi_list_topics",
    annotations={
        "title": "List Knowledge Base Topics",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def sushi_list_topics(params: ListTopicsInput, ctx: Context) -> str:
    """List the unique topics and sources indexed in the sushi knowledge base.

    Useful for understanding what the knowledge base covers before querying.

    Args:
        params (ListTopicsInput): Parameters including:
            - limit (int): Max number of unique topics to return

    Returns:
        str: JSON object with total count and list of unique topic/source labels.
    """
    try:
        vectorstore: Chroma = ctx.request_context.lifespan_context["vectorstore"]
        collection = vectorstore._collection
        results = collection.get(include=["metadatas"])

        topics: set = set()
        for meta in results.get("metadatas", []):
            label = meta.get("source") or meta.get("title") or meta.get("topic")
            if label:
                topics.add(label)

        sorted_topics = sorted(topics)[:params.limit]
        return json.dumps({
            "total_unique_topics": len(topics),
            "returned": len(sorted_topics),
            "topics": sorted_topics,
        }, indent=2)

    except Exception as e:
        ctx.error(f"sushi_list_topics failed: {e}")
        return _handle_error(e)


# ---------------------------------------------------------------------------
# MCP Resource: collection stats
# ---------------------------------------------------------------------------
@mcp.resource("sushi://knowledge-base/stats")
async def get_kb_stats() -> str:
    """Return basic statistics about the sushi knowledge base collection."""
    try:
        http_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        vectorstore = Chroma(
            client=http_client,
            collection_name=CHROMA_COLLECTION,
            embedding_function=OpenAIEmbeddings(model=EMBEDDING_MODEL),
        )
        count = vectorstore._collection.count()
        return json.dumps({
            "collection": CHROMA_COLLECTION,
            "chroma_host": CHROMA_HOST,
            "chroma_port": CHROMA_PORT,
            "document_chunks": count,
        }, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sushi RAG MCP Server")
    parser.add_argument("--http", action="store_true", help="Run as HTTP server instead of stdio")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port (default 8000)")
    args = parser.parse_args()

    if args.http:
        print(f"Starting Sushi RAG MCP Server (HTTP) on port {args.port}...")
        import uvicorn
        from starlette.middleware.cors import CORSMiddleware
        app = mcp.streamable_http_app()
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )
        uvicorn.run(app, host="0.0.0.0", port=args.port)
    else:
        print("Starting Sushi RAG MCP Server (stdio)...")
        mcp.run()

