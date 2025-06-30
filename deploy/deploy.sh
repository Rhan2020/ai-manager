#!/bin/bash

# AI任务管理器部署脚本
# 使用方法: ./deploy.sh [environment]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
ENVIRONMENT=${1:-production}
PROJECT_NAME="ai-manager"
DEPLOY_DIR="/opt/${PROJECT_NAME}"
BACKUP_DIR="/opt/${PROJECT_NAME}-backups"

log_info "开始部署 AI任务管理器到 ${ENVIRONMENT} 环境..."

# 检查Docker和Docker Compose
if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建目录
log_info "创建部署目录..."
sudo mkdir -p ${DEPLOY_DIR}
sudo mkdir -p ${BACKUP_DIR}
sudo mkdir -p ${DEPLOY_DIR}/logs
sudo mkdir -p ${DEPLOY_DIR}/ssl
sudo mkdir -p ${DEPLOY_DIR}/nginx/conf.d

# 设置权限
sudo chown -R $(whoami):$(whoami) ${DEPLOY_DIR}

# 备份当前版本
if [ -f "${DEPLOY_DIR}/docker-compose.yml" ]; then
    log_info "备份当前版本..."
    BACKUP_NAME="${PROJECT_NAME}-backup-$(date +%Y%m%d_%H%M%S)"
    sudo cp -r ${DEPLOY_DIR} ${BACKUP_DIR}/${BACKUP_NAME}
    log_info "备份完成: ${BACKUP_DIR}/${BACKUP_NAME}"
fi

# 停止现有服务
if [ -f "${DEPLOY_DIR}/docker-compose.yml" ]; then
    log_info "停止现有服务..."
    cd ${DEPLOY_DIR}
    docker-compose down
fi

# 复制新文件
log_info "复制配置文件..."
cp docker-compose.yml ${DEPLOY_DIR}/
cp -r nginx/ ${DEPLOY_DIR}/
cp -r deploy/ ${DEPLOY_DIR}/

# 创建环境变量文件
if [ ! -f "${DEPLOY_DIR}/.env" ]; then
    log_info "创建环境变量文件..."
    cat > ${DEPLOY_DIR}/.env << EOF
# AI任务管理器环境变量
NODE_ENV=${ENVIRONMENT}
PORT=3000

# Redis配置
REDIS_PASSWORD=$(openssl rand -base64 32)

# 数据库配置 (如果需要)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=ai_manager
# DB_USER=ai_manager
# DB_PASSWORD=$(openssl rand -base64 32)

# SSL证书路径 (Let's Encrypt)
SSL_CERT_PATH=/etc/nginx/ssl/fullchain.pem
SSL_KEY_PATH=/etc/nginx/ssl/privkey.pem

# 豆包API配置 (请根据实际情况配置)
# DOUBAO_API_KEY=your_api_key_here
# DOUBAO_API_URL=https://ark.cn-beijing.volces.com/api/v3

# 监控配置
# SENTRY_DSN=your_sentry_dsn_here
EOF
    log_warn "请编辑 ${DEPLOY_DIR}/.env 文件，配置你的API密钥等敏感信息"
fi

# 进入部署目录
cd ${DEPLOY_DIR}

# 拉取最新镜像
log_info "拉取Docker镜像..."
docker-compose pull

# 构建镜像 (如果使用本地构建)
log_info "构建应用镜像..."
docker-compose build

# 启动服务
log_info "启动服务..."
docker-compose up -d

# 等待服务启动
log_info "等待服务启动..."
sleep 30

# 健康检查
log_info "执行健康检查..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:3000/api/stats > /dev/null 2>&1; then
        log_info "✅ 服务健康检查通过"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_warn "健康检查失败，重试 $RETRY_COUNT/$MAX_RETRIES..."
        sleep 10
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "❌ 服务启动失败，健康检查超时"
    log_info "查看服务日志:"
    docker-compose logs --tail=50
    exit 1
fi

# 显示服务状态
log_info "服务状态:"
docker-compose ps

# 设置自动启动
log_info "设置服务自动启动..."
sudo tee /etc/systemd/system/${PROJECT_NAME}.service > /dev/null << EOF
[Unit]
Description=AI任务管理器
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${DEPLOY_DIR}
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ${PROJECT_NAME}

# 配置日志轮转
log_info "配置日志轮转..."
sudo tee /etc/logrotate.d/${PROJECT_NAME} > /dev/null << EOF
${DEPLOY_DIR}/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        docker-compose -f ${DEPLOY_DIR}/docker-compose.yml exec ai-manager kill -USR1 1 2>/dev/null || true
    endscript
}
EOF

# 清理旧镜像
log_info "清理未使用的Docker镜像..."
docker image prune -f

log_info "🎉 部署完成!"
log_info "应用地址: http://localhost:3000"
log_info "API文档: http://localhost:3000/api/stats"
log_info "查看日志: docker-compose logs -f"
log_info "停止服务: docker-compose down"
log_info "重启服务: docker-compose restart"

# SSL证书提醒
log_warn "请确保配置SSL证书:"
log_warn "1. 使用Let's Encrypt: certbot --nginx -d your-domain.com"
log_warn "2. 或者将证书文件放在 ${DEPLOY_DIR}/ssl/ 目录下"
log_warn "3. 更新nginx配置中的域名"