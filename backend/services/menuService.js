import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up: services -> backend -> root)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Only instantiate OpenAI client when needed and if key is available
let openai = null;

// Menu cache to avoid regenerating on every request
let menuCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = parseInt(process.env.MENU_CACHE_TTL_MINUTES || '60') * 60 * 1000; // Default: 60 minutes

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.');
  }
  
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  return openai;
}

/**
 * Get menu items using OpenAI LLM
 * Requires OPENAI_API_KEY to be configured
 * Uses in-memory cache to avoid regenerating on every request
 */
export async function getMenuFromLLM() {
  try {
    // Check if we have a valid cached menu
    const now = Date.now();
    if (menuCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      const cacheAge = Math.round((now - cacheTimestamp) / 1000);
      console.log(`✅ Returning cached menu (age: ${cacheAge}s, TTL: ${CACHE_TTL_MS/1000}s)`);
      return menuCache;
    }
    
    const client = getOpenAIClient();
    
    console.log('🤖 Calling OpenAI API to generate menu...');
    
    // Start timing
    const startTime = Date.now();
    
    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI request timeout')), 30000)
    );
    
    const apiPromise = client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You generate complete valid JSON arrays. Return full response, never truncate."
        },
        {
          role: "user",
          content: `Generate exactly 8 sushi menu items. Return ONLY a valid JSON array with ALL 8 items, using this format:

[
{"id":1,"name":"California Roll","description":"Crab and avocado","price":8.99,"image":"https://picsum.photos/400/300?random=1","ingredients":"Crab, Avocado","category":"Rolls","dietary":["pescatarian"],"spiceLevel":0},
{"id":2,"name":"Item Name","description":"Short description","price":7.50,"image":"https://picsum.photos/400/300?random=2","ingredients":"Ingredient List","category":"Category","dietary":["type"],"spiceLevel":0},
...continue for ids 3-8
]

Requirements: Mix of rolls, nigiri, appetizers. Prices $5-$15. Return ONLY the complete JSON array with all 8 items.`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });
    
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    // End timing and calculate duration
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log performance if enabled
    if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
      console.log(`⏱️  OpenAI LLM Response Time: ${duration}ms`);
    }

    const content = response.choices[0].message.content;
    
    // Log response metadata for debugging
    if (process.env.ENABLE_PERFORMANCE_LOGGING === 'true') {
      console.log(`📊 Response length: ${content.length} characters`);
      console.log(`📊 Finish reason: ${response.choices[0].finish_reason}`);
    }
    
    // Check if response was truncated
    if (response.choices[0].finish_reason === 'length') {
      console.warn('⚠️  Response was truncated due to max_tokens limit!');
    }
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || content.match(/(\[[\s\S]*?\])/);
    
    if (jsonMatch) {
      try {
        // Try to fix common JSON issues
        let jsonString = jsonMatch[1]
          .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
          .replace(/'/g, '"')              // Replace single quotes with double quotes
          .replace(/(\w+):/g, '"$1":');    // Quote unquoted keys
        
        const menuItems = JSON.parse(jsonString);
        
        // Cache the generated menu
        menuCache = menuItems;
        cacheTimestamp = Date.now();
        console.log(`✅ Generated menu from OpenAI LLM (cached for ${CACHE_TTL_MS/1000}s)`);
        
        return menuItems;
      } catch (parseError) {
        console.error('❌ JSON parsing error:', parseError.message);
        console.error('   Full content length:', content.length);
        console.error('   Raw content (first 1000 chars):', content.substring(0, 1000));
        console.error('   Raw content (last 200 chars):', content.substring(Math.max(0, content.length - 200)));
        throw new Error('Could not parse JSON from LLM response: ' + parseError.message);
      }
    }
    
    throw new Error('Could not find JSON array in LLM response');
  } catch (error) {
    console.error('❌ Error fetching menu from LLM:', error.message);
    if (error.status) console.error('   Status:', error.status);
    if (error.type) console.error('   Type:', error.type);
    
    // If we have a cached menu from before, return it even if expired
    if (menuCache) {
      console.log('⚠️  Returning expired cached menu due to API error');
      return menuCache;
    }
    
    // Final fallback to simple static menu so app can work
    console.log('ℹ️  Using fallback static menu');
    return [
      {
        id: 1,
        name: "California Roll",
        description: "Crab, avocado, cucumber",
        price: 8.99,
        image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=300",
        ingredients: "Crab, Avocado, Cucumber, Rice, Nori",
        category: "Maki Rolls",
        dietary: ["pescatarian"],
        spiceLevel: 0
      },
      {
        id: 2,
        name: "Spicy Tuna Roll",
        description: "Tuna with spicy mayo",
        price: 9.99,
        image: "https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=400&h=300",
        ingredients: "Tuna, Spicy Mayo, Cucumber, Rice",
        category: "Maki Rolls",
        dietary: ["pescatarian"],
        spiceLevel: 3
      },
      {
        id: 3,
        name: "Salmon Nigiri",
        description: "Fresh salmon on rice",
        price: 6.99,
        image: "https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=400&h=300",
        ingredients: "Salmon, Sushi Rice, Wasabi",
        category: "Nigiri",
        dietary: ["pescatarian", "gluten-free"],
        spiceLevel: 0
      },
      {
        id: 4,
        name: "Vegetable Tempura",
        description: "Crispy fried vegetables",
        price: 7.99,
        image: "https://images.unsplash.com/photo-1576774213852-c2c7e0c6dbfc?w=400&h=300",
        ingredients: "Sweet Potato, Broccoli, Carrot, Tempura Batter",
        category: "Appetizers",
        dietary: ["vegetarian"],
        spiceLevel: 0
      },
      {
        id: 5,
        name: "Dragon Roll",
        description: "Shrimp tempura with eel",
        price: 14.99,
        image: "https://images.unsplash.com/photo-1564489563601-c53cfc451e93?w=400&h=300",
        ingredients: "Shrimp, Eel, Avocado, Cucumber, Eel Sauce",
        category: "Specialty Rolls",
        dietary: ["pescatarian"],
        spiceLevel: 0
      },
      {
        id: 6,
        name: "Edamame",
        description: "Steamed soybeans with salt",
        price: 4.99,
        image: "https://images.unsplash.com/photo-1583663237037-b57a45c1e5d6?w=400&h=300",
        ingredients: "Soybeans, Sea Salt",
        category: "Appetizers",
        dietary: ["vegan", "vegetarian", "gluten-free"],
        spiceLevel: 0
      },
      {
        id: 7,
        name: "Rainbow Roll",
        description: "California roll with assorted fish",
        price: 13.99,
        image: "https://images.unsplash.com/photo-1582450871972-ab5ca641643d?w=400&h=300",
        ingredients: "Tuna, Salmon, Yellowtail, Crab, Avocado",
        category: "Specialty Rolls",
        dietary: ["pescatarian"],
        spiceLevel: 0
      },
      {
        id: 8,
        name: "Miso Soup",
        description: "Traditional Japanese soup",
        price: 3.99,
        image: "https://images.unsplash.com/photo-1588566565463-180a5b2090d2?w=400&h=300",
        ingredients: "Miso Paste, Tofu, Seaweed, Green Onions",
        category: "Soup",
        dietary: ["vegan", "vegetarian", "gluten-free"],
        spiceLevel: 0
      }
    ];
  }
}

/**
 * Clear the menu cache
 * Useful for forcing a fresh menu generation
 */
export function clearMenuCache() {
  menuCache = null;
  cacheTimestamp = null;
  console.log('🗑️  Menu cache cleared');
}

/**
 * Get cache status
 * Returns info about current cache state
 */
export function getCacheStatus() {
  if (!menuCache || !cacheTimestamp) {
    return { cached: false };
  }
  
  const now = Date.now();
  const age = Math.round((now - cacheTimestamp) / 1000);
  const ttl = Math.round(CACHE_TTL_MS / 1000);
  const expired = (now - cacheTimestamp) >= CACHE_TTL_MS;
  
  return {
    cached: true,
    age,
    ttl,
    expired
  };
}

