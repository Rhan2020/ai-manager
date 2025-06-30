#!/bin/bash

# 远程服务器部署脚本

set -e

# 配置变量
REMOTE_HOST="my-tencent"
REMOTE_USER="ubuntu"
REMOTE_PATH="/opt/ai-manager"
PROJECT_NAME="ai-manager"

echo "🚀 开始部署到远程服务器: $REMOTE_HOST"

# 检查SSH连接
echo "🔍 检查SSH连接..."
if ! ssh -o ConnectTimeout=10 $REMOTE_HOST "echo 'SSH连接成功'" &> /dev/null; then
    echo "❌ 无法连接到远程服务器 $REMOTE_HOST"
    echo "请检查SSH配置或运行: ssh-copy-id $REMOTE_HOST"
    exit 1
fi

# 创建项目压缩包
echo "📦 打包项目文件..."
tar --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='*.log' \
    --exclude='.env.local' \
    -czf ${PROJECT_NAME}.tar.gz .

# 上传项目文件
echo "📤 上传项目到远程服务器..."
scp ${PROJECT_NAME}.tar.gz $REMOTE_HOST:/tmp/

# 在远程服务器上执行部署
echo "🔧 在远程服务器上执行部署..."
ssh $REMOTE_HOST << EOF
set -e

echo "📁 准备部署目录..."
sudo mkdir -p $REMOTE_PATH
sudo chown $REMOTE_USER:$REMOTE_USER $REMOTE_PATH
cd $REMOTE_PATH

echo "📂 解压项目文件..."
tar -xzf /tmp/${PROJECT_NAME}.tar.gz
rm -f /tmp/${PROJECT_NAME}.tar.gz

echo "🔧 安装系统依赖..."
# 更新包管理器
sudo apt update

# 安装Docker
if ! command -v docker &> /dev/null; then
    echo "安装Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $REMOTE_USER
    rm get-docker.sh
fi

# 安装Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "安装Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 安装Node.js (用于运行桌面端)
if ! command -v node &> /dev/null; then
    echo "安装Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "📦 安装项目依赖..."
npm install

echo "🔥 停止旧服务..."
docker-compose -f deploy/docker-compose.yml down --remove-orphans || true

echo "🔨 构建并启动服务..."
docker-compose -f deploy/docker-compose.yml up -d --build

echo "⏳ 等待服务启动..."
sleep 15

# 健康检查
echo "🔍 健康检查..."
for i in {1..30}; do
    if curl -f http://localhost/health &> /dev/null; then
        echo "✅ 远程服务启动成功！"
        break
    fi
    if [ \$i -eq 30 ]; then
        echo "❌ 服务启动超时，查看日志..."
        docker-compose -f deploy/docker-compose.yml logs --tail=50
        exit 1
    fi
    echo "等待服务响应... (\$i/30)"
    sleep 2
done

# 设置开机自启
echo "🔧 设置服务开机自启..."
cat > /tmp/ai-manager.service << EOL
[Unit]
Description=AI Manager Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$REMOTE_PATH
ExecStart=/usr/local/bin/docker-compose -f deploy/docker-compose.yml up -d
ExecStop=/usr/local/bin/docker-compose -f deploy/docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOL

sudo mv /tmp/ai-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ai-manager.service

echo "🎉 远程部署完成！"
EOF

# 清理本地临时文件
rm -f ${PROJECT_NAME}.tar.gz

# 获取远程服务器信息
echo "📊 获取部署信息..."
REMOTE_IP=$(ssh $REMOTE_HOST "curl -s ifconfig.me || curl -s ipinfo.io/ip || echo '未知'")

echo ""
echo "🎉 部署成功完成！"
echo "═══════════════════════════════════════"
echo "🌐 远程访问地址: http://$REMOTE_IP"
echo "🔧 SSH连接: ssh $REMOTE_HOST"
echo "📁 部署路径: $REMOTE_PATH"
echo "═══════════════════════════════════════"
echo ""
echo "📝 远程管理命令："
echo "  查看服务状态: ssh $REMOTE_HOST 'cd $REMOTE_PATH && docker-compose -f deploy/docker-compose.yml ps'"
echo "  查看日志: ssh $REMOTE_HOST 'cd $REMOTE_PATH && docker-compose -f deploy/docker-compose.yml logs -f'"
echo "  重启服务: ssh $REMOTE_HOST 'cd $REMOTE_PATH && docker-compose -f deploy/docker-compose.yml restart'"
echo "  停止服务: ssh $REMOTE_HOST 'cd $REMOTE_PATH && docker-compose -f deploy/docker-compose.yml down'"
echo ""
echo "🖥️  桌面端连接配置："
echo "  在desktop/config.json中设置serverHost为: $REMOTE_IP"
echo "  然后运行: npm run desktop"
echo ""

# 可选：自动打开浏览器
read -p "是否自动打开远程Web界面? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open http://$REMOTE_IP
    elif command -v open &> /dev/null; then
        open http://$REMOTE_IP
    else
        echo "请手动访问: http://$REMOTE_IP"
    fi
fi

echo "🎊 远程部署完成！祝您使用愉快！"