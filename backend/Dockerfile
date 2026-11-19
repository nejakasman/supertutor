
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

COPY app.js ./
COPY models ./models
COPY routes ./routes
COPY views ./views

EXPOSE 3000

CMD ["node", "app.js"]
