# client/Dockerfile

# Use an official Node.js runtime as a parent image.
# The 'alpine' version is a lightweight distribution.
FROM node:20-alpine

# Set the working directory in the container to /usr/src/app
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
# This step is separate to leverage Docker's layer caching.
# Dependencies will only be re-installed if these files change.
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of your application's source code from the current directory
# into the container's working directory.
COPY . .

# Vite's dev server runs on port 5173 by default.
# Make this port available to services outside this container.
EXPOSE 5173

# The command to run when the container starts.
# This executes the "dev" script from your package.json.
CMD [ "npm", "run", "dev" ]
