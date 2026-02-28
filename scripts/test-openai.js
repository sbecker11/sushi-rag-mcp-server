import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('\n🔍 Testing OpenAI Configuration:');
console.log('=====================================');
console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('API Key length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10) || 'N/A');
console.log('=====================================\n');

try {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  console.log('📡 Attempting OpenAI API call...\n');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: "Say 'Hello, sushi!'" }],
    max_tokens: 10
  });
  
  console.log('✅ SUCCESS! OpenAI API is working!');
  console.log('Response:', response.choices[0].message.content);
  console.log('\n🎉 Your API key is valid. The app will work correctly.\n');
  
} catch (error) {
  console.error('❌ FAILED! OpenAI Error:', error.message);
  if (error.status === 401) {
    console.error('\n💡 Your API key is invalid or expired.');
    console.error('   Get a new one at: https://platform.openai.com/api-keys\n');
  }
}

