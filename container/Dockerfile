FROM node:20-alpine

# Install PostgreSQL client to get the physical pg_dump binary
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY index.js ./

CMD ["node", "index.js"]
