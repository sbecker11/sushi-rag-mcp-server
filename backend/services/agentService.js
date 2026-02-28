import { ChatOpenAI } from '@langchain/openai';
import { createAgent, tool, HumanMessage, AIMessage } from 'langchain';
import { z } from 'zod';
import vectorStore from './vectorStore.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '..', '.env') });

class AgentService {
  constructor() {
    this.llm = null;
    this.agent = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      console.log('ℹ️  Agent service already initialized.');
      return;
    }

    try {
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
        console.log('⚠️  OpenAI API key not configured - Agent disabled');
        return;
      }

      this.llm = new ChatOpenAI({
        modelName: 'gpt-4',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY
      });

      const tools = this.createTools();

      this.agent = createAgent({
        model: this.llm,
        tools,
        systemPrompt: `You are a helpful assistant for a sushi restaurant. You help customers find menu items, answer questions about the menu, and make recommendations.

Be friendly, concise, and helpful. Use the available tools to answer questions accurately.

If you can't find what the user is looking for, politely suggest alternatives.`
      });

      this.initialized = true;
      console.log('✅ Agent service initialized with', tools.length, 'tools');
    } catch (error) {
      console.error('❌ Agent initialization failed:', error.message);
      this.initialized = false;
    }
  }

  createTools() {
    return [
      tool(
        async ({ query }) => {
          try {
            console.log(`🔧 Tool: search_menu("${query}")`);
            if (!vectorStore.isInitialized()) {
              return JSON.stringify({ error: 'Menu database not available' });
            }
            const results = await vectorStore.semanticSearch(query, 5);
            if (results.length === 0) {
              return JSON.stringify({ message: 'No items found matching your criteria' });
            }
            return JSON.stringify(results.map(r => ({
              id: r.id,
              name: r.name,
              description: r.description,
              price: r.price,
              category: r.category,
              dietary: r.dietary,
              spiceLevel: r.spiceLevel
            })));
          } catch (error) {
            console.error('Error in search_menu tool:', error);
            return JSON.stringify({ error: 'Search failed' });
          }
        },
        {
          name: 'search_menu',
          description: 'Search for menu items semantically using natural language. Use this when users ask for types of food, flavors, dietary preferences, or general menu exploration. Input should be a search query like "spicy rolls", "vegetarian options", or "appetizers".',
          schema: z.object({
            query: z.string().describe('The semantic search query (e.g. spicy rolls, vegetarian, appetizers)')
          })
        }
      ),
      tool(
        async ({ min, max }) => {
          try {
            console.log(`🔧 Tool: filter_by_price(min=${min}, max=${max})`);
            if (!vectorStore.isInitialized()) {
              return JSON.stringify({ error: 'Menu database not available' });
            }
            const allItems = await vectorStore.semanticSearch('menu items', 20);
            let filtered = allItems;
            if (min !== undefined) {
              filtered = filtered.filter(item => item.price >= min);  // inclusive lower bound
            }
            if (max !== undefined) {
              filtered = filtered.filter(item => item.price < max); // exclusive upper bound
            }
            if (filtered.length === 0) {
              return JSON.stringify({ message: 'No items found in that price range' });
            }
            return JSON.stringify(filtered.map(r => ({
              id: r.id,
              name: r.name,
              description: r.description,
              price: r.price
            })));
          } catch (error) {
            console.error('Error in filter_by_price tool:', error);
            return JSON.stringify({ error: 'Price filtering failed' });
          }
        },
        {
          name: 'filter_by_price',
          description: 'Filter menu items by price range. Lower bound is inclusive, upper bound is exclusive: items where min <= price < max. Use when users ask: "price < 10", "price >= 10 and price < 15", "price >= 15 and price < 20", "price >= 20", or "affordable options". For "under $10" use max: 10; for "at least $20" use min: 20.',
          schema: z.object({
            min: z.number().optional().describe('Minimum price in dollars (inclusive: items with price >= this value)'),
            max: z.number().optional().describe('Maximum price in dollars (exclusive: items with price < this value)')
          })
        }
      ),
      tool(
        async ({ itemName }) => {
          try {
            console.log(`🔧 Tool: get_item_details("${itemName}")`);
            if (!vectorStore.isInitialized()) {
              return JSON.stringify({ error: 'Menu database not available' });
            }
            const results = await vectorStore.semanticSearch(itemName, 1);
            if (results.length === 0) {
              return JSON.stringify({ message: 'Item not found' });
            }
            const item = results[0];
            return JSON.stringify({
              id: item.id,
              name: item.name,
              description: item.description,
              price: item.price,
              ingredients: item.ingredients,
              category: item.category,
              dietary: item.dietary,
              spiceLevel: item.spiceLevel,
              image: item.image
            });
          } catch (error) {
            console.error('Error in get_item_details tool:', error);
            return JSON.stringify({ error: 'Failed to get item details' });
          }
        },
        {
          name: 'get_item_details',
          description: 'Get detailed information about a specific menu item by name. Use when users ask about ingredients, preparation, or specific details about a dish. Input should be the item name.',
          schema: z.object({
            itemName: z.string().describe('The name of the menu item')
          })
        }
      )
    ];
  }

  _historyToMessages(chatHistory) {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
      return [];
    }
    return chatHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => (m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)));
  }

  _extractResponseAndTools(result) {
    const messages = result.messages || [];
    let response = '';
    const toolsUsed = [];

    for (const msg of messages) {
      const type = msg._getType?.() ?? msg.constructor?.name ?? '';
      if (type === 'ai' || type === 'AIMessage') {
        const content = typeof msg.content === 'string' ? msg.content : (msg.content?.[0]?.text ?? msg.content?.[0] ?? '');
        if (content) response = content;
        const toolCalls = msg.tool_calls ?? msg.additional_kwargs?.tool_calls ?? [];
        for (const tc of toolCalls) {
          const name = typeof tc === 'object' ? (tc.name ?? tc.function?.name) : tc;
          const args = typeof tc === 'object' ? (tc.args ?? (tc.function?.arguments ? JSON.parse(tc.function.arguments) : {})) : {};
          if (name) toolsUsed.push({ tool: name, input: args });
        }
      }
    }

    return { response: response || 'I couldn\'t generate a response.', toolsUsed };
  }

  async chat(message, chatHistory = []) {
    if (!this.initialized || !this.agent) {
      return {
        response: 'Sorry, the AI assistant is not available at the moment.',
        toolsUsed: []
      };
    }

    try {
      const startTime = Date.now();
      console.log(`🤖 Agent Chat: "${message}"`);

      const historyMessages = this._historyToMessages(chatHistory);
      const inputMessages = [...historyMessages, new HumanMessage(message)];

      const result = await this.agent.invoke({ messages: inputMessages });

      if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
        console.log(`⏱️  Agent Total Time: ${Date.now() - startTime}ms`);
      }

      const { response, toolsUsed } = this._extractResponseAndTools(result);

      console.log(`✅ Agent response generated (used ${toolsUsed.length} tools)`);

      return { response, toolsUsed };
    } catch (error) {
      console.error('❌ Agent error:', error.message);
      return {
        response: 'Sorry, I encountered an error while processing your request. Please try again.',
        toolsUsed: []
      };
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

const agentService = new AgentService();
export default agentService;
