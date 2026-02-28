import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

class AgentService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      console.log('ℹ️  Agent service already initialized.');
      return;
    }
    
    // Skip agent initialization for now - just use simple RAG
    console.log('⚠️  Agent service temporarily disabled - using simple RAG instead');
    this.initialized = false;
  }

  isInitialized() {
    return this.initialized;
  }

  async chat(input, chatHistory = []) {
    return "Agent service is temporarily disabled. Please use the RAG Q&A endpoint instead.";
  }
}

const agentService = new AgentService();
export default agentService;

