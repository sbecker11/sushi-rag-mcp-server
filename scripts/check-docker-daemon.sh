#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Checking if Docker Desktop is running...${NC}"

if docker info > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Docker Desktop is running${NC}"
  exit 0
else
  echo -e "${RED}❌ Docker Desktop is NOT running!${NC}"
  echo -e ""
  echo -e "${RED}Please start Docker Desktop and try again.${NC}"
  echo -e "${YELLOW}You can start it by:${NC}"
  echo -e "${YELLOW}  - Opening Docker Desktop from Applications${NC}"
  echo -e "${YELLOW}  - Or running: open -a Docker${NC}"
  echo -e ""
  exit 1
fi

