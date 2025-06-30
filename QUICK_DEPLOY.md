# 🚀 AI任务管理器快速部署指南

## 📋 部署前准备

1. **服务器要求**：
   - Ubuntu 18.04+ 或 CentOS 7+
   - 2核CPU，4GB内存，20GB磁盘
   - 开放端口：22 (SSH), 80 (HTTP), 443 (HTTPS)

2. **本地要求**：
   - Git
   - SSH客户端

## 🔧 步骤1: 配置SSH连接

```bash
# 复制SSH配置模板
cp deploy/ssh-config-example ~/.ssh/config

# 编辑SSH配置，替换服务器信息
nano ~/.ssh/config
```

修改配置中的服务器信息：
```
Host my-tencent
    HostName YOUR_SERVER_IP      # 替换为你的服务器IP
    User ubuntu                  # 替换为你的用户名
    Port 22
    IdentityFile ~/.ssh/id_rsa   # 确保SSH密钥存在
```

测试连接：
```bash
ssh my-tencent "echo '连接成功！'"
```

## 🚀 步骤2: 一键部署

### 方式A: 远程部署 (推荐)

```bash
# 1. 将项目文件上传到服务器
scp -r . my-tencent:/tmp/ai-manager/

# 2. 连接服务器并执行部署
ssh my-tencent "
cd /tmp/ai-manager && 
chmod +x deploy/*.sh && 
./deploy/setup-server.sh &&
./deploy/install-docker.sh &&
./deploy/deploy.sh production
"
```

### 方式B: 手动部署

```bash
# 1. 连接到服务器
ssh my-tencent

# 2. 在服务器上执行以下命令
# 初始化服务器环境
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-server.sh | bash

# 安装Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 克隆项目
git clone YOUR_REPO_URL /opt/ai-manager
cd /opt/ai-manager

# 配置环境变量
cp .env.example .env
nano .env  # 配置API密钥等

# 部署应用
./deploy/deploy.sh production
```

## ⚙️ 步骤3: 配置环境变量

编辑 `/opt/ai-manager/.env` 文件：

```bash
# 必须配置的变量
DOUBAO_API_KEY=your_api_key_here          # 豆包API密钥
REDIS_PASSWORD=your_secure_password       # Redis密码

# 可选配置
NODE_ENV=production
PORT=3000
```

## 🌐 步骤4: 配置域名和SSL (可选)

如果有域名，配置HTTPS：

```bash
# 1. 修改Nginx配置
nano /opt/ai-manager/nginx/conf.d/ai-manager.conf
# 将 your-domain.com 替换为实际域名

# 2. 获取SSL证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 3. 重启Nginx
docker-compose restart nginx
```

## ✅ 步骤5: 验证部署

```bash
# 检查服务状态
cd /opt/ai-manager
./deploy/monitor.sh all

# 测试API
curl http://localhost:3000/api/stats

# 查看服务状态
docker-compose ps
```

## 📊 常用管理命令

```bash
# 进入部署目录
cd /opt/ai-manager

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f ai-manager

# 重启服务
docker-compose restart

# 更新应用
git pull origin main
docker-compose up -d --force-recreate

# 监控检查
./deploy/monitor.sh health

# 备份数据
docker-compose exec ai-manager tar -czf /app/backup-$(date +%Y%m%d).tar.gz /app/data
```

## 🔧 CI/CD配置 (可选)

如果使用GitHub Actions自动部署：

1. **在GitHub仓库设置Secrets**：
   - `SSH_PRIVATE_KEY`: SSH私钥内容
   - `SERVER_HOST`: 服务器IP
   - `SERVER_USER`: SSH用户名

2. **推送代码自动部署**：
   ```bash
   git add .
   git commit -m "部署更新"
   git push origin main  # 自动触发部署
   ```

## 🆘 故障排除

### 常见问题及解决方案

1. **连接失败**
   ```bash
   # 检查SSH配置
   ssh -v my-tencent
   
   # 检查防火墙
   sudo ufw status
   ```

2. **Docker权限问题**
   ```bash
   # 添加用户到docker组
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **端口被占用**
   ```bash
   # 查看端口占用
   sudo netstat -tlnp | grep :3000
   
   # 停止冲突服务
   sudo systemctl stop apache2  # 如果有Apache
   ```

4. **内存不足**
   ```bash
   # 添加swap空间
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

## 📞 获取帮助

部署完成后访问：
- **Web界面**: http://YOUR_SERVER_IP:3000
- **API接口**: http://YOUR_SERVER_IP:3000/api
- **健康检查**: http://YOUR_SERVER_IP:3000/api/stats

如有问题，请查看详细文档：`DEPLOYMENT.md`

---

**🎉 恭喜！AI任务管理器部署完成！**