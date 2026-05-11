# Dockerfile dev — Node 20 alpine, hot-reload via tsx watch
FROM node:20-alpine

WORKDIR /app

# Postgres client tools são úteis pra debug (psql, pg_isready) e openssl é exigido pelo Prisma
RUN apk add --no-cache openssl postgresql-client

# Instala dependências primeiro pra cachear a layer
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# O código vem via volume mount em dev — esse COPY é só pra builds standalone
COPY . .

# Gera o Prisma Client (precisa do schema)
RUN npx prisma generate

EXPOSE 3001

# Comando default; o docker-compose sobrescreve com migrate+seed+dev
CMD ["npm", "run", "dev"]
