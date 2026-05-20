#!/bin/bash
# K-Rhythm 一键部署脚本
# 用法: ./deploy.sh [target_host]
# 默认部署到 192.168.0.41

set -e

TARGET="${1:-192.168.0.41}"
TARGET_USER="${2:-root}"
PROJECT="ktrainer"
REMOTE_DIR="/opt/${PROJECT}"

echo "========================================="
echo " K-Rhythm 部署工具"
echo " 目标: ${TARGET_USER}@${TARGET}:${REMOTE_DIR}"
echo "========================================="

# 1. 构建前端
echo ""
echo "[1/4] 构建前端..."
cd "$(dirname "$0")/frontend"
npm install --silent 2>/dev/null || npm install
npm run build
echo "  ✓ 前端构建完成"

# 2. 准备部署包
echo ""
echo "[2/4] 打包项目文件..."
cd "$(dirname "$0")"
TMPDIR=$(mktemp -d)
mkdir -p "${TMPDIR}/${PROJECT}"

# 复制必要文件
cp -r docker-compose.yml "${TMPDIR}/${PROJECT}/"
cp -r backend "${TMPDIR}/${PROJECT}/"
cp -r frontend/dist "${TMPDIR}/${PROJECT}/frontend-dist/"

# 创建生产环境 nginx 配置
cat > "${TMPDIR}/${PROJECT}/nginx.conf" << 'NGINX'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX

# 创建后端 Dockerfile（简化版，不需要 PostgreSQL）
cat > "${TMPDIR}/${PROJECT}/Dockerfile.backend" << 'DOCKERFILE'
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
RUN mkdir -p data/parquet/us data/parquet/cn data/events
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
DOCKERFILE

# 创建前端 Dockerfile
cat > "${TMPDIR}/${PROJECT}/Dockerfile.frontend" << 'DOCKERFILE'
FROM nginx:alpine
COPY frontend-dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

# 创建 docker-compose.yml
cat > "${TMPDIR}/${PROJECT}/docker-compose.yml" << 'COMPOSE'
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: ktrainer-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - APP_NAME=KTrainer API
      - DEBUG=false
      - API_PREFIX=/api
      - DATABASE_URL=sqlite+aiosqlite:///./ktrainer.db
      - SECRET_KEY=krhythm-prod-secret-2026
      - ACCESS_TOKEN_EXPIRE_MINUTES=480
      - PARQUET_DIR=./data/parquet
    volumes:
      - ktrainer_data:/app/data

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: ktrainer-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  ktrainer_data:
COMPOSE

echo "  ✓ 部署包已准备: ${TMPDIR}/${PROJECT}"

# 3. 上传到目标服务器
echo ""
echo "[3/4] 上传到 ${TARGET}..."
cd "${TMPDIR}"
tar czf "${PROJECT}.tar.gz" "${PROJECT}"
scp "${PROJECT}.tar.gz" "${TARGET_USER}@${TARGET}:/tmp/"
echo "  ✓ 上传完成"

# 4. 远程部署
echo ""
echo "[4/4] 远程部署..."
ssh "${TARGET_USER}@${TARGET}" << 'ENDSSH'
set -e
PROJECT="ktrainer"
REMOTE_DIR="/opt/${PROJECT}"

# 停止旧服务
cd "${REMOTE_DIR}" 2>/dev/null && docker compose down 2>/dev/null || true

# 解压
rm -rf "${REMOTE_DIR}"
mkdir -p "${REMOTE_DIR}"
cd /tmp
tar xzf "${PROJECT}.tar.gz" -C /opt/
mv "/opt/${PROJECT}" "${REMOTE_DIR}" 2>/dev/null || true

# 构建并启动
cd "${REMOTE_DIR}"
docker compose build
docker compose up -d

echo ""
echo "========================================="
echo " 部署完成!"
echo " 前端: http://$(hostname -I | awk '{print $1}')"
echo " API:  http://$(hostname -I | awk '{print $1}'):8000/docs"
echo "========================================="
ENDSSH

# 清理
rm -rf "${TMPDIR}"
echo ""
echo "全部完成! 访问 http://${TARGET} 查看系统"
