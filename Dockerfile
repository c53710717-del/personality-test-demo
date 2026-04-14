FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY common/package.json ./common/

RUN npm install --omit=dev

COPY common ./common
COPY server ./server

WORKDIR /app/server

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/index.js"]
