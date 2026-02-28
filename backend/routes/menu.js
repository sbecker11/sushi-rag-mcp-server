import express from 'express';
import { getMenuFromLLM } from '../services/menuService.js';

const router = express.Router();

/**
 * GET /api/menu
 * Get menu items from OpenAI LLM
 * Requires OPENAI_API_KEY to be configured
 */
router.get('/', async (req, res) => {
  try {
    const menuItems = await getMenuFromLLM();
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu:', error);
    
    // Return helpful error message if API key is not configured
    if (error.message.includes('OpenAI API key')) {
      res.status(503).json({ 
        error: 'AI features are not configured. Please set up your OpenAI API key.',
        details: 'See docs/04_OPENAI_SETUP.md for setup instructions.'
      });
    } else {
      res.status(500).json({ error: 'Failed to fetch menu' });
    }
  }
});

export default router;

