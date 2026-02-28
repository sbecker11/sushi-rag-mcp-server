#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🎨 Generating RAG Architecture Diagram...${NC}"
echo ""

# Check if mermaid-cli is installed
if ! command -v mmdc &> /dev/null; then
    echo -e "${RED}❌ Mermaid CLI (mmdc) is not installed${NC}"
    echo ""
    echo -e "${YELLOW}To install:${NC}"
    echo "  npm install -g @mermaid-js/mermaid-cli"
    echo ""
    echo -e "${YELLOW}Or use the online editor:${NC}"
    echo "  1. Go to https://mermaid.live/"
    echo "  2. Copy the mermaid code from README.md"
    echo "  3. Click 'Download PNG'"
    echo ""
    exit 1
fi

# Create docs directory if it doesn't exist
mkdir -p docs/images

# Extract mermaid diagram from README.md
echo -e "${YELLOW}📄 Extracting diagram from README.md...${NC}"

# Extract content between ```mermaid and ```
sed -n '/```mermaid/,/```/p' README.md | sed '1d;$d' > /tmp/rag-diagram.mmd

# Generate PNG with different themes
echo -e "${YELLOW}🖼️  Generating PNG images...${NC}"

# Dark theme with transparent background
mmdc -i /tmp/rag-diagram.mmd -o docs/images/rag-architecture-dark.png -t dark -b transparent -w 1920 -H 1080

# Light theme with white background  
mmdc -i /tmp/rag-diagram.mmd -o docs/images/rag-architecture-light.png -t default -b white -w 1920 -H 1080

# SVG (scalable)
mmdc -i /tmp/rag-diagram.mmd -o docs/images/rag-architecture.svg -t default -b white

# Clean up
rm /tmp/rag-diagram.mmd

echo ""
echo -e "${GREEN}✅ Diagrams generated successfully!${NC}"
echo ""
echo "Generated files:"
echo "  📁 docs/images/rag-architecture-dark.png  (for dark backgrounds)"
echo "  📁 docs/images/rag-architecture-light.png (for light backgrounds)"
echo "  📁 docs/images/rag-architecture.svg        (scalable vector)"
echo ""
echo -e "${YELLOW}Add to your README or presentations!${NC}"

