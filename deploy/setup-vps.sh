#!/bin/bash
# ===== MoraJunto — Setup VPS (Ubuntu 22.04+) =====
# Rodar como root: bash setup-vps.sh
#
# ANTES DE RODAR:
# 1. Troque a senha root: passwd
# 2. Aponte o domínio (DNS A record) para o IP do servidor
# 3. Edite DOMAIN abaixo com seu domínio real

set -e

DOMAIN="morajunto.com.br"
APP_DIR="/var/www/morajunto"
APP_USER="morajunto"

echo "===== MoraJunto VPS Setup ====="
echo "Domínio: $DOMAIN"
echo ""

# 1. Atualizar sistema
echo "[1/8] Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependências
echo "[2/8] Instalando Node.js 22, Nginx, Certbot..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx git ufw

# 3. Instalar PM2
echo "[3/8] Instalando PM2..."
npm install -g pm2

# 4. Criar usuário da aplicação (sem sudo)
echo "[4/8] Criando usuário $APP_USER..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
fi

# 5. Configurar firewall
echo "[5/8] Configurando firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 6. Criar diretório da aplicação
echo "[6/8] Preparando diretório..."
mkdir -p "$APP_DIR"
mkdir -p /var/log/morajunto
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" /var/log/morajunto

# 7. Configurar Nginx
echo "[7/8] Configurando Nginx..."
cat > /etc/nginx/sites-available/morajunto << 'NGINX'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        client_max_body_size 10M;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
}
NGINX

# Substituir placeholder pelo domínio real
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/morajunto

# Ativar site
ln -sf /etc/nginx/sites-available/morajunto /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "[8/8] Setup base concluído!"
echo ""
echo "===== PRÓXIMOS PASSOS ====="
echo ""
echo "1. Copie o projeto para o servidor:"
echo "   scp -r . root@SEU_IP:/var/www/morajunto/"
echo ""
echo "2. No servidor, configure o .env:"
echo "   nano /var/www/morajunto/.env"
echo "   # Atualize BASE_URL=https://$DOMAIN"
echo "   # Atualize CORS_ORIGINS=https://$DOMAIN"
echo "   # Atualize NODE_ENV=production"
echo "   # Atualize FACEBOOK_CALLBACK_URL=https://$DOMAIN/api/auth/facebook/callback"
echo ""
echo "3. Instale dependências e inicie:"
echo "   cd /var/www/morajunto"
echo "   chown -R morajunto:morajunto ."
echo "   su - morajunto -c 'cd /var/www/morajunto && npm install --production'"
echo "   su - morajunto -c 'cd /var/www/morajunto && pm2 start ecosystem.config.js'"
echo "   su - morajunto -c 'pm2 save'"
echo "   env PATH=\$PATH:/usr/bin pm2 startup systemd -u morajunto --hp /home/morajunto"
echo ""
echo "4. Ative HTTPS (depois do DNS apontar pro IP):"
echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "5. Teste:"
echo "   curl https://$DOMAIN/api/status"
echo ""
echo "6. Seed admin:"
echo "   curl -X POST https://$DOMAIN/api/auth/admin/seed -H 'Content-Type: application/json' -d '{\"seedKey\":\"SUA_ADMIN_SEED_KEY\"}'"
