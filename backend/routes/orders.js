import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Helper function to log performance metrics if enabled
const logPerformance = (message) => {
  if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
    console.log(message);
  }
};

/**
 * GET /api/orders
 * Get all orders with their items
 */
router.get('/', async (req, res) => {
  try {
    // Fetch all orders with timing
    const ordersStart = Date.now();
    const ordersResult = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    logPerformance(`⏱️  PostgreSQL: Fetch all orders - ${Date.now() - ordersStart}ms`);
    
    // Get items for each order
    const itemsStart = Date.now();
    const orders = await Promise.all(
      ordersResult.rows.map(async (order) => {
        const itemsResult = await pool.query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [order.id]
        );
        return {
          ...order,
          items: itemsResult.rows
        };
      })
    );
    logPerformance(`⏱️  PostgreSQL: Fetch items for ${ordersResult.rows.length} orders - ${Date.now() - itemsStart}ms`);
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/orders/:id
 * Get a specific order with its items
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch specific order with timing
    const orderStart = Date.now();
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    logPerformance(`⏱️  PostgreSQL: Fetch order by ID - ${Date.now() - orderStart}ms`);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Fetch order items with timing
    const itemsStart = Date.now();
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );
    logPerformance(`⏱️  PostgreSQL: Fetch order items - ${Date.now() - itemsStart}ms`);
    
    const order = {
      ...orderResult.rows[0],
      items: itemsResult.rows
    };
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * POST /api/orders
 * Create a new order with items
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { firstName, lastName, phone, creditCard, items, totalPrice } = req.body;
    
    // Validate required fields with specific messages
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ 
        error: 'First name is required',
        field: 'firstName',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (!lastName || !lastName.trim()) {
      return res.status(400).json({ 
        error: 'Last name is required',
        field: 'lastName',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (!phone || !phone.trim()) {
      return res.status(400).json({ 
        error: 'Phone number is required',
        field: 'phone',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Validate phone format (must have 10 digits)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      return res.status(400).json({ 
        error: 'Phone number must be 10 digits',
        field: 'phone',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (!creditCard || !creditCard.trim()) {
      return res.status(400).json({ 
        error: 'Credit card number is required',
        field: 'creditCard',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Validate credit card format (13-16 digits)
    const cardDigits = creditCard.replace(/\D/g, '');
    if (cardDigits.length < 13 || cardDigits.length > 16) {
      return res.status(400).json({ 
        error: 'Credit card number must be 13-16 digits',
        field: 'creditCard',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Your cart is empty. Please add items before placing an order.',
        field: 'items',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.name || !item.name.trim()) {
        return res.status(400).json({ 
          error: `Item #${i + 1} is missing a name`,
          field: 'items',
          code: 'VALIDATION_ERROR'
        });
      }
      
      if (!item.price || typeof item.price !== 'number' || item.price <= 0) {
        return res.status(400).json({ 
          error: `Item "${item.name}" has an invalid price`,
          field: 'items',
          code: 'VALIDATION_ERROR'
        });
      }
      
      if (!item.quantity || typeof item.quantity !== 'number') {
        return res.status(400).json({ 
          error: `Item "${item.name}" has an invalid quantity`,
          field: 'items',
          code: 'VALIDATION_ERROR'
        });
      }
      
      if (item.quantity < 1 || item.quantity > 9) {
        return res.status(400).json({ 
          error: `Item "${item.name}" quantity must be between 1 and 9`,
          field: 'items',
          code: 'VALIDATION_ERROR'
        });
      }
    }
    
    // Validate total price
    if (totalPrice === undefined || totalPrice === null || typeof totalPrice !== 'number' || totalPrice < 0) {
      return res.status(400).json({ 
        error: 'Invalid total price',
        field: 'totalPrice',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Start transaction timing
    const transactionStart = Date.now();
    
    // BEGIN transaction
    const beginStart = Date.now();
    await client.query('BEGIN');
    logPerformance(`⏱️  PostgreSQL: BEGIN transaction - ${Date.now() - beginStart}ms`);
    
    // Insert order
    const insertOrderStart = Date.now();
    const orderResult = await client.query(
      `INSERT INTO orders (first_name, last_name, phone, credit_card, total_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [firstName, lastName, phone, creditCard, totalPrice]
    );
    logPerformance(`⏱️  PostgreSQL: INSERT order - ${Date.now() - insertOrderStart}ms`);
    
    const order = orderResult.rows[0];
    
    // Insert order items
    const insertItemsStart = Date.now();
    const itemPromises = items.map(item => {
      const subtotal = item.price * item.quantity;
      return client.query(
        `INSERT INTO order_items (order_id, item_name, item_price, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [order.id, item.name, item.price, item.quantity, subtotal]
      );
    });
    
    const itemResults = await Promise.all(itemPromises);
    const orderItems = itemResults.map(result => result.rows[0]);
    logPerformance(`⏱️  PostgreSQL: INSERT ${items.length} order items - ${Date.now() - insertItemsStart}ms`);
    
    // COMMIT transaction
    const commitStart = Date.now();
    await client.query('COMMIT');
    logPerformance(`⏱️  PostgreSQL: COMMIT transaction - ${Date.now() - commitStart}ms`);
    
    logPerformance(`⏱️  PostgreSQL: Total transaction time - ${Date.now() - transactionStart}ms`);
    
    res.status(201).json({
      ...order,
      items: orderItems
    });
  } catch (error) {
    // Rollback transaction
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    
    console.error('Error creating order:', error);
    
    // Categorize database errors
    if (error.code) {
      // PostgreSQL error codes
      switch (error.code) {
        case '23505': // Unique violation
          return res.status(409).json({ 
            error: 'This order has already been processed. Please check your order history.',
            code: 'DUPLICATE_ORDER',
            details: error.detail
          });
          
        case '23503': // Foreign key violation
          return res.status(400).json({ 
            error: 'One or more items in your cart are no longer available.',
            code: 'INVALID_ITEM',
            details: error.detail
          });
          
        case '23502': // Not null violation
          return res.status(400).json({ 
            error: 'Missing required information. Please check all fields.',
            code: 'MISSING_DATA',
            field: error.column
          });
          
        case '22P02': // Invalid text representation
          return res.status(400).json({ 
            error: 'Invalid data format. Please check your input.',
            code: 'INVALID_FORMAT',
            details: error.message
          });
          
        case '53300': // Too many connections
          return res.status(503).json({ 
            error: 'Our system is experiencing high traffic. Please try again in a moment.',
            code: 'SERVICE_BUSY'
          });
          
        case 'ECONNREFUSED':
        case '08006': // Connection failure
          return res.status(503).json({ 
            error: 'Unable to connect to database. Please try again later.',
            code: 'DATABASE_UNAVAILABLE'
          });
          
        default:
          console.error('Unhandled database error code:', error.code);
      }
    }
    
    // Network/connection errors
    if (error.message && error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        error: 'Database connection failed. Please try again later.',
        code: 'CONNECTION_ERROR'
      });
    }
    
    // Timeout errors
    if (error.message && (error.message.includes('timeout') || error.message.includes('ETIMEDOUT'))) {
      return res.status(504).json({ 
        error: 'Order processing is taking too long. Please try again.',
        code: 'TIMEOUT_ERROR'
      });
    }
    
    // Generic database error
    res.status(500).json({ 
      error: 'Unable to process your order. Please try again or contact support if the problem persists.',
      code: 'ORDER_FAILED',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

export default router;

