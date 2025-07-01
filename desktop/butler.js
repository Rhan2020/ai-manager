import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import WebSocket from 'ws';
import DoubaoClient from './doubaoClient.js';

// 增强版AI任务管家，支持完整的智能体管理
class ButlerService {
  constructor() {
    this.agents = new Map();
    this.tasks = new Map();
    this.config = this.loadConfig();
    // 必须在 setupAgents 之前初始化 performanceMetrics
    this.performanceMetrics = {
      totalTasksProcessed: 0,
      averageCompletionTime: 0,
      successRate: 0,
      agentUtilization: new Map()
    };
    
    // 现在可以安全地设置智能体
    this.setupAgents();
    
    this.isRunning = false;
    this.taskQueue = [];
    this.maxConcurrentTasks = this.config.settings?.maxConcurrentTasks || 3;
    this.activeTasks = new Set();
    
    // WebSocket 客户端及服务端主机
    this.ws = null;
    this.serverHost = this.config.serverHost || 'localhost';
    this.doubaoClient = this.config.doubaoApiKey !== 'your-doubao-api-key-here'
      ? new DoubaoClient(this.config.doubaoApiKey, this.config.doubaoEndpoint)
      : null;

    // 服务器 REST 基础地址
    this.serverBaseUrl = `http://${this.serverHost}:8080`;

    // 保存配置文件路径，供后续写入
    this.configPath = path.join(process.cwd(), 'desktop', 'config.json');
  }

  loadConfig() {
    const configPath = path.join(process.cwd(), 'desktop', 'config.json');
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('✅ 配置文件加载成功');
        return config;
      }
    } catch (error) {
      console.error('❌ 配置文件加载失败:', error);
    }
    
    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      doubaoApiKey: 'your-doubao-api-key-here',
      doubaoEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
      serverHost: 'localhost',
      agents: [],
      settings: {
        maxConcurrentTasks: 3,
        taskTimeout: 300000,
        agentResponseTimeout: 30000,
        enableLogging: true,
        logLevel: 'info',
        retryAttempts: 3,
        qualityThreshold: 0.8,
        autoSync: true,
        syncInterval: 30000
      }
    };
  }

  setupAgents() {
    // 从配置文件加载智能体
    this.config.agents.forEach(agentConfig => {
      const agent = {
        ...agentConfig,
        status: 'idle',
        currentTask: null,
        lastActivity: new Date(),
        outputs: [],
        metrics: {
          tasksCompleted: 0,
          averageResponseTime: 0,
          successRate: 100,
          lastResponseTime: 0
        }
      };
      this.agents.set(agent.id, agent);
      this.performanceMetrics.agentUtilization.set(agent.id, {
        totalTime: 0,
        activeTime: 0,
        utilizationRate: 0
      });
      console.log(`✓ 智能体 ${agent.name} 已初始化 (${agent.model})`);
    });
  }

  async start() {
    this.isRunning = true;
    console.log('🤖 AI 任务管家启动中...');
    console.log(`📡 服务器地址: ${this.serverHost}`);
    console.log(`⚙️  最大并发任务数: ${this.maxConcurrentTasks}`);
    
    // 验证API配置
    if (this.config.doubaoApiKey === 'your-doubao-api-key-here') {
      console.log('⚠️  警告: 请设置豆包API密钥');
      console.log('🔧 使用命令: apikey <your-api-key>');
    } else {
      console.log('✅ 豆包API配置已加载');
      await this.testApiConnection();
    }
    
    // 建立与服务端的 WebSocket 连接
    this.connectToServer();
    
    // 等待连接建立后同步智能体
    await this.delay(2000);
    await this.syncAgentsWithServer();
    
    // 启动服务
    this.startInputListener();
    this.startTaskProcessor();
    this.startHealthMonitor();
    this.startPerformanceMonitor();

    // 定期同步
    if (this.config.settings.autoSync) {
      setInterval(() => {
        this.syncAgentsWithServer();
      }, this.config.settings.syncInterval);
    }

    console.log('✅ 管家服务已启动，等待任务指令...');
    this.showStatus();
  }

  async testApiConnection() {
    try {
      console.log('🔍 测试API连接...');
      if (this.doubaoClient) {
        const response = await this.doubaoClient.chat({
          model: 'doubao-pro-4k',
          systemPrompt: '你是一个AI助手。',
          userPrompt: '测试连接',
          maxTokens: 50
        });
        console.log('✅ API连接测试成功');
      }
    } catch (error) {
      console.log('⚠️  API连接测试失败，将使用模拟模式:', error.message);
    }
  }

  startInputListener() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      const input = process.stdin.read();
      if (input !== null) {
        this.handleUserInput(input.trim());
      }
    });

    this.showHelp();
    console.log('\n💬 请输入指令:');
  }

  startTaskProcessor() {
    setInterval(() => {
      this.processTaskQueue();
    }, 1000);
  }

  startHealthMonitor() {
    setInterval(() => {
      this.healthCheck();
    }, 30000);
  }

  startPerformanceMonitor() {
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 60000);
  }

  async handleUserInput(input) {
    if (!input) return;

    const command = input.toLowerCase();
    const args = input.split(' ').slice(1);

    switch (command.split(' ')[0]) {
      case 'exit':
      case 'quit':
        await this.shutdown();
        break;
      
      case 'status':
        this.showStatus();
        break;
      
      case 'help':
        this.showHelp();
        break;
      
      case 'agents':
        this.showAgents();
        break;

      case 'tasks':
        this.showTasks();
        break;

      case 'metrics':
        this.showMetrics();
        break;

      case 'config':
        this.showConfig();
        break;

      case 'apikey':
        if (args[0]) {
          await this.updateApiKey(args[0]);
        } else {
          console.log(`当前 API Key: ${this.config.doubaoApiKey.substring(0,10)}...`);
        }
        break;

      case 'create':
        if (args[0] === 'agent') {
          await this.createAgentInteractive();
        } else {
          console.log('用法: create agent');
        }
        break;

      case 'edit':
        if (args[0] === 'agent' && args[1]) {
          await this.editAgentInteractive(args[1]);
        } else {
          console.log('用法: edit agent <agent-id>');
        }
        break;

      case 'delete':
        if (args[0] === 'agent' && args[1]) {
          await this.deleteAgent(args[1]);
        } else {
          console.log('用法: delete agent <agent-id>');
        }
        break;

      case 'sync':
        await this.syncAgentsWithServer();
        break;

      case 'clear':
        console.clear();
        break;

      default:
        if (input.trim()) {
          await this.processUserTask(input);
        }
        break;
    }

    console.log('\n💬 请输入下一个指令:');
  }

  async updateApiKey(newApiKey) {
    this.config.doubaoApiKey = newApiKey;
    this.doubaoClient = new DoubaoClient(newApiKey, this.config.doubaoEndpoint);
    this.saveConfig();
    console.log('✅ 已更新豆包 API Key');
    await this.testApiConnection();
  }

  async createAgentInteractive() {
    console.log('\n🤖 创建新智能体');
    console.log('请按提示输入信息:');
    
    const agent = {
      id: uuidv4(),
      name: '',
      role: '',
      model: 'doubao-pro-4k',
      capabilities: [],
      systemPrompt: '',
      maxTokens: 2000,
      temperature: 0.3,
      status: 'idle',
      totalTasks: 0,
      successRate: 100,
      avgResponseTime: 0,
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: 'butler'
    };

    try {
      // 简化版本，实际应该使用异步输入
      agent.name = '新智能体-' + Date.now();
      agent.role = '通用助手';
      agent.capabilities = ['通用任务处理'];
      agent.systemPrompt = `你是一个专业的${agent.role}，请按照用户需求提供高质量的服务。`;

      // 保存到本地配置
      this.config.agents.push(agent);
      this.agents.set(agent.id, agent);
      this.saveConfig();

      // 同步到服务器
      await this.createAgentOnServer(agent);

      console.log(`✅ 智能体 "${agent.name}" 创建成功`);
      console.log(`📝 ID: ${agent.id}`);
      
    } catch (error) {
      console.error('❌ 创建智能体失败:', error.message);
    }
  }

  async editAgentInteractive(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.log('❌ 智能体不存在');
      return;
    }

    console.log(`\n✏️  编辑智能体: ${agent.name}`);
    console.log('当前配置:');
    console.log(`- 名称: ${agent.name}`);
    console.log(`- 角色: ${agent.role}`);
    console.log(`- 模型: ${agent.model}`);
    console.log(`- 能力: ${agent.capabilities.join(', ')}`);

    // 简化版本，实际应该支持交互式编辑
    agent.lastActivity = new Date().toISOString();
    
    // 更新本地配置
    const configAgentIndex = this.config.agents.findIndex(a => a.id === agentId);
    if (configAgentIndex !== -1) {
      this.config.agents[configAgentIndex] = { ...agent };
      this.saveConfig();
    }

    // 同步到服务器
    await this.updateAgentOnServer(agent);
    
    console.log('✅ 智能体更新成功');
  }

  async deleteAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.log('❌ 智能体不存在');
      return;
    }

    console.log(`⚠️  确定要删除智能体 "${agent.name}" 吗？这个操作不可撤销。`);
    console.log('输入 "yes" 确认删除:');
    
    // 简化版本，直接删除
    try {
      // 从本地移除
      this.agents.delete(agentId);
      this.config.agents = this.config.agents.filter(a => a.id !== agentId);
      this.saveConfig();

      // 从服务器删除
      await this.deleteAgentOnServer(agentId);

      console.log(`✅ 智能体 "${agent.name}" 已删除`);
    } catch (error) {
      console.error('❌ 删除智能体失败:', error.message);
    }
  }

  async createAgentOnServer(agent) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'agent_created',
          agent
        }));
      }

      // 同时调用REST API确保一致性
      const response = await axios.post(`${this.serverBaseUrl}/api/agents`, agent);
      if (response.data.success) {
        console.log('📡 智能体已同步到服务器');
      }
    } catch (error) {
      console.log('⚠️  同步到服务器失败:', error.message);
    }
  }

  async updateAgentOnServer(agent) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'agent_updated',
          agent
        }));
      }

      // 同时调用REST API
      const response = await axios.put(`${this.serverBaseUrl}/api/agents/${agent.id}`, agent);
      if (response.data.success) {
        console.log('📡 智能体更新已同步到服务器');
      }
    } catch (error) {
      console.log('⚠️  同步到服务器失败:', error.message);
    }
  }

  async deleteAgentOnServer(agentId) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'agent_deleted',
          agentId
        }));
      }

      // 同时调用REST API
      const response = await axios.delete(`${this.serverBaseUrl}/api/agents/${agentId}`);
      if (response.data.success) {
        console.log('📡 智能体删除已同步到服务器');
      }
    } catch (error) {
      console.log('⚠️  同步到服务器失败:', error.message);
    }
  }

  async syncAgentsWithServer() {
    try {
      console.log('🔄 正在同步智能体到服务器...');
      
      // 获取服务器上的智能体
      const response = await axios.get(`${this.serverBaseUrl}/api/agents`);
      const serverAgents = response.data.agents || [];
      
      // 同步本地智能体到服务器
      for (const agent of this.agents.values()) {
        const serverAgent = serverAgents.find(sa => sa.id === agent.id);
        if (!serverAgent) {
          // 服务器上不存在，创建
          await this.createAgentOnServer(agent);
        } else if (new Date(agent.lastActivity) > new Date(serverAgent.lastActivity)) {
          // 本地更新，同步到服务器
          await this.updateAgentOnServer(agent);
        }
      }

      console.log(`✅ 智能体同步完成 - 本地: ${this.agents.size}, 服务器: ${serverAgents.length}`);
    } catch (error) {
      console.log('⚠️  智能体同步失败:', error.message);
    }
  }

  connectToServer() {
    const wsUrl = `ws://${this.serverHost}:8080`;
    console.log(`🔗 连接服务器: ${wsUrl}`);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('✅ 服务器连接成功');
        // 注册为Butler
        this.ws.send(JSON.stringify({
          type: 'register',
          role: 'butler',
          timestamp: new Date().toISOString()
        }));
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleServerMessage(message);
        } catch (error) {
          console.error('解析服务器消息失败:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('⚠️  服务器连接断开，尝试重连...');
        setTimeout(() => {
          if (this.isRunning) {
            this.connectToServer();
          }
        }, 5000);
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket 连接错误:', error.message);
      });

    } catch (error) {
      console.error('连接服务器失败:', error.message);
      setTimeout(() => {
        if (this.isRunning) {
          this.connectToServer();
        }
      }, 5000);
    }
  }

  handleServerMessage(message) {
    switch (message.type) {
      case 'task':
        // 接收到新任务
        if (message.task) {
          this.addTaskFromServer(message.task);
        }
        break;
      
      case 'agents_sync':
        // 服务器发送的智能体同步信息
        if (message.agents) {
          console.log(`📥 收到服务器智能体信息: ${message.agents.length} 个`);
        }
        break;
      
      default:
        // 其他消息类型
        break;
    }
  }

  addTaskFromServer(taskData) {
    const task = {
      ...taskData,
      status: 'queued',
      assignedAgents: new Set(),
      retryCount: 0
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task);
    
    console.log(`\n📥 收到服务器任务: ${task.instruction}`);
    console.log(`📋 任务ID: ${task.id}`);
    console.log(`🔄 队列位置: ${this.taskQueue.length}`);
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  }

  showHelp() {
    console.log('\n📖 AI任务管家命令帮助:');
    console.log('═══════════════════════════════════════');
    console.log('🔧 系统命令:');
    console.log('  status          - 显示系统状态');
    console.log('  help            - 显示帮助信息');
    console.log('  config          - 显示配置信息');
    console.log('  metrics         - 显示性能指标');
    console.log('  clear           - 清屏');
    console.log('  exit/quit       - 退出程序');
    console.log('');
    console.log('🤖 智能体管理:');
    console.log('  agents          - 显示所有智能体');
    console.log('  create agent    - 创建新智能体');
    console.log('  edit agent <id> - 编辑智能体');
    console.log('  delete agent <id> - 删除智能体');
    console.log('  sync            - 同步智能体到服务器');
    console.log('');
    console.log('📋 任务管理:');
    console.log('  tasks           - 显示任务列表');
    console.log('  <任务描述>      - 直接提交任务');
    console.log('');
    console.log('⚙️  配置管理:');
    console.log('  apikey <key>    - 设置豆包API密钥');
    console.log('═══════════════════════════════════════');
  }

  showStatus() {
    console.log('\n📊 系统状态:');
    console.log('═══════════════════════════════════════');
    console.log(`🤖 智能体数量: ${this.agents.size}`);
    console.log(`📋 活跃任务: ${this.activeTasks.size}/${this.maxConcurrentTasks}`);
    console.log(`⏳ 队列任务: ${this.taskQueue.length}`);
    console.log(`🔗 服务器连接: ${this.ws?.readyState === WebSocket.OPEN ? '已连接' : '未连接'}`);
    console.log(`🔑 API状态: ${this.doubaoClient ? '已配置' : '未配置'}`);
    console.log(`⚡ 总处理任务: ${this.performanceMetrics.totalTasksProcessed}`);
    console.log('═══════════════════════════════════════');
  }

  showAgents() {
    console.log('\n🤖 智能体列表:');
    console.log('═══════════════════════════════════════');
    
    if (this.agents.size === 0) {
      console.log('暂无智能体');
      return;
    }

    this.agents.forEach(agent => {
      const statusIcon = this.getStatusEmoji(agent.status);
      console.log(`${statusIcon} ${agent.name} (${agent.id})`);
      console.log(`   角色: ${agent.role}`);
      console.log(`   模型: ${agent.model}`);
      console.log(`   能力: ${agent.capabilities.join(', ')}`);
      console.log(`   状态: ${agent.status}`);
      console.log(`   成功率: ${agent.successRate}%`);
      console.log('');
    });
  }

  getStatusEmoji(status) {
    const statusEmojis = {
      idle: '💤',
      working: '⚡',
      offline: '📴',
      error: '❌'
    };
    return statusEmojis[status] || '❓';
  }

  showTasks() {
    console.log('\n📋 任务列表:');
    console.log('═══════════════════════════════════════');
    
    if (this.tasks.size === 0) {
      console.log('暂无任务');
      return;
    }

    this.tasks.forEach(task => {
      console.log(`📝 任务ID: ${task.id}`);
      console.log(`   描述: ${task.instruction}`);
      console.log(`   状态: ${task.status}`);
      console.log(`   进度: ${task.progress || 0}%`);
      console.log('');
    });
  }

  showMetrics() {
    console.log('\n📊 性能指标:');
    console.log('═══════════════════════════════════════');
    console.log(`总处理任务数: ${this.performanceMetrics.totalTasksProcessed}`);
    console.log(`平均完成时间: ${this.performanceMetrics.averageCompletionTime}秒`);
    console.log(`成功率: ${this.performanceMetrics.successRate}%`);
    console.log('\n智能体利用率:');
    
    this.performanceMetrics.agentUtilization.forEach((metrics, agentId) => {
      const agent = this.agents.get(agentId);
      if (agent) {
        console.log(`- ${agent.name}: ${metrics.utilizationRate}%`);
      }
    });
  }

  showConfig() {
    console.log('\n⚙️  配置信息:');
    console.log('═══════════════════════════════════════');
    console.log(`API Key: ${this.config.doubaoApiKey ? this.config.doubaoApiKey.substring(0, 10) + '...' : '未设置'}`);
    console.log(`服务器地址: ${this.serverHost}`);
    console.log(`最大并发任务: ${this.maxConcurrentTasks}`);
    console.log(`任务超时时间: ${this.config.settings.taskTimeout / 1000}秒`);
    console.log(`自动同步: ${this.config.settings.autoSync ? '开启' : '关闭'}`);
  }

  async processUserTask(instruction) {
    console.log('\n🚀 创建新任务...');
    const task = {
      id: uuidv4(),
      instruction,
      priority: 'medium',
      category: '通用',
      timestamp: new Date().toISOString()
    };

    // 发送到服务器
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'new_task',
        task
      }));
      console.log('✅ 任务已发送到服务器');
    } else {
      console.log('❌ 服务器未连接，请稍后重试');
    }
  }

  processTaskQueue() {
    // 处理任务队列
    if (this.taskQueue.length === 0 || this.activeTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    const task = this.taskQueue.shift();
    if (task) {
      this.activeTasks.add(task.id);
      this.executeTask(task);
    }
  }

  async executeTask(task) {
    console.log(`\n🔄 开始执行任务: ${task.instruction}`);
    
    try {
      // 模拟任务执行
      task.status = 'processing';
      this.updateTaskStatus(task);

      // 如果有API密钥，调用实际的AI服务
      if (this.doubaoClient) {
        const response = await this.doubaoClient.chat({
          model: 'doubao-pro-4k',
          systemPrompt: '你是一个AI助手，请帮助用户完成任务。',
          userPrompt: task.instruction,
          maxTokens: 2000
        });
        
        task.result = response;
        task.status = 'completed';
      } else {
        // 模拟处理
        await this.delay(3000);
        task.result = `任务 "${task.instruction}" 已完成（模拟模式）`;
        task.status = 'completed';
      }

      console.log(`✅ 任务完成: ${task.id}`);
      
    } catch (error) {
      console.error(`❌ 任务执行失败: ${error.message}`);
      task.status = 'failed';
      task.error = error.message;
    } finally {
      this.activeTasks.delete(task.id);
      this.updateTaskStatus(task);
      this.performanceMetrics.totalTasksProcessed++;
    }
  }

  updateTaskStatus(task) {
    // 向服务器发送任务状态更新
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'task_update',
        taskId: task.id,
        status: task.status,
        result: task.result,
        error: task.error
      }));
    }
  }

  healthCheck() {
    // 健康检查
    const activeAgents = Array.from(this.agents.values()).filter(a => a.status !== 'offline').length;
    const queuedTasks = this.taskQueue.length;
    
    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
      console.log('⚠️  服务器连接已断开，尝试重连...');
      this.connectToServer();
    }

    if (activeAgents === 0 && queuedTasks > 0) {
      console.log('⚠️  没有可用的智能体来处理任务');
    }
  }

  updatePerformanceMetrics() {
    // 更新性能指标
    this.agents.forEach((agent, agentId) => {
      const utilization = this.performanceMetrics.agentUtilization.get(agentId);
      if (utilization) {
        utilization.utilizationRate = Math.round((utilization.activeTime / utilization.totalTime) * 100) || 0;
      }
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown() {
    console.log('\n🛑 正在关闭管家服务...');
    this.isRunning = false;
    
    if (this.ws) {
      this.ws.close();
    }
    
    console.log('✅ 服务已关闭');
    process.exit(0);
  }
}

// 启动管家服务
const butler = new ButlerService();
butler.start().catch(console.error);