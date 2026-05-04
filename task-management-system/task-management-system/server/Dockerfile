FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Multer writes here; ensure it exists.
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
