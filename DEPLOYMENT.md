# AI任务管理器部署指南

本文档提供AI任务管理器的完整部署指南，包括Docker部署、CI/CD配置和生产环境部署。

## 🚀 快速开始

### 1. 环境要求

- **操作系统**: Ubuntu 18.04+, CentOS 7+, 或其他支持Docker的Linux发行版
- **硬件要求**: 
  - CPU: 2核+
  - 内存: 4GB+
  - 磁盘: 20GB+
- **软件要求**:
  - Docker 20.10+
  - Docker Compose 2.0+
  - Git

### 2. SSH配置

首先配置SSH连接到你的服务器：

```bash
# 创建SSH配置目录
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 复制SSH配置示例
cp deploy/ssh-config-example ~/.ssh/config
chmod 600 ~/.ssh/config

# 编辑SSH配置，替换服务器信息
nano ~/.ssh/config
```

配置示例：
```
Host my-tencent
    HostName 你的服务器IP
    User ubuntu
    Port 22
    IdentityFile ~/.ssh/id_rsa
```

### 3. 一键部署

```bash
# 方式1: 使用部署脚本 (推荐)
./deploy/deploy.sh production

# 方式2: 手动部署
scp -r . my-tencent:/tmp/ai-manager/
ssh my-tencent "cd /tmp/ai-manager && ./deploy/deploy.sh"
```

## 📦 Docker部署

### 本地开发环境

```bash
# 启动开发环境
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 生产环境部署

```bash
# 1. 安装Docker (如果需要)
./deploy/install-docker.sh

# 2. 克隆项目
git clone <your-repo-url> /opt/ai-manager
cd /opt/ai-manager

# 3. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 4. 启动服务
docker-compose -f docker-compose.yml up -d

# 5. 验证部署
curl http://localhost:3000/api/stats
```

## 🔧 配置说明

### 环境变量配置

复制 `.env.example` 为 `.env` 并修改以下关键配置：

```bash
# 豆包AI API配置 (必须配置)
DOUBAO_API_KEY=your_api_key_here
DOUBAO_API_URL=https://ark.cn-beijing.volces.com/api/v3

# Redis密码 (建议修改)
REDIS_PASSWORD=your_secure_password

# 应用配置
NODE_ENV=production
PORT=3000
```

### Nginx配置

1. 修改域名配置：
```bash
nano nginx/conf.d/ai-manager.conf
# 将 your-domain.com 替换为你的实际域名
```

2. SSL证书配置：
```bash
# 使用Let's Encrypt (推荐)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 或手动放置证书文件
mkdir -p ssl/
cp your-cert.pem ssl/fullchain.pem
cp your-key.pem ssl/privkey.pem
```

## 🚀 CI/CD配置

### GitHub Actions

1. **设置仓库密钥**：
   在GitHub仓库的Settings > Secrets and variables > Actions中添加：

   ```
   SSH_PRIVATE_KEY: 你的SSH私钥内容
   SERVER_HOST: 服务器IP地址
   SERVER_USER: SSH用户名 (如: ubuntu)
   ```

2. **推送代码触发部署**：
   ```bash
   git push origin main  # 自动触发部署
   ```

### 手动部署流程

```bash
# 1. 连接服务器
ssh my-tencent

# 2. 进入部署目录
cd /opt/ai-manager

# 3. 拉取最新代码
git pull origin main

# 4. 重新构建和部署
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 5. 验证部署
./deploy/monitor.sh health
```

## 📊 监控和维护

### 使用监控脚本

```bash
# 检查所有状态
./deploy/monitor.sh all

# 检查特定状态
./deploy/monitor.sh status    # 服务状态
./deploy/monitor.sh health    # 健康检查
./deploy/monitor.sh resources # 资源使用
./deploy/monitor.sh logs      # 查看日志
./deploy/monitor.sh test      # 性能测试

# 生成监控报告
./deploy/monitor.sh report
```

### 常用运维命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f ai-manager
docker-compose logs -f nginx
docker-compose logs -f redis

# 重启服务
docker-compose restart ai-manager

# 更新服务
docker-compose pull
docker-compose up -d

# 备份数据
docker-compose exec ai-manager tar -czf /app/backup-$(date +%Y%m%d).tar.gz /app/data

# 恢复数据
docker-compose exec ai-manager tar -xzf /app/backup-20240101.tar.gz -C /
```

## 🔐 安全配置

### 防火墙设置

```bash
# Ubuntu/Debian
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### SSL证书自动续期

```bash
# 添加crontab任务
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### 定期备份

```bash
# 创建备份脚本
sudo tee /etc/cron.daily/ai-manager-backup << 'EOF'
#!/bin/bash
cd /opt/ai-manager
docker-compose exec -T ai-manager tar -czf - /app/data | gzip > /opt/backups/ai-manager-$(date +\%Y\%m\%d).tar.gz
find /opt/backups -name "ai-manager-*.tar.gz" -mtime +7 -delete
EOF

sudo chmod +x /etc/cron.daily/ai-manager-backup
```

## 🐛 故障排除

### 常见问题

1. **服务无法启动**
   ```bash
   # 检查端口占用
   sudo netstat -tlnp | grep :3000
   
   # 检查磁盘空间
   df -h
   
   # 查看详细错误日志
   docker-compose logs ai-manager
   ```

2. **无法访问应用**
   ```bash
   # 检查防火墙
   sudo ufw status
   
   # 检查Nginx配置
   nginx -t
   
   # 检查DNS解析
   nslookup your-domain.com
   ```

3. **性能问题**
   ```bash
   # 检查资源使用
   ./deploy/monitor.sh resources
   
   # 优化Docker配置
   docker system prune -f
   
   # 检查日志文件大小
   du -sh logs/
   ```

### 紧急恢复

```bash
# 1. 停止服务
docker-compose down

# 2. 恢复到上一个版本
cd /opt/ai-manager-backups/ai-manager-backup-20240101/
docker-compose up -d

# 3. 或者重新部署
git reset --hard HEAD~1
docker-compose up -d --force-recreate
```

## 📞 技术支持

如果遇到问题，请：

1. 检查日志文件 `./deploy/monitor.sh logs`
2. 运行健康检查 `./deploy/monitor.sh health`
3. 生成监控报告 `./deploy/monitor.sh report`
4. 联系技术支持并提供报告内容

## 🔄 版本升级

```bash
# 1. 备份当前版本
./deploy/monitor.sh backup

# 2. 拉取新版本
git pull origin main

# 3. 更新服务
docker-compose pull
docker-compose up -d

# 4. 验证升级
./deploy/monitor.sh health
```

---

**注意**: 请确保在生产环境部署前，在测试环境中验证所有配置和功能。