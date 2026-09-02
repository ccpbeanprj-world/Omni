# Dockerfile for Omni Channel Platform
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY omni-react-app/package*.json ./omni-react-app/

# Install dependencies
RUN npm install
RUN cd omni-react-app && npm install

# Copy source code
COPY . .

# Build frontend
RUN cd omni-react-app && npm run build

# Expose ports
EXPOSE 3000 5173

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app' >> /app/start.sh && \
    echo 'npm run backend &' >> /app/start.sh && \
    echo 'cd /app/omni-react-app' >> /app/start.sh && \
    echo 'npm run preview -- --host 0.0.0.0 --port 5173 &' >> /app/start.sh && \
    echo 'wait' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start services
CMD ["/app/start.sh"]