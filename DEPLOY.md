# K-Rhythm 部署指南 (Ubuntu)

## 前置条件

Ubuntu 服务器需安装：
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker --now
```

## 方式一：一键部署（推荐）

```bash
# 1. 将部署包拷贝到服务器
scp /tmp/ktrainer-deploy.tar.gz root@192.168.0.41:/tmp/

# 2. SSH 到服务器执行
ssh root@192.168.0.41
cd /tmp
tar xzf ktrainer-deploy.tar.gz
cd ktrainer
bash deploy.sh
```

## 方式二：手动部署

### 1. 拷贝文件到服务器
```bash
# 在本地执行
scp /tmp/ktrainer-deploy.tar.gz root@192.168.0.41:/opt/
```

### 2. 在服务器上解压
```bash
ssh root@192.168.0.41
cd /opt
tar xzf ktrainer-deploy.tar.gz
```

### 3. 构建并启动
```bash
cd /opt/ktrainer

# 构建 Docker 镜像
docker compose build

# 启动服务
docker compose up -d

# 查看状态
docker compose ps
docker compose logs -f
```

### 4. 验证
```bash
# 健康检查
curl http://localhost:8000/health
# → {"status":"healthy"}

# K线数据
curl http://localhost:8000/api/kline/AAPL
# → 返回 2500 根K线
```

## 访问

| 服务 | 地址 |
|------|------|
| 前端页面 | http://192.168.0.41 |
| API 文档 | http://192.168.0.41:8000/docs |
| 健康检查 | http://192.168.0.41:8000/health |

## 常用运维命令

```bash
# 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新部署（重新构建）
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 目录结构（部署后）

```
/opt/ktrainer/
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── Dockerfile.nginx
├── backend/          # Python FastAPI
│   ├── app/
│   ├── data/
│   │   ├── events/   # 美股事件JSON
│   │   └── parquet/  # K线缓存
│   └── requirements.txt
└── frontend-dist/    # 前端静态文件
```
