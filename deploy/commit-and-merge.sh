#!/bin/bash

# 代码提交和合并脚本

set -e

echo "🚀 开始提交代码并合并到main分支..."

# 检查Git状态
if ! git status &> /dev/null; then
    echo "❌ 当前目录不是Git仓库"
    exit 1
fi

# 获取当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 当前分支: $CURRENT_BRANCH"

# 添加所有更改
echo "📁 添加文件到暂存区..."
git add .

# 检查是否有更改
if git diff --cached --quiet; then
    echo "ℹ️  没有检测到文件更改"
    exit 0
fi

# 显示更改的文件
echo "📝 待提交的更改:"
git diff --cached --name-only

# 确认提交
read -p "是否继续提交? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消提交"
    exit 1
fi

# 提交更改
COMMIT_MESSAGE="🎉 完整的AI任务管家系统重构

✨ 新增功能:
- 🏗️ 重构为三层架构 (桌面端管家 + Web界面 + 服务端API)
- 🤖 完整的智能体管理系统 (创建、编辑、删除)
- 🔗 豆包API集成，支持多种模型
- 📡 WebSocket实时通信
- 💾 数据持久化存储
- 🐳 Docker容器化部署
- 🚀 一键部署脚本 (本地 + 远程服务器)

🔧 技术栈:
- 前端: React + TypeScript + Tailwind CSS
- 后端: Node.js + Express + WebSocket
- 桌面端: Node.js + 豆包API客户端
- 部署: Docker + Docker Compose + Nginx

📦 部署说明:
- 本地部署: ./deploy/deploy.sh
- 远程部署: ./deploy/remote-deploy.sh
- 桌面端: npm run desktop

🔑 配置:
- 需要设置豆包API密钥
- 支持SSH部署到my-tencent服务器"

echo "💾 提交更改..."
git commit -m "$COMMIT_MESSAGE"

# 切换到main分支并合并
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "🔄 切换到main分支..."
    
    # 检查main分支是否存在
    if git show-ref --verify --quiet refs/heads/main; then
        git checkout main
    else
        echo "📌 创建main分支..."
        git checkout -b main
    fi
    
    echo "🔀 合并 $CURRENT_BRANCH 分支到main..."
    git merge $CURRENT_BRANCH --no-ff -m "🔀 合并功能分支: $CURRENT_BRANCH"
else
    echo "✅ 已在main分支上"
fi

# 推送到远程仓库
echo "📤 推送到远程仓库..."
if git remote get-url origin &> /dev/null; then
    # 推送main分支
    git push origin main
    
    # 如果有其他分支也推送
    if [ "$CURRENT_BRANCH" != "main" ]; then
        git push origin $CURRENT_BRANCH
    fi
    
    echo "✅ 代码已推送到远程仓库"
else
    echo "ℹ️  没有配置远程仓库，跳过推送"
fi

# 显示提交信息
echo ""
echo "📊 提交摘要:"
echo "═══════════════════════════════════════"
git log --oneline -5
echo "═══════════════════════════════════════"

echo ""
echo "🎉 代码提交和合并完成！"
echo ""
echo "🚀 下一步操作:"
echo "  1. 部署到服务器: ./deploy/remote-deploy.sh"
echo "  2. 本地测试: ./deploy/deploy.sh"
echo "  3. 启动桌面端: npm run desktop"
echo ""
echo "📝 重要提醒:"
echo "  - 确保配置豆包API密钥"
echo "  - 检查SSH连接配置 (my-tencent)"
echo "  - 验证Docker环境"
echo ""

echo "🎊 感谢使用AI任务管家系统！"