import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up: database -> backend -> root)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const { Pool } = pg;

async function setupDatabase() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER || 'sushi_user',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'sushi_orders',
    password: process.env.POSTGRES_PASSWORD || 'sushi_password',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
  });

  try {
    console.log('🔄 Connecting to database...');
    
    // Read SQL file
    const sqlPath = join(__dirname, 'init.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Execute SQL commands
    console.log('🔄 Creating tables...');
    await pool.query(sql);
    
    console.log('✅ Database setup completed successfully!');
    console.log('📊 Tables created:');
    console.log('   - orders');
    console.log('   - order_items');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Could not connect to database.');
      console.error('💡 Make sure PostgreSQL is running: docker-compose up -d');
    } else if (error.message.includes('already exists')) {
      console.log('ℹ️  Tables already exist - database is ready!');
    } else {
      console.error('❌ Error setting up database:', error.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();

