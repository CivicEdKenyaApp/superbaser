FROM node:20-alpine

# Install PostgreSQL client CLI utilities (pg_dump, pg_restore, psql), curl, ca-certificates
RUN apk add --no-cache postgresql15-client curl ca-certificates tar bash

# Download & Install Backwyn Go Binary into /usr/local/bin/backwyn
RUN curl -fsSL "https://github.com/vncwr/backwyn/releases/latest/download/backwyn_linux_amd64.tar.gz" -o /tmp/backwyn.tar.gz 2>/dev/null || \
    curl -fsSL "https://raw.githubusercontent.com/vncwr/backwyn/main/scripts/install.sh" -o /tmp/install.sh 2>/dev/null || true \
    && if [ -f /tmp/backwyn.tar.gz ]; then \
         tar -xzf /tmp/backwyn.tar.gz -C /usr/local/bin/ backwyn 2>/dev/null || true; \
       fi \
    && chmod +x /usr/local/bin/backwyn 2>/dev/null || true

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY index.js ./
COPY runner.js ./

CMD ["node", "runner.js"]
