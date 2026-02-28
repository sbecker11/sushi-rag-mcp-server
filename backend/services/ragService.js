import OpenAI from 'openai';
import vectorStore from './vectorStore.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

class RAGService {
  constructor() {
    this.openai = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
        console.log('⚠️  OpenAI API key not configured - RAG disabled');
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      this.initialized = true;
      console.log('✅ RAG service initialized');
    } catch (error) {
      console.error('❌ RAG service initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async ask(question) {
    if (!this.initialized || !this.openai) {
      return {
        answer: 'Sorry, the AI assistant is not available at the moment.',
        sources: []
      };
    }

    if (!vectorStore.isInitialized()) {
      return {
        answer: 'Sorry, the menu database is not available. Please try again later.',
        sources: []
      };
    }

    try {
      const startTime = Date.now();
      console.log(`🤖 RAG Question: "${question}"`);

      // Step 1: Retrieve relevant context from vector store
      const retrievalStart = Date.now();
      const relevantItems = await vectorStore.semanticSearch(question, 5);
      
      if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
        console.log(`⏱️  RAG Context Retrieval: ${Date.now() - retrievalStart}ms`);
      }

      if (relevantItems.length === 0) {
        return {
          answer: "I couldn't find any menu items matching your question. Could you try rephrasing or ask about something else?",
          sources: []
        };
      }

      // Step 2: Build context from retrieved items
      const context = relevantItems.map((item, index) => {
        return `${index + 1}. ${item.name} - $${item.price}
Description: ${item.description}${item.ingredients ? `
Ingredients: ${item.ingredients}` : ''}${item.category ? `
Category: ${item.category}` : ''}${item.dietary && item.dietary.length > 0 ? `
Dietary: ${item.dietary.join(', ')}` : ''}${item.spiceLevel ? `
Spice Level: ${item.spiceLevel}/3` : ''}`;
      }).join('\n\n');

      // Step 3: Create prompt with context
      const systemPrompt = `You are a helpful assistant for a sushi restaurant. Your FOCUS IS EXCLUSIVELY ON THE MENU - answer questions about menu items using ONLY the provided menu data. Be friendly and concise.

CRITICAL RESTRICTIONS - YOUR SCOPE IS MENU ONLY:
- You CANNOT access user orders at all
- You CANNOT add, remove, or modify items in user orders
- You CANNOT calculate order totals or prices
- You CANNOT access user cart data or see what items are in the user's cart
- You CANNOT provide restaurant hours, location, contact information, or operational details
- NEVER claim to have added items to the cart
- NEVER claim to know what's in the user's order unless they explicitly tell you

YOUR ROLE IS MENU INFORMATION ONLY:
- Provide information about menu items from the menu
- Answer questions about ingredients, descriptions, categories, dietary info
- Make recommendations based on menu data
- Clarify what's spicy, vegetarian, vegan, etc. on the menu

If a user asks you to add items to their cart, explain: "I focus only on menu information. I cannot add items to your cart. Please browse the menu and add items directly using the '+ Add to Cart' buttons."

If a user asks about their order total or what's in their cart, explain: "I don't have access to your order or cart - I can only help with menu questions. You can view your cart and total by clicking the cart icon in the navigation."

If a user asks about restaurant hours, location, contact info, or other operational details, explain: "I can only help with menu items. For restaurant information like hours or location, please check the website footer or contact the restaurant directly."

If the user asks about items not in the context, politely say you don't have that information.

Menu Items:
${context}`;

      const userPrompt = question;

      // Step 4: Generate answer with LLM
      const generationStart = Date.now();
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
        console.log(`⏱️  RAG LLM Generation: ${Date.now() - generationStart}ms`);
        console.log(`⏱️  RAG Total Time: ${Date.now() - startTime}ms`);
      }

      const answer = response.choices[0].message.content;

      console.log(`✅ RAG Answer generated (${relevantItems.length} sources)`);

      return {
        answer,
        sources: relevantItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          similarity: Math.round(item.similarity * 100) / 100
        }))
      };
    } catch (error) {
      console.error('❌ RAG error:', error.message);
      return {
        answer: 'Sorry, I encountered an error while processing your question. Please try again.',
        sources: []
      };
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

// Create singleton instance
const ragService = new RAGService();

export default ragService;

