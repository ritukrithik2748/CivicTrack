# Use Node.js 20 as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the client
RUN npm run build --workspace=client

# Expose port
EXPOSE 5000

# Start the server
CMD ["npm", "start"]