FROM oven/bun:1.4.3 AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build && bun install --production --frozen-lockfile

FROM oven/bun:1.4.3

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    STORE_DB_PATH=/data/store.sqlite \
    UPLOAD_DIR=/data/uploads

COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["bun", "run", "src/server/index.ts"]
