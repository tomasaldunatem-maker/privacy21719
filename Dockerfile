# Imagen de producción: compila frontend y backend y los sirve desde un solo proceso Node.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/drizzle server/drizzle
COPY --from=build /app/server/mock-data server/mock-data
COPY --from=build /app/web/dist web/dist
USER node
WORKDIR /app/server
ENV PORT=4000
EXPOSE 4000
# Aplica migraciones, catálogo y (si SEED_DEMO=true) la clínica demo; luego arranca el servidor
CMD ["node", "dist/src/scripts/start-prod.js"]
