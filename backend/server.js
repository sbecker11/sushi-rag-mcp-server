import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import menuRoutes from './routes/menu.js';
import ordersRoutes from './routes/orders.js';
import assistantRoutes from './routes/assistant.js';
import pool from './config/database.js';
import vectorStore from './services/vectorStore.js';
import ragService from './services/ragService.js';
import agentService from './services/agentService.js';
import { getMenuFromLLM } from './services/menuService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from parent directory (root of project)
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/assistant', assistantRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize AI services
async function initializeAI() {
  console.log('\n🤖 Initializing AI services...');
  
  try {
    // Initialize vector store
    await vectorStore.initialize();
    
    // Initialize RAG service
    await ragService.initialize();
    
    // Initialize agent service
    await agentService.initialize();
    
    // Index menu in vector database if initialized
    if (vectorStore.isInitialized()) {
      console.log('📊 Fetching menu for indexing...');
      const menu = await getMenuFromLLM();
      await vectorStore.indexMenu(menu);
    }
    
    console.log('✅ AI initialization complete\n');
  } catch (error) {
    console.error('❌ AI initialization failed:', error.message);
    console.log('ℹ️  App will continue without AI features\n');
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   - GET  /api/menu`);
  console.log(`   - GET  /api/orders`);
  console.log(`   - GET  /api/orders/:id`);
  console.log(`   - POST /api/orders`);
  console.log(`   - GET  /api/health`);
  console.log(`   - POST /api/assistant/ask      (RAG Q&A)`);
  console.log(`   - POST /api/assistant/chat     (Agent chat)`);
  console.log(`   - POST /api/assistant/search   (Semantic search)`);
  console.log(`   - GET  /api/assistant/status   (AI status)`);
  
  // Initialize AI services after server starts
  await initializeAI();
});

