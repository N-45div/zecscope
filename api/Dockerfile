FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies (workspace-aware)
COPY package.json ./
COPY api/package.json ./api/
COPY lightwallet-protocol ./lightwallet-protocol/

RUN npm install

# Bundle source
COPY . .

# Build API
RUN npm run build --workspace api

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace", "api"]
