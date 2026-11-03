FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node . .
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
