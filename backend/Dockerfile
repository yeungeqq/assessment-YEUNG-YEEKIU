FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache \
  libreoffice \
  font-carlito \
  font-noto \
  font-noto-cjk \
  font-noto-emoji \
  ttf-dejavu \
  ttf-liberation \
  fontconfig

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["npm", "run", "start"]
