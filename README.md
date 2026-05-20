# K-Rhythm - K线训练系统

> **A股 / 美股 AI 复盘训练平台** —— 在历史K线中练习买卖，AI 智能复盘你的交易决策。

![K-Rhythm](https://img.shields.io/badge/K--Rhythm-K%E7%BA%BF%E8%AE%AD%E7%BB%83%E5%B9%B3%E5%8F%B0-blue)
![Python](https://img.shields.io/badge/Python-3.11+-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## 功能特性

### 核心训练
- **K线浏览** — 支持 A股（实时+历史）和 美股（真实历史数据），逐根推进复盘
- **买入 / 卖出 / 观望** — 三按钮操作，模拟真实买卖流程
- **资金管理** — 实时账户资金、持仓占用、盈亏计算
- **AI 复盘** — 每次复盘结束后，AI 根据买卖记录分析交易决策

### 技术亮点
- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Zustand 状态管理
- **图表**：lightweight-charts（TradingView开源库）+ ECharts 指标
- **后端**：Python FastAPI + SQLAlchemy + Alembic 数据库迁移
- **数据**：Parquet 列式存储缓存，支持沪深/港股/美股多市场

---

## 项目结构

```
k-rhythm/
├── frontend/                 # React 前端 (Vite + TypeScript)
│   ├── src/
│   │   ├── api/             # API 调用层
│   │   ├── components/      # React 组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── pages/           # 页面
│   │   ├── stores/          # Zustand 状态管理
│   │   └── types/           # TypeScript 类型定义
│   └── nginx.conf
├── backend/                  # Python 后端 (FastAPI)
│   ├── app/
│   │   ├── api/             # API 路由
│   │   ├── core/            # 核心逻辑
│   │   ├── models/          # SQLAlchemy 模型
│   │   └── services/        # 业务服务
│   ├── scripts/             # 数据初始化脚本
│   ├── data/                # 数据存储 (parquet/events)
│   └── tests/               # 单元测试
├── server_configs/           # 服务器部署配置
├── docker-compose.yml        # 容器编排
└── deploy.sh                 # 一键部署脚本
```

---

## 快速开始

### 前置条件
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose（可选，用于部署）

### 本地开发

**1. 启动后端**
```bash
cd backend
cp .env.example .env       # 填写 AK/SK
pip install -r requirements.txt
alembic upgrade head       # 初始化数据库
uvicorn app.main:app --reload --port 8000
```

**2. 启动前端**
```bash
cd frontend
cp .env.example .env       # 配置 VITE_API_URL
npm install
npm run dev
```

**3. 访问**
- 前端：http://localhost:5173
- API：http://localhost:8000/docs

### Docker 部署（推荐生产环境）

```bash
# 一键部署到服务器
scp ktrainer-deploy.tar.gz root@your-server:/opt/
ssh root@your-server
cd /opt/ktrainer && bash deploy.sh
```

> 详细部署说明见 [DEPLOY.md](DEPLOY.md)

---

## API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/symbols` | GET | 获取股票列表 |
| `/api/kline/{symbol}` | GET | 获取K线数据 |
| `/api/sessions` | POST | 创建复盘会话 |
| `/api/sessions/{id}/next` | POST | 推进一根K线 |
| `/api/sessions/{id}/trades` | POST | 记录交易 |
| `/api/sessions/{id}/ai-review` | POST | AI 复盘 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 |
| 状态管理 | Zustand |
| 图表库 | lightweight-charts, ECharts |
| 后端框架 | FastAPI (Python 3.11) |
| ORM | SQLAlchemy + Alembic |
| 数据库 | SQLite (dev) / PostgreSQL (prod) |
| 缓存 | Parquet 文件存储 |

---

## License

MIT
