#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load container name from .env or use default
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | grep POSTGRES_CONTAINER | xargs)
fi
CONTAINER_NAME="${POSTGRES_CONTAINER:-sushi-rag-app-postgres}"

echo -e "${YELLOW}🧹 Cleaning up old Docker containers...${NC}"

# Check if container exists (running or stopped)
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo -e "${YELLOW}   Found old ${CONTAINER_NAME} container${NC}"
  
  # Stop it if running
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}   Stopping container...${NC}"
    docker stop "${CONTAINER_NAME}" > /dev/null 2>&1
  fi
  
  # Remove it
  echo -e "${YELLOW}   Removing container...${NC}"
  docker rm "${CONTAINER_NAME}" > /dev/null 2>&1
  echo -e "${GREEN}   ✅ Old container removed${NC}"
else
  echo -e "${GREEN}   ✅ No cleanup needed${NC}"
fi

echo ""

