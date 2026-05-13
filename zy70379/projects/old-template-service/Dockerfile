FROM node:14-alpine

WORKDIR /usr/src/app

USER root

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=60s --timeout=30s --retries=2 --start-period=60s \
  CMD curl -f http://localhost:3000/healthz || exit 1

CMD ["npm", "start"]
