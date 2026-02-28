# AI Agent and Tools

This document explains how the multi-tool AI agent works, how semantic search and tools interact, and design choices for filters and future tools.

---

## Multi-tool AI agent

### What it is

The **multi-tool AI agent** (see README feature: “Multi-tool AI agent - autonomous tool selection for complex queries”) is the agentic part of the assistant: the LLM **chooses which tools to call and in what order** instead of following a fixed pipeline.

- **Multiple tools** – Each tool has a name, description, and schema (e.g. `search_menu`, `filter_by_price`, `get_item_details`). The model sees these and decides when to use each one.
- **Autonomous tool selection** – For a query like “Show me spicy vegetarian options under $15”, the model might call `search_menu("spicy vegetarian")` then `filter_by_price({ max: 15 })`, or a different order. There is no hard-coded “always search first, then filter.”
- **Multi-step reasoning** – The agent can chain tools (e.g. search → filter → get details) until it has enough information to answer.

Implementation: **`backend/services/agentService.js`** – LangChain 1.x `createAgent` with `model`, `tools`, and `systemPrompt`.

### Activating the agent

1. Set **`OPENAI_API_KEY`** in `.env`.
2. Start backend and frontend; the backend initializes the agent on startup.
3. The frontend uses **`POST /api/assistant/chat`** when `agent` is available (from `GET /api/assistant/status`); otherwise it falls back to **`POST /api/assistant/ask`** (RAG).

### Tool order for complex queries

The **order of tool use is not fixed**. The LLM decides each time based on:

- The user’s question
- Tool descriptions (when to use each tool)
- Results of previous tool calls when chaining

So for “Show me spicy vegetarian options under $15”, the model could do price first then search, or search then filter, or multiple searches then filter. The app does not enforce a specific order.

---

## Price filter: inclusive vs exclusive bounds

### Where it’s defined

**File:** `backend/services/agentService.js`  
**Tool:** `filter_by_price`

- **Behavior (what runs):** In the tool’s `async` function:
  - **Lower bound:** `filtered.filter(item => item.price >= min)` → **inclusive** (price ≥ min).
  - **Upper bound:** `filtered.filter(item => item.price < max)` → **exclusive** (price < max).
- **Documentation:** Same file – tool `description` and schema `.describe()` for `min` and `max` state that the lower bound is inclusive and the upper bound is exclusive: **min ≤ price < max**.

### Interpreting “max”

- **Exclusive upper bound (current):** `max: 10` means “price < 10” (e.g. “under $10” → use `max: 10`).
- **Inclusive upper bound:** Would mean “price ≤ 10”; that would require `item.price <= max` in code.

### Phrasings

The tool description and schema tell the model how to map natural language to parameters, e.g.:

- “price < 10”, “under $10” → `max: 10`
- “price ≥ 10 and price < 15” → `min: 10`, `max: 15`
- “price ≥ 15 and price < 20” → `min: 15`, `max: 20`
- “price ≥ 20” → `min: 20` (no max)

Schema descriptions explicitly say: min is “inclusive (items with price >= this value)”, max is “exclusive (items with price < this value)”.

---

## Which tool finds spicy items?

**Tool:** `search_menu`

The agent uses **`search_menu`** with a query like `"spicy"` or `"spicy rolls"`. That tool calls **`vectorStore.semanticSearch(query, 5)`**, which uses the vector store (ChromaDB) to return menu items whose embeddings are closest to the query. So “spicy”, “hot”, and spicy item descriptions end up close in vector space and get returned. Semantic similarity is used **inside** this tool.

---

## How does ChromaDB “know” that “spicy” and “hot” are similar?

**ChromaDB does not know semantics.** It only:

- Stores **vectors** (embeddings) for each menu item
- Accepts a **query vector** and returns stored vectors that are **closest** (e.g. cosine similarity)

The **semantic** part comes from the **embedding model**:

- In **`backend/services/vectorStore.js`**, **`generateEmbedding(text)`** calls **OpenAI `text-embedding-3-small`**.
- That model turns text (e.g. “spicy”, “hot”, or a menu description) into a fixed-length vector.
- It was trained so that **semantically similar text gets similar vectors**. So “spicy” and “hot” (in the food sense) are close in vector space.
- ChromaDB only does nearest-neighbor search on those vectors; the embedding model is what encodes meaning.

**Summary:** The embedding model gives “spicy” and “hot” similar vectors; ChromaDB just finds nearest vectors. Same model is used when indexing menu items and when searching.

---

## When is semantic similarity used?

| Tool               | Uses semantic similarity? | How |
|--------------------|---------------------------|-----|
| **search_menu**    | Yes                       | `vectorStore.semanticSearch(query, 5)` – query is the user’s phrase (e.g. “spicy”, “vegetarian”). |
| **get_item_details** | Yes                    | `vectorStore.semanticSearch(itemName, 1)` – finds best-matching item by name. |
| **filter_by_price** | Only generically         | `vectorStore.semanticSearch('menu items', 20)` to get a set of items, then filters by `price >= min` and `price < max`. No semantic matching of “under $15”; the agent maps that to numeric min/max. |

So: **semantic similarity** is used when the agent calls **search_menu** (user intent) or **get_item_details** (item name). **filter_by_price** uses numeric comparison; the agent chooses when to call it and with which numbers.

---

## Other tools besides price

Possible additions (not all implemented):

### Structured filters (like price)

- **filter_by_category** – e.g. rolls, nigiri, appetizers
- **filter_by_dietary** – vegetarian, vegan, gluten-free
- **filter_by_spice_level** – e.g. 1–3 or mild/medium/hot

### Discovery

- **list_categories** – return distinct categories (“what types do you have?”)
- **get_similar_items** – “what’s similar to X?” via semantic search

### Ordering / ranking

- **sort_by_price** – sort results by price (asc/desc)
- **top_cheapest** / **top_priciest** – e.g. “top 5 cheapest”

### Popularity

- **Option A (order data):** Tool that queries **PostgreSQL `order_items`** (e.g. `SUM(quantity)` per `item_name`), returns top N or items above a threshold. Real, dynamic popularity.
- **Option B (static):** Add a “popular” or “bestseller” field to menu items and to vector store metadata; add **filter_by_popular** that returns only items where that flag is true.

Current code has no popularity field on menu items; **Option A** uses existing order data.

---

*This document summarizes design and Q&A about the AI agent, tools, semantic search, and filters. Implementation lives in `backend/services/agentService.js` and `backend/services/vectorStore.js`.*
