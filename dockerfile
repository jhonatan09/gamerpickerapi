# Imagem oficial do Puppeteer (vem com Chromium e dependências)
FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Seu package.json já tem "start": "node index.js"
CMD ["node", "index.js"]
