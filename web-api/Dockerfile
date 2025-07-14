# Dockerfile for game-server/ and web-api/
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application's code
COPY . .

# Expose the port the app runs on (update port for each service)
EXPOSE 3000

# The command to run your application
CMD [ "npm", "run", "dev" ]
