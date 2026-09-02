#!/bin/bash

# Docker deployment script for Omni Channel Platform

echo "🐳 Building and starting Omni Channel Platform with Docker..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from env.example..."
    if [ -f env.example ]; then
        cp env.example .env
        echo "📝 Please update .env file with your LINE API credentials"
    else
        echo "❌ env.example file not found. Please create .env file manually"
        exit 1
    fi
fi

# Create data directory if it doesn't exist
mkdir -p data

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service status:"
docker-compose ps

# Show logs
echo "📋 Recent logs:"
docker-compose logs --tail=20

echo ""
echo "🎉 Omni Channel Platform is running!"
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend: http://localhost:3000"
echo "📡 Webhook: http://localhost:3000/webhook/line"
echo ""
echo "📋 Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Restart services: docker-compose restart"
echo "  Update services: docker-compose up -d --build"


