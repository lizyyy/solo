FROM node:18-alpine

WORKDIR /app

USER node

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
