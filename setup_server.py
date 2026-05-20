"""Setup nginx, systemd, and start services on the server"""
import paramiko, time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('ying-G3-3590', username='ying', password='123321', timeout=15)

def sudo(cmd, wait=0):
    stdin, stdout, stderr = client.exec_command(
        "echo '123321' | sudo -S bash -c '%s' 2>&1" % cmd.replace("'", "'\"'\"'")
    )
    if wait: time.sleep(wait)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if err and 'authenticate' not in err:
        out += '\n' + err
    return out

def run(cmd, wait=0):
    stdin, stdout, stderr = client.exec_command(cmd)
    if wait: time.sleep(wait)
    return stdout.read().decode().strip()

# Step 3: Create .env
print('[3] Creating .env...')
env_content = """APP_NAME=KTrainer API
DEBUG=false
API_PREFIX=/api
DATABASE_URL=sqlite+aiosqlite:///./ktrainer.db
SECRET_KEY=krhythm-prod-secret-2026
ACCESS_TOKEN_EXPIRE_MINUTES=480
PARQUET_DIR=./data/parquet"""

sudo("cat > /home/ying/backend/.env << 'ENVEOF'\n%s\nENVEOF" % env_content)
print('  .env created')

# Step 4: Move frontend to nginx dir
print('[4] Setting up nginx...')
sudo('rm -rf /var/www/ktrainer')
sudo('mkdir -p /var/www/ktrainer')
sudo('cp -r /home/ying/frontend/* /var/www/ktrainer/')
out = run('ls /var/www/ktrainer/')
print(f'  Frontend: {out[:150]}')

# Nginx config
nginx_conf = """server {
    listen 80;
    server_name _;
    root /var/www/ktrainer;
    index index.html;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}"""

# Write nginx config via Python on remote
sudo("python3 -c \"open('/etc/nginx/sites-available/ktrainer','w').write('''%s''')\"" % nginx_conf.replace("'", "\\'"))
sudo('ln -sf /etc/nginx/sites-available/ktrainer /etc/nginx/sites-enabled/')
sudo('rm -f /etc/nginx/sites-enabled/default')
out = sudo('nginx -t 2>&1')
print(f'  nginx: {out[:120]}')

# Step 5: Create systemd service
print('[5] Creating systemd service...')
unit = """[Unit]
Description=K-Rhythm Backend API
After=network.target

[Service]
Type=simple
User=ying
WorkingDirectory=/home/ying/backend
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target"""

sudo("python3 -c \"open('/etc/systemd/system/ktrainer-backend.service','w').write('''%s''')\"" % unit.replace("'", "\\'"))
print('  Service created')

# Step 6: Start
print('[6] Starting services...')
sudo('systemctl daemon-reload')
sudo('systemctl enable ktrainer-backend')
sudo('systemctl restart ktrainer-backend')
sudo('systemctl enable nginx')
sudo('systemctl restart nginx')
time.sleep(5)

# Verify
print()
health = run('curl -s http://localhost:8000/health 2>&1')
print(f'  Backend: {health}')
http_code = run('curl -s -o /dev/null -w "%{http_code}" http://localhost:80/ 2>&1')
print(f'  Frontend HTTP: {http_code}')
kl = run('curl -s http://localhost:8000/api/kline/AAPL 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\"data\",{}).get(\"total\",0))" 2>&1')
print(f'  K-line bars: {kl}')

client.close()
print('\n=== Done! http://192.168.0.41 ===')
