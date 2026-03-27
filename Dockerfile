FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY src/ ./src/

ENTRYPOINT ["node", "src/run.js"]
CMD ["--scenario=win", "--staggered"]
