import { jest, describe, test, beforeEach, expect } from '@jest/globals';

// Mock the database BEFORE importing anything else
const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
  on: jest.fn()
};

jest.unstable_mockModule('../../config/database.js', () => ({
  default: mockPool
}));

// Now dynamically import the modules
const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: ordersRouter } = await import('../orders.js');

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRouter);

describe('POST /api/orders - Order Validation', () => {
  let mockClient;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockPool.connect.mockResolvedValue(mockClient);
  });

  describe('Success Cases', () => {
    test('should create order with valid data', async () => {
      const validOrder = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '(555) 123-4567',
        creditCard: '4111 1111 1111 1111',
        items: [
          { name: 'Salmon Nigiri', price: 12.99, quantity: 2 },
          { name: 'Tuna Roll', price: 8.99, quantity: 1 }
        ],
        totalPrice: 34.97
      };

      // Mock successful transaction
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ // INSERT order
          rows: [{
            id: 1,
            first_name: 'John',
            last_name: 'Doe',
            phone: '5551234567',
            credit_card: '4111111111111111',
            total_price: 34.97
          }]
        })
        // INSERT items (2 items = 2 queries)
        .mockResolvedValueOnce({ rows: [{ id: 1, order_id: 1, item_name: 'Salmon Nigiri', item_price: 12.99, quantity: 2, subtotal: 25.98 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, order_id: 1, item_name: 'Tuna Roll', item_price: 8.99, quantity: 1, subtotal: 8.99 }] })
        .mockResolvedValueOnce({}); // COMMIT

      const response = await request(app)
        .post('/api/orders')
        .send(validOrder);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(1);
    });

    test('should accept credit card with 13 digits', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '1234567890123', // 13 digits (AMEX)
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // 1 item
        .mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(201);
    });

    test('should accept credit card with 16 digits', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '1234567890123456', // 16 digits
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // 1 item
        .mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(201);
    });

    test('should accept multiple items with varying quantities (1-9)', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [
          { name: 'Item1', price: 10.00, quantity: 1 },
          { name: 'Item2', price: 10.00, quantity: 5 },
          { name: 'Item3', price: 10.00, quantity: 9 }
        ],
        totalPrice: 150.00
      };

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 4 }] })
        // 3 items = 3 queries
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(201);
    });
  });

  describe('Validation Failures - Required Fields', () => {
    test('should reject order without first name', async () => {
      const order = {
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('First name is required');
      expect(response.body.field).toBe('firstName');
    });

    test('should reject order without last name', async () => {
      const order = {
        firstName: 'John',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Last name is required');
      expect(response.body.field).toBe('lastName');
    });

    test('should reject order without phone', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Phone number is required');
      expect(response.body.field).toBe('phone');
    });

    test('should reject order without credit card', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Credit card number is required');
      expect(response.body.field).toBe('creditCard');
    });

    test('should reject order with empty cart', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [],
        totalPrice: 0
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Your cart is empty. Please add items before placing an order.');
    });
  });

  describe('Validation Failures - Format Errors', () => {
    test('should reject phone with less than 10 digits', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '555123456', // 9 digits
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Phone number must be 10 digits');
      expect(response.body.field).toBe('phone');
    });

    test('should reject phone with more than 10 digits', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '55512345678', // 11 digits
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Phone number must be 10 digits');
      expect(response.body.field).toBe('phone');
    });

    test('should reject credit card with less than 13 digits', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '123456789012', // 12 digits
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Credit card number must be 13-16 digits');
      expect(response.body.field).toBe('creditCard');
    });

    test('should reject credit card with more than 16 digits', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '12345678901234567', // 17 digits
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Credit card number must be 13-16 digits');
      expect(response.body.field).toBe('creditCard');
    });
  });

  describe('Validation Failures - Item Errors', () => {
    test('should reject item without name', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item #1 is missing a name');
    });

    test('should reject item with invalid price', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 'invalid', quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item "Salmon" has an invalid price');
    });

    test('should reject item with negative price', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Tuna', price: -5.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item "Tuna" has an invalid price');
    });

    test('should reject item with quantity less than 1', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 0 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item "Salmon" has an invalid quantity');
    });

    test('should reject item with quantity greater than 9', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 10 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item "Salmon" quantity must be between 1 and 9');
    });

    test('should reject item with invalid quantity type', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 'two' }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item "Salmon" has an invalid quantity');
    });
  });

  describe('Database Error Handling', () => {
    test('should handle duplicate order error (23505)', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce({ code: '23505' }); // Duplicate key

      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('This order has already been processed. Please check your order history.');
      expect(response.body.code).toBe('DUPLICATE_ORDER');
    });

    test('should handle foreign key violation (23503)', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ code: '23503' });

      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('One or more items in your cart are no longer available.');
    });

    test('should handle not null violation (23502)', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ code: '23502' });

      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required information. Please check all fields.');
    });

    test('should handle connection refused error', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ code: 'ECONNREFUSED' });

      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Unable to connect to database. Please try again later.');
      expect(response.body.code).toBe('DATABASE_UNAVAILABLE');
    });

    test('should handle timeout error', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.code = 'ETIMEDOUT';
      mockClient.query
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(timeoutError);

      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(504);
      expect(response.body.error).toBe('Order processing is taking too long. Please try again.');
      expect(response.body.code).toBe('TIMEOUT_ERROR');
    });

    test('should handle high traffic error (53300)', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ code: '53300' });

      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Our system is experiencing high traffic. Please try again in a moment.');
      expect(response.body.code).toBe('SERVICE_BUSY');
    });

    test('should handle generic database error', async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Unknown database error'));

      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Unable to process your order. Please try again or contact support if the problem persists.');
      expect(response.body.code).toBe('ORDER_FAILED');
    });
  });

  describe('Edge Cases', () => {
    test('should handle invalid total price (negative)', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: -12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid total price');
    });

    test('should handle invalid total price (string)', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: [{ name: 'Salmon', price: 12.99, quantity: 1 }],
        totalPrice: 'invalid'
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid total price');
    });

    test('should handle items as non-array', async () => {
      const order = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111',
        items: 'not an array',
        totalPrice: 12.99
      };

      const response = await request(app)
        .post('/api/orders')
        .send(order);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Your cart is empty. Please add items before placing an order.');
    });
  });
});
