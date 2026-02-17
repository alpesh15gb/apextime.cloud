FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# Install ALL dependencies (including dev) to ensure prisma CLI is available
RUN npm ci

COPY prisma ./prisma
# Generate Prisma Client
RUN npx prisma generate

COPY . .

# Expose backend port
EXPOSE 5001

CMD ["node", "src/index.js"]
