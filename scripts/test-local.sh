#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     Local Testing Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PASSED=0
FAILED=0

# Test function
test_check() {
  local name="$1"
  local command="$2"
  
  echo -ne "${YELLOW}Testing: ${name}...${NC} "
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ FAIL${NC}"
    ((FAILED++))
    return 1
  fi
}

# 1. Configuration Tests
echo -e "${BLUE}📋 Configuration Tests${NC}"
test_check "Environment file exists" "[ -f .env ]"
test_check "OpenAI key configured" "grep -q 'OPENAI_API_KEY=sk-' .env"
echo ""

# 2. Service Tests
echo -e "${BLUE}🐳 Service Tests${NC}"
test_check "Docker Desktop running" "docker info"
test_check "PostgreSQL container running" "docker ps | grep -q sushi-rag-app-postgres"
test_check "ChromaDB container running" "docker ps | grep -q sushi-rag-app-chromadb"
test_check "PostgreSQL healthy" "docker exec sushi-rag-app-postgres pg_isready -U sushi_rag_app_user"
echo ""

# 3. API Tests (only if services are running)
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo -e "${BLUE}🌐 API Tests${NC}"
  test_check "Backend server responding" "curl -s http://localhost:3001/api/health | grep -q '\"status\":\"ok\"'"
  test_check "Frontend server responding" "curl -s -o /dev/null -w '%{http_code}' http://localhost:5173 | grep -q '200'"
  test_check "Menu API responds" "curl -s http://localhost:3001/api/menu | grep -q '\"name\"'"
  test_check "AI status endpoint" "curl -s http://localhost:3001/api/assistant/status | grep -q 'vectorStore'"
  test_check "ChromaDB heartbeat" "curl -s http://localhost:8000/api/v1/heartbeat | grep -q 'heartbeat'"
  echo ""
else
  echo -e "${YELLOW}⚠️  Servers not running. Start with: npm run dev${NC}"
  echo ""
fi

# 4. Database Tests
echo -e "${BLUE}🗄️  Database Tests${NC}"
test_check "Database tables exist" "docker exec sushi-rag-app-postgres psql -U sushi_rag_app_user -d sushi_rag_app_orders -c '\dt' | grep -q 'orders'"
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  echo -e "${GREEN}   Your local environment is ready!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed.${NC}"
  echo -e "${YELLOW}   Fix the issues and run again.${NC}"
  exit 1
fi

