FROM ghcr.io/puppeteer/puppeteer:latest
ENV PUPPETEER_SKIP_DOWNLOAD=1
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
