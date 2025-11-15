#!/bin/bash

echo "🏛️  Southeast Texas History Application"
echo "======================================"
echo ""

# Check if database exists
if [ ! -f "database.sqlite" ]; then
    echo "📊 Database not found. Initializing..."
    node history-database.js
    echo ""
fi

# Start API server
echo "🚀 Starting API server on port 3002..."
node api-server.js
