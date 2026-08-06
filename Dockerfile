# Otobüs Rezervasyon ve Satış Sistemi
FROM node:22-slim

# better-sqlite3 için gerekli derleme araçları (hazır ikili yoksa)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /uygulama

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/veri

# Verilerin kalıcı olması için bu klasörü bir birime (volume) bağlayın
VOLUME ["/veri"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/saglik').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
