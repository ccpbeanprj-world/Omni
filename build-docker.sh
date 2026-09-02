#!/bin/bash
# Build script for 100% Dynamic Omni Platform

set -e

echo "🚀 Building 100% Dynamic Omni Platform..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Build Docker image
echo "📦 Building Docker image..."
docker build \
  --build-arg VITE_API_URL=https://api.omni-platform.com \
  --build-arg VITE_SOCKET_URL=https://socket.omni-platform.com \
  --build-arg VITE_PLATFORM_NAME="Omni Platform" \
  --build-arg VITE_PLATFORM_VERSION="1.0.0" \
  --build-arg VITE_ENABLE_DEBUG=false \
  --build-arg VITE_ENABLE_SOCKET=true \
  --build-arg VITE_ENABLE_CACHE=true \
  --build-arg VITE_DOCKER=true \
  -t omni-platform:latest .

echo "✅ Docker image built successfully!"

# Start services
echo "🚀 Starting services..."
docker-compose up -d

echo "🎉 Omni Platform is now running!"
echo "📱 Frontend: http://localhost"
echo "🔧 API: http://localhost/api"
echo "🔗 Webhook: http://localhost/webhook/line"

# Show logs
echo "📋 Showing logs..."
docker-compose logs -f



