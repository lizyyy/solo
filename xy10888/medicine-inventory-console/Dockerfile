FROM node:18-alpine AS builder

WORKDIR /app

COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN cd backend && npm install --production=false
RUN cd frontend && npm install --production=false

COPY backend ./backend
COPY frontend ./frontend

RUN cd backend && npm run init-db && npm run seed-data
RUN cd frontend && npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

RUN cd backend && npm install --production

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "backend/src/server.js"]
