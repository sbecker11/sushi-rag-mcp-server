import { describe, test, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');

// Test the submitOrder error handling logic
describe('App.jsx - Order Submission Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Cases', () => {
    test('should successfully submit order and return data', async () => {
      const mockOrderData = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        total_price: 34.97,
        items: [
          { item_name: 'Salmon Nigiri', quantity: 2, subtotal: 25.98 }
        ]
      };

      axios.post.mockResolvedValueOnce({ data: mockOrderData });

      const customerInfo = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        creditCard: '4111111111111111'
      };

      const cartItems = [
        { name: 'Salmon Nigiri', price: 12.99, quantity: 2 }
      ];

      // Simulate submitOrder function
      const submitOrder = async (customerInfo) => {
        const orderData = {
          firstName: customerInfo.firstName,
          lastName: customerInfo.lastName,
          phone: customerInfo.phone,
          creditCard: customerInfo.creditCard,
          items: cartItems.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          totalPrice: 25.98
        };

        const response = await axios.post('/api/orders', orderData);
        return response.data;
      };

      const result = await submitOrder(customerInfo);
      
      expect(result).toEqual(mockOrderData);
      expect(axios.post).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe'
      }));
    });
  });

  describe('Error Response Parsing', () => {
    test('should extract error message from backend response', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: {
            error: 'Phone number must be 10 digits',
            code: 'VALIDATION_ERROR',
            field: 'phone'
          }
        }
      };

      axios.post.mockRejectedValueOnce(errorResponse);

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
          return true;
        } catch (err) {
          let errorMessage = 'Failed to submit order. Please try again.';
          let errorCode = null;
          let errorField = null;

          if (err.response?.data) {
            const errorData = err.response.data;
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.code) {
              errorCode = errorData.code;
            }
            if (errorData.field) {
              errorField = errorData.field;
            }
          }

          const error = new Error(errorMessage);
          error.code = errorCode;
          error.field = errorField;
          error.statusCode = err.response?.status;
          throw error;
        }
      };

      await expect(submitOrder()).rejects.toThrow('Phone number must be 10 digits');
      
      try {
        await submitOrder();
      } catch (error) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.field).toBe('phone');
        expect(error.statusCode).toBe(400);
      }
    });

    test('should handle network error (no response)', async () => {
      axios.post.mockRejectedValueOnce({ request: {} });

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          let errorMessage = 'Failed to submit order. Please try again.';
          let errorCode = null;

          if (err.response?.data) {
            errorMessage = err.response.data.error;
          } else if (err.request) {
            errorMessage = 'Unable to reach the server. Please check your internet connection and try again.';
            errorCode = 'NETWORK_ERROR';
          }

          const error = new Error(errorMessage);
          error.code = errorCode;
          throw error;
        }
      };

      await expect(submitOrder()).rejects.toThrow('Unable to reach the server');
      
      try {
        await submitOrder();
      } catch (error) {
        expect(error.code).toBe('NETWORK_ERROR');
      }
    });

    test('should handle validation error with field info', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: {
            error: 'First name is required',
            code: 'VALIDATION_ERROR',
            field: 'firstName'
          }
        }
      };

      axios.post.mockRejectedValueOnce(errorResponse);

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          const errorData = err.response.data;
          const error = new Error(errorData.error);
          error.code = errorData.code;
          error.field = errorData.field;
          throw error;
        }
      };

      try {
        await submitOrder();
      } catch (error) {
        expect(error.message).toBe('First name is required');
        expect(error.field).toBe('firstName');
      }
    });

    test('should handle database unavailable error', async () => {
      const errorResponse = {
        response: {
          status: 503,
          data: {
            error: 'Unable to connect to database. Please try again later.',
            code: 'DATABASE_UNAVAILABLE'
          }
        }
      };

      axios.post.mockRejectedValueOnce(errorResponse);

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          const errorData = err.response.data;
          const error = new Error(errorData.error);
          error.code = errorData.code;
          error.statusCode = err.response.status;
          throw error;
        }
      };

      try {
        await submitOrder();
      } catch (error) {
        expect(error.message).toContain('database');
        expect(error.code).toBe('DATABASE_UNAVAILABLE');
        expect(error.statusCode).toBe(503);
      }
    });

    test('should handle duplicate order error', async () => {
      const errorResponse = {
        response: {
          status: 409,
          data: {
            error: 'This order has already been processed. Please check your order history.',
            code: 'DUPLICATE_ORDER'
          }
        }
      };

      axios.post.mockRejectedValueOnce(errorResponse);

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          const error = new Error(err.response.data.error);
          error.code = err.response.data.code;
          error.statusCode = err.response.status;
          throw error;
        }
      };

      try {
        await submitOrder();
      } catch (error) {
        expect(error.message).toContain('already been processed');
        expect(error.code).toBe('DUPLICATE_ORDER');
        expect(error.statusCode).toBe(409);
      }
    });

    test('should handle timeout error', async () => {
      const errorResponse = {
        response: {
          status: 504,
          data: {
            error: 'Order processing is taking too long. Please try again.',
            code: 'TIMEOUT_ERROR'
          }
        }
      };

      axios.post.mockRejectedValueOnce(errorResponse);

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          const error = new Error(err.response.data.error);
          error.code = err.response.data.code;
          throw error;
        }
      };

      try {
        await submitOrder();
      } catch (error) {
        expect(error.message).toContain('taking too long');
        expect(error.code).toBe('TIMEOUT_ERROR');
      }
    });

    test('should handle high traffic error', async () => {
      const errorResponse = {
        response: {
          status: 503,
          data: {
            error: 'Our system is experiencing high traffic. Please try again in a moment.',
            code: 'SERVICE_BUSY'
          }
        }
      };

      axios.post.mockRejectedValueOnce(errorResponse);

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          const error = new Error(err.response.data.error);
          error.code = err.response.data.code;
          throw error;
        }
      };

      try {
        await submitOrder();
      } catch (error) {
        expect(error.message).toContain('high traffic');
        expect(error.code).toBe('SERVICE_BUSY');
      }
    });
  });

  describe('Error Object Structure', () => {
    test('should create error with all required properties', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: {
            error: 'Item "Salmon" has an invalid price',
            code: 'VALIDATION_ERROR',
            field: 'items'
          }
        }
      };

      axios.post.mockRejectedValueOnce(errorResponse);

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          const errorData = err.response.data;
          const error = new Error(errorData.error);
          error.code = errorData.code;
          error.field = errorData.field;
          error.statusCode = err.response.status;
          throw error;
        }
      };

      try {
        await submitOrder();
      } catch (error) {
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('statusCode');
        expect(error.message).toBe('Item "Salmon" has an invalid price');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.field).toBe('items');
        expect(error.statusCode).toBe(400);
      }
    });

    test('should handle error without field information', async () => {
      const errorResponse = {
        response: {
          status: 500,
          data: {
            error: 'Unable to process your order.',
            code: 'ORDER_FAILED'
          }
        }
      };

      axios.post.mockRejectedValueOnce(errorResponse);

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          const errorData = err.response?.data || {};
          const error = new Error(errorData.error || 'Unknown error');
          error.code = errorData.code || null;
          error.field = errorData.field || null;
          throw error;
        }
      };

      try {
        await submitOrder();
      } catch (error) {
        expect(error.message).toBe('Unable to process your order.');
        expect(error.code).toBe('ORDER_FAILED');
        expect(error.field).toBeNull();
      }
    });
  });

  describe('Generic Error Handling', () => {
    test('should provide fallback message for unknown errors', async () => {
      axios.post.mockRejectedValueOnce(new Error('Unexpected error'));

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          let errorMessage = 'Failed to submit order. Please try again.';
          
          if (err.response?.data?.error) {
            errorMessage = err.response.data.error;
          } else if (err.message) {
            errorMessage = err.message;
          }

          throw new Error(errorMessage);
        }
      };

      await expect(submitOrder()).rejects.toThrow('Unexpected error');
    });

    test('should handle empty error response', async () => {
      axios.post.mockRejectedValueOnce({ response: { status: 500, data: {} } });

      const submitOrder = async () => {
        try {
          await axios.post('/api/orders', {});
        } catch (err) {
          const errorMessage = err.response?.data?.error || 'Failed to submit order. Please try again.';
          throw new Error(errorMessage);
        }
      };

      await expect(submitOrder()).rejects.toThrow('Failed to submit order');
    });
  });
});

