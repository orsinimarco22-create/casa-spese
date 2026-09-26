# Dockerfile per il deploy cloud 24/7 di Casa & Spese
FROM node:22-alpine

WORKDIR /app

# Copia i file di configurazione
COPY package.json ./

# Copia il codice sorgente
COPY server.js database.js tunnel.js ./
COPY public/ ./public/

# Database iniziale pre-popolato di Marco ed Angela
COPY spese_coppia.db* ./

# Volume persistente per SQLite (sopravvive a riavvii e redeploy)
VOLUME ["/var/data"]

# Variabili di ambiente
ENV PORT=3000
ENV NODE_ENV=production
ENV NO_TUNNEL=1
ENV DB_PATH=/var/data/spese_coppia.db

EXPOSE 3000

# Avvio del server
CMD ["node", "server.js"]
