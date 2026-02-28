#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     .env Validation Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${RED}❌ .env file not found!${NC}"
  echo -e "${YELLOW}   Create one by copying env.example:${NC}"
  echo -e "${YELLOW}   cp env.example .env${NC}"
  exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"
echo ""

# Required variables
REQUIRED_VARS=(
  "PORT"
  "POSTGRES_CONTAINER"
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
  "POSTGRES_DB"
  "POSTGRES_HOST"
  "POSTGRES_PORT"
  "OPENAI_API_KEY"
  "CHROMA_HOST"
  "CHROMA_PORT"
  "FRONTEND_URL"
  "ENABLE_PERFORMANCE_LOGGING"
)

# Load .env
export $(cat .env | grep -v '^#' | xargs)

# Track validation status
ALL_VALID=true

echo -e "${BLUE}Checking required variables:${NC}"
echo ""

# Check each required variable
for VAR in "${REQUIRED_VARS[@]}"; do
  VALUE="${!VAR}"
  
  if [ -z "$VALUE" ]; then
    echo -e "${RED}❌ $VAR is missing${NC}"
    ALL_VALID=false
  elif [ "$VALUE" == "your_openai_api_key_here" ] && [ "$VAR" == "OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  $VAR is not configured (using placeholder)${NC}"
    ALL_VALID=false
  else
    echo -e "${GREEN}✅ $VAR is set${NC}"
  fi
done

echo ""

# Check specific values
echo -e "${BLUE}Checking configuration values:${NC}"
echo ""

# Check PostgreSQL naming convention
if [[ "$POSTGRES_USER" == sushi_rag_app_* ]]; then
  echo -e "${GREEN}✅ POSTGRES_USER uses correct naming convention${NC}"
else
  echo -e "${YELLOW}⚠️  POSTGRES_USER doesn't match recommended convention (sushi_rag_app_*)${NC}"
  echo -e "   Current: $POSTGRES_USER"
  echo -e "   Recommended: sushi_rag_app_user"
fi

if [[ "$POSTGRES_DB" == sushi_rag_app_* ]]; then
  echo -e "${GREEN}✅ POSTGRES_DB uses correct naming convention${NC}"
else
  echo -e "${YELLOW}⚠️  POSTGRES_DB doesn't match recommended convention (sushi_rag_app_*)${NC}"
  echo -e "   Current: $POSTGRES_DB"
  echo -e "   Recommended: sushi_rag_app_orders"
fi

# Check container name
if [ "$POSTGRES_CONTAINER" == "sushi-rag-app-postgres" ]; then
  echo -e "${GREEN}✅ POSTGRES_CONTAINER is correct${NC}"
else
  echo -e "${YELLOW}⚠️  POSTGRES_CONTAINER doesn't match recommended value${NC}"
  echo -e "   Current: $POSTGRES_CONTAINER"
  echo -e "   Recommended: sushi-rag-app-postgres"
fi

# Check ports
if [ "$PORT" == "3001" ]; then
  echo -e "${GREEN}✅ Backend PORT is correct (3001)${NC}"
else
  echo -e "${YELLOW}⚠️  Backend PORT differs from default (3001)${NC}"
  echo -e "   Current: $PORT"
fi

if [ "$POSTGRES_PORT" == "5432" ]; then
  echo -e "${GREEN}✅ POSTGRES_PORT is correct (5432)${NC}"
else
  echo -e "${YELLOW}⚠️  POSTGRES_PORT differs from default (5432)${NC}"
  echo -e "   Current: $POSTGRES_PORT"
fi

if [ "$CHROMA_PORT" == "8000" ]; then
  echo -e "${GREEN}✅ CHROMA_PORT is correct (8000)${NC}"
else
  echo -e "${YELLOW}⚠️  CHROMA_PORT differs from default (8000)${NC}"
  echo -e "   Current: $CHROMA_PORT"
fi

echo ""

# Final result
echo -e "${BLUE}========================================${NC}"
if [ "$ALL_VALID" = true ] && [ "$OPENAI_API_KEY" != "your_openai_api_key_here" ]; then
  echo -e "${GREEN}✅ Validation PASSED!${NC}"
  echo -e "${GREEN}   Your .env is properly configured.${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Validation INCOMPLETE${NC}"
  echo -e "${YELLOW}   Please fix the issues above.${NC}"
  echo ""
  if [ "$OPENAI_API_KEY" == "your_openai_api_key_here" ]; then
    echo -e "${RED}🔑 IMPORTANT: You must configure your OpenAI API key!${NC}"
    echo -e "${YELLOW}   See docs/04_OPENAI_SETUP.md for instructions.${NC}"
  fi
  echo -e "${BLUE}========================================${NC}"
  exit 1
fi

