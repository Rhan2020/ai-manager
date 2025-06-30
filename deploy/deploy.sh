#!/bin/bash

# AI任务管家系统一键部署脚本

set -e

echo "🚀 开始部署AI任务管家系统..."

# 检查Docker和Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建目录结构..."
mkdir -p data logs ssl

# 设置权限
sudo chown -R $USER:$USER data logs

# 停止并删除现有容器
echo "🛑 停止现有服务..."
docker-compose -f deploy/docker-compose.yml down --remove-orphans

# 清理旧镜像（可选）
read -p "是否清理旧的Docker镜像? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 清理旧镜像..."
    docker image prune -f
    docker-compose -f deploy/docker-compose.yml down --rmi all
fi

# 构建和启动服务
echo "🔨 构建镜像..."
docker-compose -f deploy/docker-compose.yml build --no-cache

echo "🚀 启动服务..."
docker-compose -f deploy/docker-compose.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📋 检查服务状态..."
docker-compose -f deploy/docker-compose.yml ps

# 健康检查
echo "🔍 执行健康检查..."
for i in {1..30}; do
    if curl -f http://localhost/health &> /dev/null; then
        echo "✅ 服务启动成功！"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ 服务启动超时，请检查日志"
        docker-compose -f deploy/docker-compose.yml logs
        exit 1
    fi
    echo "等待服务响应... ($i/30)"
    sleep 2
done

# 显示访问信息
echo ""
echo "🎉 部署完成！"
echo "═══════════════════════════════════════"
echo "📱 Web界面: http://localhost"
echo "🔧 API接口: http://localhost/api"
echo "📊 健康检查: http://localhost/health"
echo "═══════════════════════════════════════"
echo ""
echo "📝 管理命令："
echo "  查看日志: docker-compose -f deploy/docker-compose.yml logs -f"
echo "  停止服务: docker-compose -f deploy/docker-compose.yml down"
echo "  重启服务: docker-compose -f deploy/docker-compose.yml restart"
echo "  查看状态: docker-compose -f deploy/docker-compose.yml ps"
echo ""
echo "🔧 桌面端管家："
echo "  进入项目目录，运行: npm run desktop"
echo "  首次使用请设置豆包API密钥: apikey <your-api-key>"
echo ""

# 可选：自动打开浏览器
read -p "是否自动打开浏览器? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost
    elif command -v open &> /dev/null; then
        open http://localhost
    else
        echo "请手动访问: http://localhost"
    fi
fi

echo "🎊 部署完成！祝您使用愉快！"