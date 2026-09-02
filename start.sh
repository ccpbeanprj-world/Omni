#!/bin/bash

# Omni-Channel Platform Startup Script
echo "🚀 Starting Omni-Channel Platform..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    echo "   Required: Database URLs, API keys for WhatsApp, Facebook, and WeChat"
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs
mkdir -p uploads
mkdir -p ssl

# Build and start services
echo "🐳 Building and starting Docker containers..."
docker-compose down
docker-compose build
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "🌐 Access the platform at: http://localhost"
    echo "📊 Health check: http://localhost/health"
    echo "🔗 Webhook status: http://localhost/webhook/status"
    echo ""
    echo "📋 Next steps:"
    echo "1. Configure your platform API keys in .env file"
    echo "2. Set up webhooks for each platform"
    echo "3. Create an agent account via API or database"
    echo "4. Start managing conversations!"
    echo ""
    echo "📖 For detailed setup instructions, see README.md"
else
    echo "❌ Some services failed to start. Check logs with:"
    echo "   docker-compose logs"
fi

# Show logs
echo "📋 Showing recent logs..."
docker-compose logs --tail=20








