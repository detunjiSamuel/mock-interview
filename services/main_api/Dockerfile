FROM node:22-alpine

WORKDIR /app

# Copy package.json and package-lock.json first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create directory for file storage
RUN mkdir -p /app/storage

# Expose the port the app runs on
EXPOSE 8080

# Start the application
CMD ["node", "server.js"]