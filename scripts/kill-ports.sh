#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Only kill app ports, not Docker services (5432 is handled by docker-compose)
PORTS=(3001 5173)

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}     Port Cleanup Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

for PORT in "${PORTS[@]}"; do
  echo -e "${YELLOW}Checking port ${PORT}...${NC}"
  
  # Get PID using the port
  PID=$(lsof -ti:$PORT)
  
  if [ -z "$PID" ]; then
    echo -e "${GREEN}✅ Port ${PORT} is free${NC}"
  else
    echo -e "${RED}❌ Port ${PORT} is in use by process ${PID}${NC}"
    echo -e "${YELLOW}   Killing process ${PID}...${NC}"
    kill -9 $PID 2>/dev/null
    
    # Verify it was killed
    sleep 0.5
    if lsof -ti:$PORT > /dev/null 2>&1; then
      echo -e "${RED}   Failed to kill process on port ${PORT}${NC}"
    else
      echo -e "${GREEN}   ✅ Process killed, port ${PORT} is now free${NC}"
    fi
  fi
  echo ""
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}     Cleanup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

