import { ChromaClient } from 'chromadb';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

class VectorStoreService {
  constructor() {
    this.client = null;
    this.openai = null;
    this.collectionName = 'sushi_menu';
    this.collection = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      console.log('ℹ️  Vector store already initialized');
      return;
    }

    try {
      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
        console.log('⚠️  OpenAI API key not configured - Vector store disabled');
        return;
      }

      // Initialize OpenAI client
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Initialize ChromaDB client
      const chromaHost = process.env.CHROMA_HOST || 'localhost';
      const chromaPort = process.env.CHROMA_PORT || '8000';
      
      this.client = new ChromaClient({
        path: `http://${chromaHost}:${chromaPort}`,
      });

      // Test connection
      await this.client.heartbeat();
      console.log('✅ Connected to ChromaDB');

      // Get or create collection
      try {
        this.collection = await this.client.getCollection({ name: this.collectionName });
        console.log(`✅ Using existing collection: ${this.collectionName}`);
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: { "hnsw:space": "cosine" }
        });
        console.log(`✅ Created new collection: ${this.collectionName}`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Vector store initialization failed:', error.message);
      console.log('ℹ️  App will continue without vector search features');
      this.initialized = false;
    }
  }

  async generateEmbedding(text) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const startTime = Date.now();
    
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
      console.log(`⏱️  OpenAI Embedding Generation: ${Date.now() - startTime}ms`);
    }

    return response.data[0].embedding;
  }

  async indexMenu(menuItems) {
    if (!this.initialized || !this.collection) {
      console.log('⚠️  Vector store not initialized - skipping menu indexing');
      return;
    }

    try {
      const startTime = Date.now();
      console.log(`🔄 Indexing ${menuItems.length} menu items...`);

      const documents = [];
      const embeddings = [];
      const metadatas = [];
      const ids = [];

      for (const item of menuItems) {
        // Create rich text representation for embedding
        const text = `${item.name}. ${item.description}. Price: $${item.price}.${item.ingredients ? ` Ingredients: ${item.ingredients}.` : ''}${item.category ? ` Category: ${item.category}.` : ''}${item.dietary ? ` Dietary: ${item.dietary.join(', ')}.` : ''}${item.spiceLevel ? ` Spice level: ${item.spiceLevel}/3.` : ''}`;
        
        documents.push(text);
        ids.push(`item_${item.id}`);
        
        // Store metadata for retrieval
        metadatas.push({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image || '',
          ingredients: item.ingredients || '',
          category: item.category || '',
          dietary: item.dietary ? item.dietary.join(',') : '',
          spiceLevel: item.spiceLevel || 0
        });

        // Generate embedding
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
      }

      // Clear existing items
      try {
        const existingCount = await this.collection.count();
        if (existingCount > 0) {
          await this.client.deleteCollection({ name: this.collectionName });
          this.collection = await this.client.createCollection({
            name: this.collectionName,
            metadata: { "hnsw:space": "cosine" }
          });
          console.log('🗑️  Cleared existing items from collection');
        }
      } catch (error) {
        // Collection might not exist yet
      }

      // Add to ChromaDB
      await this.collection.add({
        ids,
        embeddings,
        documents,
        metadatas
      });

      if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
        console.log(`⏱️  Menu Indexing: ${Date.now() - startTime}ms`);
      }
      console.log(`✅ Indexed ${menuItems.length} menu items in vector database`);
    } catch (error) {
      console.error('❌ Error indexing menu:', error.message);
      throw error;
    }
  }

  async semanticSearch(query, numResults = 5) {
    if (!this.initialized || !this.collection) {
      console.log('⚠️  Vector store not initialized - returning empty results');
      return [];
    }

    try {
      const startTime = Date.now();

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Search in ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: numResults,
      });

      if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
        console.log(`⏱️  Semantic Search: ${Date.now() - startTime}ms`);
      }

      // Transform results
      const items = [];
      if (results.metadatas && results.metadatas[0]) {
        for (let i = 0; i < results.metadatas[0].length; i++) {
          const metadata = results.metadatas[0][i];
          const distance = results.distances[0][i];
          
          items.push({
            id: metadata.id,
            name: metadata.name,
            description: metadata.description,
            price: metadata.price,
            image: metadata.image,
            ingredients: metadata.ingredients,
            category: metadata.category,
            dietary: metadata.dietary ? metadata.dietary.split(',').filter(d => d) : [],
            spiceLevel: metadata.spiceLevel,
            similarity: 1 - distance // Convert distance to similarity score
          });
        }
      }

      console.log(`🔍 Found ${items.length} results for: "${query}"`);
      return items;
    } catch (error) {
      console.error('❌ Error in semantic search:', error.message);
      return [];
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

// Create singleton instance
const vectorStore = new VectorStoreService();

export default vectorStore;

