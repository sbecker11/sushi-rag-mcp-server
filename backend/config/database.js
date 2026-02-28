import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up: config -> backend -> root)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'sushi_rag_app_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'sushi_rag_app_orders',
  password: process.env.POSTGRES_PASSWORD || 'sushi_rag_app_password',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;

