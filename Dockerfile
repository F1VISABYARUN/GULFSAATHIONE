# Gulf Saathi harness server
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install --no-save tsx@4
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
