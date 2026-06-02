FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dependencies
RUN npm ci --only=production
COPY . .

FROM node:20-alpine AS release
WORKDIR /app
COPY --from=dependencies /app /app
EXPOSE 5000
CMD ["node", "src/server.js"]
