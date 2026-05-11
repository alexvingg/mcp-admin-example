# Dockerfile dev — Vite dev server com hot-reload
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# docker-compose sobrescreve com --host 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
