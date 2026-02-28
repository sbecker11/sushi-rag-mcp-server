#!/bin/bash

# Cross-platform script to open browser
URL="http://localhost:5173"

# Wait a moment for the dev server to start
sleep 3

echo "🌐 Opening browser to $URL..."

# Detect OS and open browser accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "$URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open "$URL" 2>/dev/null || echo "⚠️  Could not open browser automatically"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows
    start "$URL"
else
    echo "⚠️  Could not detect OS to open browser automatically"
    echo "   Please open $URL in your browser"
fi

