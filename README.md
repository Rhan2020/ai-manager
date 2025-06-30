# AI 任务管家系统 (Enhanced)

一个功能强大的智能任务管理系统，包含现代化Web界面和智能桌面管家服务，支持多智能体协作完成复杂任务。

## ✨ 核心特性

### 🌐 Web界面
- 📱 **响应式设计**: 完美适配移动端和桌面端
- 🎨 **现代化UI**: 采用玻璃拟态设计和渐变效果
- 🔄 **实时通信**: WebSocket实现任务状态实时同步
- 📊 **数据可视化**: 任务进度、智能体状态实时监控
- 🌙 **深色模式**: 支持明暗主题切换
- 🔍 **智能搜索**: 任务搜索和状态筛选
- 📈 **性能监控**: 系统统计和性能指标展示
- 🔔 **通知系统**: 实时任务状态通知

### 🤖 桌面管家服务
- 🧠 **智能任务分析**: 基于豆包模型的任务理解和分解
- 👥 **多智能体协作**: 支持代码、文档、分析、测试等专业智能体
- 🎯 **任务优先级管理**: 智能任务调度和优先级处理
- 📝 **质量保证**: 自动质量检查和验收机制
- 🔄 **任务控制**: 支持暂停、恢复、取消、重启操作
- 📊 **性能监控**: 智能体利用率和系统性能统计
- 🛡️ **健康检查**: 自动故障恢复和资源清理
- 📋 **详细日志**: 完整的任务执行日志和错误追踪

## 🏗️ 系统架构

```
ai-task-manager/
├── src/                    # Web前端 (React + TypeScript)
│   ├── App.tsx            # 主应用组件
│   ├── components/        # UI组件
│   └── utils/             # 工具函数
├── server/                # Web服务器 (Node.js + Express)
│   └── index.js           # WebSocket + REST API服务器
├── desktop/               # 桌面管家服务
│   ├── butler.js          # 核心管家服务
│   └── config.json        # 智能体和系统配置
└── docs/                  # 文档目录
```

## 🚀 快速开始

### 1. 环境准备
```bash
# 确保已安装 Node.js 16+ 和 npm
node --version
npm --version
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置豆包API
编辑 `desktop/config.json` 文件：
```json
{
  "doubaoApiKey": "your-actual-doubao-api-key",
  "doubaoEndpoint": "https://ark.cn-beijing.volces.com/api/v3",
  "settings": {
    "maxConcurrentTasks": 3,
    "taskTimeout": 300000,
    "qualityThreshold": 0.8
  }
}
```

### 4. 启动服务

#### 方式一：分别启动各服务
```bash
# 终端1: 启动Web服务器
npm run server

# 终端2: 启动桌面管家服务
npm run desktop

# 终端3: 启动Web开发服务器
npm run dev
```

#### 方式二：使用开发模式
```bash
# 同时启动所有服务
npm run dev
```

### 5. 访问系统
- **Web界面**: http://localhost:5173
- **API服务**: http://localhost:8080
- **桌面管家**: 在终端中直接交互

## 📖 使用指南

### Web界面操作

1. **创建任务**
   - 在任务输入框中描述需求
   - 选择任务优先级（低/中/高）
   - 设置任务分类（可选）
   - 点击"提交任务"

2. **监控任务**
   - 实时查看任务执行进度
   - 查看智能体状态和输出
   - 使用搜索和筛选功能
   - 展开任务查看详细日志

3. **任务控制**
   - 暂停/恢复正在执行的任务
   - 重启失败或完成的任务
   - 查看任务执行历史

### 桌面管家命令

```bash
# 任务管理
直接输入任务描述        # 创建新任务
pause <task-id>        # 暂停任务
resume <task-id>       # 恢复任务
cancel <task-id>       # 取消任务

# 信息查看
status                 # 系统状态
agents                 # 智能体详情
tasks                  # 任务列表
metrics               # 性能指标
config                # 配置信息

# 系统控制
clear                 # 清屏
help                  # 帮助信息
exit                  # 退出服务
```

## 🤖 智能体配置

系统预配置了四个专业智能体：

### 代码智能体
- **模型**: doubao-pro-32k
- **专长**: 代码编写、调试、架构设计
- **能力**: 多语言编程、性能优化、代码审查

### 文档智能体
- **模型**: doubao-pro-4k
- **专长**: 技术文档、用户手册编写
- **能力**: 技术写作、格式化、多语言翻译

### 分析智能体
- **模型**: doubao-pro-128k
- **专长**: 数据分析、报告生成
- **能力**: 统计分析、趋势预测、可视化

### 测试智能体
- **模型**: doubao-pro-4k
- **专长**: 软件测试、质量保证
- **能力**: 测试设计、自动化测试、性能测试

## 🔧 高级配置

### 智能体自定义
```json
{
  "id": "custom-agent",
  "name": "自定义智能体",
  "role": "专业角色描述",
  "model": "doubao-pro-32k",
  "systemPrompt": "详细的系统提示词",
  "capabilities": ["能力1", "能力2"],
  "maxTokens": 4000,
  "temperature": 0.1
}
```

### 系统参数调优
```json
{
  "settings": {
    "maxConcurrentTasks": 5,      // 最大并发任务数
    "taskTimeout": 600000,        // 任务超时时间(ms)
    "agentResponseTimeout": 45000, // 智能体响应超时
    "retryAttempts": 3,           // 重试次数
    "qualityThreshold": 0.8,      // 质量阈值
    "enableLogging": true,        // 启用日志
    "logLevel": "info"            // 日志级别
  }
}
```

## 📊 监控和分析

### 系统指标
- **任务统计**: 总数、完成数、失败数
- **性能指标**: 平均完成时间、成功率
- **智能体利用率**: 工作时间占比
- **系统运行时间**: 服务稳定性监控

### 质量保证
- **自动质量评分**: 基于输出内容特征
- **多维度验证**: 结构、完整性、准确性
- **质量阈值控制**: 低质量输出自动重试
- **人工验收接口**: 支持手动质量确认

## 🔌 API集成

### REST API
```bash
# 获取任务列表
GET /api/tasks

# 获取智能体状态
GET /api/agents

# 创建新任务
POST /api/tasks
{
  "instruction": "任务描述",
  "priority": "high",
  "category": "开发"
}

# 获取系统统计
GET /api/stats
```

### WebSocket事件
```javascript
// 任务状态更新
{
  "type": "task_update",
  "taskId": "task-123",
  "update": { "progress": 75, "status": "processing" }
}

// 智能体状态更新
{
  "type": "agent_update",
  "agentId": "agent-1",
  "update": { "status": "working", "currentTask": "..." }
}
```

## 🛠️ 开发指南

### 添加新智能体
1. 在 `desktop/config.json` 中添加智能体配置
2. 实现专用的提示词模板
3. 更新智能体选择算法
4. 添加相应的能力标签

### 扩展任务类型
1. 修改任务分析逻辑 (`analyzeTask`)
2. 添加新的能力标签映射
3. 更新智能体匹配规则
4. 实现专用的质量评估

### 自定义UI组件
```typescript
// 添加新的任务状态组件
const CustomTaskStatus = ({ task }: { task: Task }) => {
  return (
    <div className="custom-task-status">
      {/* 自定义UI逻辑 */}
    </div>
  );
};
```

## 🔒 安全考虑

- **API密钥保护**: 配置文件本地存储，不上传到版本控制
- **输入验证**: 所有用户输入进行安全验证
- **错误处理**: 完善的异常捕获和错误恢复
- **资源限制**: 任务超时和并发数限制
- **日志安全**: 敏感信息脱敏处理

## 🚨 故障排除

### 常见问题

**Q: 连接不上桌面管家服务**
```bash
# 检查服务是否启动
npm run desktop

# 检查端口占用
netstat -an | grep 8080
```

**Q: 豆包API调用失败**
```bash
# 检查API密钥配置
cat desktop/config.json | grep doubaoApiKey

# 检查网络连接
curl -I https://ark.cn-beijing.volces.com
```

**Q: 任务执行缓慢**
```bash
# 调整并发数配置
"maxConcurrentTasks": 5

# 增加超时时间
"taskTimeout": 600000
```

### 日志分析
```bash
# 查看详细执行日志
npm run desktop 2>&1 | tee butler.log

# 分析错误模式
grep "ERROR" butler.log | head -10
```

## 📈 性能优化

### 系统调优
- **并发控制**: 根据硬件资源调整最大并发数
- **缓存策略**: 智能体响应结果缓存
- **连接池**: 数据库和API连接池优化
- **内存管理**: 定期清理过期任务和日志

### 智能体优化
- **模型选择**: 根据任务复杂度选择合适模型
- **提示词优化**: 精简和优化系统提示词
- **响应时间**: 监控和优化API响应时间
- **质量平衡**: 在质量和速度间找到平衡点

## 🤝 贡献指南

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [豆包AI](https://www.doubao.com/) - 提供强大的AI模型支持
- [React](https://reactjs.org/) - 现代化前端框架
- [Tailwind CSS](https://tailwindcss.com/) - 优雅的CSS框架
- [Lucide React](https://lucide.dev/) - 精美的图标库
- [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) - 实时通信支持

---

**🚀 开始您的AI任务管理之旅！**

如有问题或建议，欢迎提交 Issue 或联系开发团队。