# 🤖 AI任务管家系统

一个完整的智能体协作任务管理平台，支持豆包API的AI智能体创建、管理和任务处理。

## ✨ 系统特色

### �️ 三层架构设计
- **�️ 桌面端 (Butler)**: 智能体管家，负责智能体的创建、管理和实时任务处理
- **� Web端**: 用户友好的任务管理界面，支持智能体编辑和任务监控
- **� 服务端**: 高性能的API服务器，提供WebSocket实时通信和数据持久化

### 🎯 核心功能
- **智能体管理**: 创建、编辑、删除智能体，支持多种豆包模型
- **任务协作**: 多智能体协同处理复杂任务
- **实时通信**: WebSocket支持的实时状态更新
- **数据持久化**: 智能体和任务数据自动保存
- **可视化界面**: 现代化的Web界面，支持暗黑模式
- **一键部署**: Docker容器化部署，支持本地和远程服务器

## � 快速开始

### 环境要求
- Node.js 18+
- Docker & Docker Compose (用于部署)
- 豆包API密钥

### 本地开发
```bash
# 克隆项目
git clone <project-url>
cd ai-manager

# 安装依赖
npm install

# 启动开发环境
npm run dev
```

### 一键部署 (本地)
```bash
# 执行本地部署
./deploy/deploy.sh
```

### 远程服务器部署
```bash
# 配置SSH连接 (确保可以通过ssh my-tencent连接到服务器)
ssh-copy-id my-tencent

# 执行远程部署
./deploy/remote-deploy.sh
```

## 📁 项目结构

```
ai-manager/
├── server/                 # 服务端代码
│   └── index.js           # 主服务器文件
├── src/                   # Web前端代码
│   ├── components/        # React组件
│   ├── hooks/            # 自定义Hooks
│   └── types.ts          # 类型定义
├── desktop/              # 桌面端管家
│   ├── butler.js         # 主管家程序
│   ├── doubaoClient.js   # 豆包API客户端
│   └── config.json       # 配置文件
├── deploy/               # 部署配置
│   ├── docker-compose.yml # Docker编排
│   ├── Dockerfile.*      # 镜像构建
│   ├── deploy.sh         # 本地部署脚本
│   └── remote-deploy.sh  # 远程部署脚本
└── data/                 # 数据存储目录
```

## 🔧 配置说明

### 桌面端配置 (desktop/config.json)
```json
{
  "doubaoApiKey": "your-doubao-api-key-here",
  "doubaoEndpoint": "https://ark.cn-beijing.volces.com/api/v3",
  "serverHost": "localhost",
  "agents": [],
  "settings": {
    "maxConcurrentTasks": 3,
    "autoSync": true,
    "syncInterval": 30000
  }
}
```

### 环境变量
- `NODE_ENV`: 运行环境 (development/production)
- `PORT`: 服务端端口 (默认8080)
- `API_URL`: API服务地址

## 💡 使用指南

### 1. 配置豆包API
首次使用需要配置豆包API密钥：

**桌面端配置**:
```bash
npm run desktop
# 在管家控制台中输入
apikey your-doubao-api-key-here
```

**或直接编辑配置文件**:
```bash
# 编辑 desktop/config.json
{
  "doubaoApiKey": "your-actual-api-key"
}
```

### 2. 创建智能体
在Web界面或桌面端创建智能体：

**Web界面**: 访问 http://localhost，在智能体管理面板中点击"创建智能体"

**桌面端**: 
```bash
create agent
# 按提示输入智能体信息
```

### 3. 提交任务
在Web界面提交任务，系统会自动分配给合适的智能体处理。

### 4. 监控状态
- Web界面实时显示任务进度和智能体状态
- 桌面端控制台显示详细的处理日志

## 🛠️ 管理命令

### 桌面端管家命令
```bash
help              # 显示帮助信息
status            # 显示系统状态
agents            # 显示智能体列表
create agent      # 创建新智能体
edit agent <id>   # 编辑智能体
delete agent <id> # 删除智能体
sync              # 同步智能体到服务器
apikey <key>      # 设置API密钥
clear             # 清屏
exit              # 退出
```

### 服务管理命令
```bash
# 查看服务状态
docker-compose -f deploy/docker-compose.yml ps

# 查看日志
docker-compose -f deploy/docker-compose.yml logs -f

# 重启服务
docker-compose -f deploy/docker-compose.yml restart

# 停止服务
docker-compose -f deploy/docker-compose.yml down
```

## � API接口

### REST API
- `GET /api/agents` - 获取智能体列表
- `POST /api/agents` - 创建智能体
- `PUT /api/agents/:id` - 更新智能体
- `DELETE /api/agents/:id` - 删除智能体
- `GET /api/tasks` - 获取任务列表
- `GET /api/stats` - 获取系统统计

### WebSocket
- 实时任务状态更新
- 智能体状态同步
- 系统事件通知

## � Docker部署

### 服务组件
- **ai-manager-server**: 后端API服务
- **ai-manager-web**: 前端Web应用
- **nginx**: 反向代理和负载均衡

### 端口映射
- `80`: Web界面入口
- `8080`: API服务端口 (内部)
- `3000`: Web应用端口 (内部)

## � 故障排除

### 常见问题

1. **服务启动失败**
   ```bash
   # 查看详细日志
   docker-compose -f deploy/docker-compose.yml logs
   ```

2. **API连接失败**
   - 检查豆包API密钥是否正确
   - 确认网络连接正常
   - 验证API端点地址

3. **桌面端连接不上服务器**
   - 检查serverHost配置
   - 确认服务器防火墙设置
   - 验证WebSocket连接

4. **权限问题**
   ```bash
   # 修复数据目录权限
   sudo chown -R $USER:$USER data logs
   ```

### 日志位置
- 服务端日志: `logs/server.log`
- 桌面端日志: `desktop/logs/`
- Docker日志: `docker-compose logs`

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [豆包API](https://www.volcengine.com/product/doubao) - 提供强大的AI能力
- [React](https://reactjs.org/) - 前端框架
- [Express](https://expressjs.com/) - 后端框架
- [Docker](https://www.docker.com/) - 容器化平台

## � 支持

如有问题或建议，请提交 Issue 或联系开发团队。

---

**🎉 感谢使用AI任务管家系统！祝您使用愉快！**