FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev \
  && npx puppeteer browsers install chrome

COPY . .

# Opcional: se quiser forçar via env
# ENV PUPPETEER_EXECUTABLE_PATH=/home/pptruser/.cache/puppeteer/chrome/linux-*/chrome

EXPOSE 8080
CMD ["node", "index.js"]
