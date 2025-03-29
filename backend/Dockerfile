# Use a Node.js base image
FROM node:22.14.0

# Set the working directory to /app
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port the app runs on
EXPOSE 9100

# Start the app with nodemon for hot reloading
CMD ["npm", "run", "dev"]