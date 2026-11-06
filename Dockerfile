FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY shared shared
COPY server server
COPY client client
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
