# Sushi RAG MCP Server

Exposes the Sushi RAG knowledge base (LangChain + ChromaDB) as MCP tools 
callable by Claude Desktop, custom agents, or any MCP-compatible client.

## Tools

| Tool | Description |
|------|-------------|
| `sushi_rag_query` | Ask a natural language question — retrieves context and generates a grounded answer |
| `sushi_semantic_search` | Raw vector search returning ranked passages with similarity scores |
| `sushi_list_topics` | List unique topics/sources indexed in the knowledge base |

## Resource

`sushi://knowledge-base/stats` — Returns collection size and config metadata.

---

## Setup

### 1. go to the `mcp` folder

```bash
cd /Users/sbecker11/workspace-sushi/sushi-rag-mcp-server/mcp
```
### 2. activate the venv

```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set environment variables

```bash
export OPENAI_API_KEY=sk-...
export CHROMA_PERSIST_DIR=/Users/sbecker11/workspace-sushi/sushi-rag-mcp-server/chroma_db     # path to your existing ChromaDB
export CHROMA_COLLECTION=sushi_knowledge   # collection name used during ingestion
export OPENAI_MODEL=gpt-4o-mini
export EMBEDDING_MODEL=text-embedding-3-small
```

### 5. Run the server

**stdio mode** (for Claude Desktop):
```bash
python server.py
```

**HTTP mode** (for remote agents / testing):
```bash
python server.py --http --port 8000
```

---

## Claude Desktop Integration

Merge the contents of `claude_desktop_config.json` into your Claude Desktop 
config file (usually `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "sushi-rag": {
      "command": "python",
      "args": ["/absolute/path/to/server.py"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "CHROMA_PERSIST_DIR": "/absolute/path/to/chroma_db"
      }
    }
  }
}
```

Restart Claude Desktop — you'll see `sushi-rag` listed as a connected tool.

---

## Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector python server.py
```

Opens a browser-based UI to call tools interactively and inspect responses.

---

## Example Tool Calls

````python
# From any MCP client — these map directly to the registered tools:

# 1. Full RAG answer
sushi_rag_query(question="What is the difference between nigiri and maki?")

# 2. Raw semantic search
sushi_semantic_search(query="knife sharpening techniques", k=5)

# 3. Browse the knowledge base
sushi_list_topics(limit=30)
```
