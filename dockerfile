# Dockerfile
FROM ghcr.io/puppeteer/puppeteer:latest

# Aponta para o Chrome instalado na imagem
ENV PUPPETEER_BROWSER=chrome \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 8080
CMD ["node", "index.js"]