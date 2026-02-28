// Manual mock for database.js
import { jest } from '@jest/globals';

const pool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
  on: jest.fn()
};

export default pool;

