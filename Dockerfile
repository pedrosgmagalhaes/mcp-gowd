# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/dist/ dist/
RUN npm ci --omit=dev

ENV GOWD_TRANSPORT=http
ENV PORT=3002

EXPOSE 3002

CMD ["node", "dist/index.js"]
