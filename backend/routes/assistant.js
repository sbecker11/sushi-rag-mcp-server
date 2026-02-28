import express from 'express';
import ragService from '../services/ragService.js';
import agentService from '../services/agentService.js';
import vectorStore from '../services/vectorStore.js';

const router = express.Router();

/**
 * POST /api/assistant/ask
 * Simple RAG question answering
 * Body: { question: string }
 */
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!ragService.isInitialized()) {
      return res.status(503).json({ 
        error: 'AI assistant not available',
        message: 'Please check that OpenAI API key is configured'
      });
    }

    const result = await ragService.ask(question);
    res.json(result);
  } catch (error) {
    console.error('Error in /ask endpoint:', error);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

/**
 * POST /api/assistant/chat
 * Agent-based chat with tool usage
 * Body: { message: string, history: array (optional) }
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!agentService.isInitialized()) {
      return res.status(503).json({ 
        error: 'AI assistant not available',
        message: 'Please check that OpenAI API key is configured'
      });
    }

    const result = await agentService.chat(message, history);
    res.json(result);
  } catch (error) {
    console.error('Error in /chat endpoint:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

/**
 * POST /api/assistant/search
 * Semantic search endpoint
 * Body: { query: string, limit: number (optional) }
 */
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!vectorStore.isInitialized()) {
      return res.status(503).json({ 
        error: 'Search not available',
        message: 'Vector database not initialized'
      });
    }

    const results = await vectorStore.semanticSearch(query, limit);
    res.json({ results });
  } catch (error) {
    console.error('Error in /search endpoint:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/assistant/status
 * Check AI services status
 */
router.get('/status', (req, res) => {
  res.json({
    vectorStore: vectorStore.isInitialized(),
    rag: ragService.isInitialized(),
    agent: agentService.isInitialized()
  });
});

export default router;

