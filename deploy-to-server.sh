#!/bin/bash

# AI任务管理器一键部署脚本
# 使用方法: ./deploy-to-server.sh [服务器IP] [用户名]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_blue() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

# 检查参数
SERVER_IP=${1}
SERVER_USER=${2:-ubuntu}

if [ -z "$SERVER_IP" ]; then
    log_error "请提供服务器IP地址"
    echo "使用方法: $0 <服务器IP> [用户名]"
    echo "示例: $0 123.456.789.0 ubuntu"
    exit 1
fi

# 配置变量
PROJECT_NAME="ai-manager"
REMOTE_DIR="/tmp/${PROJECT_NAME}"
DEPLOY_DIR="/opt/${PROJECT_NAME}"

log_blue "===========================================" 
log_blue "     AI任务管理器一键部署开始"
log_blue "==========================================="
echo "服务器: ${SERVER_IP}"
echo "用户: ${SERVER_USER}"
echo "项目: ${PROJECT_NAME}"
echo ""

# 检查本地文件
check_local_files() {
    log_info "检查本地文件..."
    
    if [ ! -f "docker-compose.yml" ]; then
        log_error "未找到 docker-compose.yml 文件"
        exit 1
    fi
    
    if [ ! -f "Dockerfile" ]; then
        log_error "未找到 Dockerfile 文件"
        exit 1
    fi
    
    if [ ! -d "deploy" ]; then
        log_error "未找到 deploy 目录"
        exit 1
    fi
    
    log_info "本地文件检查完成"
}

# 测试SSH连接
test_ssh_connection() {
    log_info "测试SSH连接..."
    
    if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "echo 'SSH连接成功'" > /dev/null 2>&1; then
        log_info "SSH连接测试成功"
    else
        log_error "SSH连接失败，请检查："
        echo "  1. 服务器IP是否正确: ${SERVER_IP}"
        echo "  2. 用户名是否正确: ${SERVER_USER}"
        echo "  3. SSH密钥是否已配置"
        echo "  4. 服务器是否开放SSH端口(22)"
        exit 1
    fi
}

# 上传项目文件
upload_project() {
    log_info "上传项目文件到服务器..."
    
    # 创建远程目录
    ssh "${SERVER_USER}@${SERVER_IP}" "mkdir -p ${REMOTE_DIR}"
    
    # 排除不必要的文件
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude 'dist' \
        --exclude 'build' \
        --exclude '*.log' \
        --exclude '.env' \
        . "${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/"
    
    log_info "项目文件上传完成"
}

# 在服务器上执行部署
deploy_on_server() {
    log_info "在服务器上执行部署..."
    
    ssh "${SERVER_USER}@${SERVER_IP}" << 'ENDSSH'
set -e

# 颜色输出函数
log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

PROJECT_NAME="ai-manager"
REMOTE_DIR="/tmp/${PROJECT_NAME}"
DEPLOY_DIR="/opt/${PROJECT_NAME}"

log_info "开始服务器端部署..."

# 进入项目目录
cd ${REMOTE_DIR}

# 给脚本添加执行权限
chmod +x deploy/*.sh

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    log_info "安装Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    sudo systemctl start docker
    sudo systemctl enable docker
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    log_info "安装Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 创建部署目录
sudo mkdir -p ${DEPLOY_DIR}
sudo chown -R $USER:$USER ${DEPLOY_DIR}

# 复制文件到部署目录
cp -r . ${DEPLOY_DIR}/
cd ${DEPLOY_DIR}

# 创建环境变量文件
if [ ! -f ".env" ]; then
    log_info "创建环境变量文件..."
    cp .env.example .env
    
    # 生成随机密码
    REDIS_PASSWORD=$(openssl rand -base64 32)
    sed -i "s/yourRedisPassword123/${REDIS_PASSWORD}/g" .env
    
    log_warn "请编辑 ${DEPLOY_DIR}/.env 文件，配置豆包API密钥等参数"
fi

# 构建和启动服务
log_info "构建和启动服务..."
docker-compose down --remove-orphans || true
docker-compose build
docker-compose up -d

# 等待服务启动
log_info "等待服务启动..."
sleep 30

# 健康检查
log_info "执行健康检查..."
for i in {1..10}; do
    if curl -f http://localhost:3000/api/stats > /dev/null 2>&1; then
        log_info "✅ 服务启动成功！"
        break
    else
        if [ $i -eq 10 ]; then
            log_error "❌ 服务启动失败"
            docker-compose logs --tail=20
            exit 1
        fi
        log_info "等待服务启动... ($i/10)"
        sleep 10
    fi
done

# 清理临时目录
rm -rf ${REMOTE_DIR}

log_info "✅ 部署完成！"
echo ""
echo "访问地址："
echo "  Web界面: http://$(curl -s ifconfig.me):3000"
echo "  API接口: http://$(curl -s ifconfig.me):3000/api"
echo ""
echo "管理命令："
echo "  cd ${DEPLOY_DIR}"
echo "  docker-compose ps           # 查看服务状态"
echo "  docker-compose logs -f      # 查看日志"
echo "  ./deploy/monitor.sh all     # 运行监控检查"
ENDSSH
    
    log_info "服务器端部署完成"
}

# 显示部署后信息
show_post_deploy_info() {
    log_blue "===========================================" 
    log_blue "        部署完成！"
    log_blue "==========================================="
    echo ""
    log_info "访问信息："
    echo "  Web界面: http://${SERVER_IP}:3000"
    echo "  API接口: http://${SERVER_IP}:3000/api/stats"
    echo ""
    log_info "管理命令："
    echo "  连接服务器: ssh ${SERVER_USER}@${SERVER_IP}"
    echo "  进入目录: cd ${DEPLOY_DIR}"
    echo "  查看状态: docker-compose ps"
    echo "  查看日志: docker-compose logs -f"
    echo "  运行监控: ./deploy/monitor.sh all"
    echo ""
    log_warn "重要提醒："
    echo "  1. 请编辑服务器上的 ${DEPLOY_DIR}/.env 文件，配置豆包API密钥"
    echo "  2. 如有域名，请配置SSL证书"
    echo "  3. 建议配置防火墙和安全设置"
    echo ""
    log_info "配置环境变量："
    echo "  ssh ${SERVER_USER}@${SERVER_IP} 'nano ${DEPLOY_DIR}/.env'"
    echo ""
}

# 主函数
main() {
    check_local_files
    test_ssh_connection
    upload_project
    deploy_on_server
    show_post_deploy_info
}

# 执行主函数
main "$@"