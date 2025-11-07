# OpenMemory - VPS Cloud Deployment (Semi-Cloud)

Deploy la versione avanzata di OpenMemory su un VPS cloud per avere il meglio di entrambi i mondi.

## 🎯 Vantaggi Semi-Cloud

✅ **Accesso da ovunque** - URL pubblico tipo `https://memory.tuodominio.com`
✅ **Sincronizzazione automatica** - Desktop e laptop accedono allo stesso backend
✅ **Controllo totale** - È il TUO server
✅ **Privacy** - Dati sul TUO VPS, non su cloud terzi
✅ **Features avanzate** - Tutte le funzionalità di OpenMemory avanzato
✅ **Costo basso** - $8-12/mese per VPS con 100k memorie

## 📋 Setup VPS

### Provider consigliati

| Provider | Piano | Costo/mese | Spec |
|----------|-------|------------|------|
| Hetzner | CPX21 | €8 (~$9) | 3 vCPU, 4GB RAM, 80GB SSD |
| DigitalOcean | Basic | $12 | 2 vCPU, 4GB RAM, 80GB SSD |
| Linode | Shared 4GB | $12 | 2 vCPU, 4GB RAM, 80GB SSD |
| OVH | VPS Starter | €6 (~$7) | 2 vCPU, 4GB RAM, 80GB SSD |

### 1. Crea VPS e connetti

```bash
# SSH nel VPS
ssh root@your-vps-ip

# Update sistema
apt update && apt upgrade -y

# Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 2. Deploy OpenMemory con Docker

```bash
# Clona repository
git clone https://github.com/CaviraOSS/OpenMemory.git
cd OpenMemory

# Copia configurazione
cp .env.example .env
nano .env  # Configura come preferisci

# Avvia con Docker
docker-compose up -d

# Verifica
docker-compose logs -f
```

### 3. Setup Nginx + SSL (Let's Encrypt)

```bash
# Installa Nginx
apt install nginx certbot python3-certbot-nginx -y

# Configura reverse proxy
cat > /etc/nginx/sites-available/openmemory <<EOF
server {
    listen 80;
    server_name memory.tuodominio.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Abilita config
ln -s /etc/nginx/sites-available/openmemory /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL gratuito con Let's Encrypt
certbot --nginx -d memory.tuodominio.com
```

### 4. Configurazione OpenMemory per produzione

```env
# .env
OM_PORT=8080
OM_API_KEY=your-strong-secret-key-here
OM_TIER=smart  # o deep se hai 16GB RAM
OM_METADATA_BACKEND=postgres  # Più robusto per produzione
OM_PG_HOST=localhost
OM_PG_DB=openmemory_prod
OM_PG_USER=openmemory
OM_PG_PASSWORD=secure-password-here

# Embeddings (scegli uno)
OM_EMBEDDINGS=openai
OPENAI_API_KEY=sk-...
# Oppure
OM_EMBEDDINGS=gemini
GEMINI_API_KEY=...
```

### 5. Configura Claude Code per usare VPS

Sul tuo laptop/desktop, modifica la configurazione MCP:

```bash
claude mcp remove openmemory-local

# Aggiungi VPS endpoint
claude mcp add openmemory-vps \
  --env OM_API_URL=https://memory.tuodominio.com \
  --env OM_API_KEY=your-strong-secret-key-here \
  -- node /path/to/mcp-client.js
```

Oppure accedi direttamente via HTTP API:

```bash
# Test da ovunque
curl -X POST https://memory.tuodominio.com/memory/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-strong-secret-key-here" \
  -d '{"query": "docker workflow", "k": 5}'
```

---

## 🔒 Security Best Practices

### Firewall

```bash
# UFW (Ubuntu/Debian)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable

# Blocca accesso diretto a porta 8080
# (solo Nginx può accedere)
```

### API Key Security

```bash
# Genera API key strong
openssl rand -base64 32
```

### Backup automatico

```bash
# Cron job per backup giornaliero
cat > /etc/cron.daily/openmemory-backup <<EOF
#!/bin/bash
docker exec openmemory-backend-1 sqlite3 /app/data/openmemory.sqlite .dump | gzip > /backups/openmemory-\$(date +%Y%m%d).sql.gz
# Mantieni solo ultimi 30 giorni
find /backups -name "openmemory-*.sql.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/openmemory-backup
```

---

## 📊 Monitoraggio

```bash
# Installa monitoring
docker run -d --name=prometheus \
  -p 9090:9090 \
  prom/prometheus

docker run -d --name=grafana \
  -p 3000:3000 \
  grafana/grafana
```

---

## 💰 Confronto Costi (100k memorie)

| Opzione | Costo/mese | Controllo | Privacy | Features |
|---------|------------|-----------|---------|----------|
| **Locale** | $0 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **VPS Semi-Cloud** | $8-12 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Cloud OpenMemory** | $? | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Altri (Pinecone/etc)** | $80-150 | ⭐ | ⭐ | ⭐⭐⭐⭐ |

---

## 🚀 Workflow Finale

Con VPS semi-cloud:

1. **Desktop WSL2** → `https://memory.tuodominio.com`
2. **Laptop Linux** → `https://memory.tuodominio.com`
3. **Mobile/altro** → `https://memory.tuodominio.com`

Tutti condividono lo stesso backend, sempre sincronizzati! 🎉

---

## 🔄 Migrazione da Locale a VPS

```bash
# 1. Backup database locale
sqlite3 ~/Projects/openmemory-local/backend/data/openmemory.sqlite .dump > backup.sql

# 2. Sul VPS, importa
cat backup.sql | docker exec -i openmemory-backend-1 sqlite3 /app/data/openmemory.sqlite

# 3. Restart
docker-compose restart
```

---

## 📚 Risorse

- Dashboard: `http://your-vps-ip:3000` (Grafana)
- API Docs: `https://memory.tuodominio.com/docs`
- Logs: `docker-compose logs -f`
- Status: `docker-compose ps`
