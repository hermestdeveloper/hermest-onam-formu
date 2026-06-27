# Deploy Runbook — onam.hermestclinic.net

Target: Hetzner host (root, SSH key auth). nginx + certbot already installed (serving n8n.hermestclinic.net). DNS A record `onam.hermestclinic.net` → host already set.

## 1. Get the code on the server
    mkdir -p /opt/hermest-onam
    # rsync from local OR git clone; then:
    cd /opt/hermest-onam

## 2. Create the server-side .env (never committed)
    cat > /opt/hermest-onam/.env <<'EOF'
    CRM_BASE_URL=https://<real-crm-host>
    CRM_API_KEY=crm_xxx
    EOF
    chmod 600 /opt/hermest-onam/.env

## 3. Build + run the container
    cd /opt/hermest-onam
    docker compose up -d --build
    curl -I http://127.0.0.1:3000        # expect HTTP 200

## 4. nginx vhost
    cp deploy/nginx/onam.hermestclinic.net.conf /etc/nginx/sites-available/onam.hermestclinic.net
    ln -s /etc/nginx/sites-available/onam.hermestclinic.net /etc/nginx/sites-enabled/
    nginx -t
    systemctl reload nginx

## 5. HTTPS
    certbot --nginx -d onam.hermestclinic.net
    # auto-renew already handled by certbot.timer

## 6. Verify
    curl -I https://onam.hermestclinic.net    # expect HTTP 200
    # Then run the manual end-to-end checklist (search → select → images → download → CRM upload).

## Redeploy (after code changes)
    cd /opt/hermest-onam
    git pull   # or rsync
    docker compose up -d --build
