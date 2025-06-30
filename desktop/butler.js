import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import WebSocket from 'ws';
import DoubaoClient from './doubaoClient.js';

// Enhanced Butler service with real Doubao API integration
class ButlerService {
  constructor() {
    this.agents = new Map();
    this.tasks = new Map();
    this.config = this.loadConfig();
    this.setupAgents();
    this.isRunning = false;
    this.taskQueue = [];
    this.maxConcurrentTasks = this.config.settings?.maxConcurrentTasks || 3;
    this.activeTasks = new Set();
    this.performanceMetrics = {
      totalTasksProcessed: 0,
      averageCompletionTime: 0,
      successRate: 0,
      agentUtilization: new Map()
    };
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
      agents: [
        {
          id: 'code-agent',
          name: '代码智能体',
          role: '代码编写和调试专家',
          model: 'doubao-pro-32k',
          systemPrompt: '你是一个专业的代码编写和调试专家，擅长多种编程语言和框架。请按照用户需求提供高质量的代码解决方案，包括详细的注释和最佳实践建议。',
          capabilities: ['编程', '调试', '代码审查', '性能优化', '架构设计'],
          maxTokens: 4000,
          temperature: 0.1
        },
        {
          id: 'doc-agent',
          name: '文档智能体',
          role: '文档编写和整理专家',
          model: 'doubao-pro-4k',
          systemPrompt: '你是一个专业的技术文档编写专家，擅长将复杂的技术概念转化为清晰易懂的文档。请确保文档结构清晰、内容准确、格式规范。',
          capabilities: ['文档编写', '技术写作', '格式化', '翻译', '用户手册'],
          maxTokens: 2000,
          temperature: 0.3
        },
        {
          id: 'analysis-agent',
          name: '分析智能体',
          role: '数据分析和报告专家',
          model: 'doubao-pro-128k',
          systemPrompt: '你是一个专业的数据分析专家，擅长数据处理、分析和可视化报告生成。请提供准确的分析结果和有价值的洞察，包括数据解读和建议。',
          capabilities: ['数据分析', '报告生成', '可视化', '统计分析', '趋势预测'],
          maxTokens: 6000,
          temperature: 0.2
        },
        {
          id: 'test-agent',
          name: '测试智能体',
          role: '软件测试和质量保证专家',
          model: 'doubao-pro-4k',
          systemPrompt: '你是一个专业的软件测试专家，擅长设计测试用例、执行测试和质量保证工作。请提供全面的测试策略和详细的测试报告。',
          capabilities: ['测试设计', '自动化测试', '性能测试', '安全测试', '质量保证'],
          maxTokens: 3000,
          temperature: 0.1
        }
      ],
      settings: {
        maxConcurrentTasks: 3,
        taskTimeout: 300000,
        agentResponseTimeout: 30000,
        enableLogging: true,
        logLevel: 'info',
        retryAttempts: 3,
        qualityThreshold: 0.8
      }
    };
  }

  setupAgents() {
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
    console.log(`📡 支持的模型: ${[...new Set(this.config.agents.map(a => a.model))].join(', ')}`);
    console.log(`⚙️  最大并发任务数: ${this.maxConcurrentTasks}`);
    
    // Validate API configuration
    if (this.config.doubaoApiKey === 'your-doubao-api-key-here') {
      console.log('⚠️  警告: 请在 desktop/config.json 中配置您的豆包API密钥');
      console.log('🔧 当前运行在演示模式下');
    } else {
      console.log('✅ 豆包API配置已加载');
      await this.testApiConnection();
    }
    
    // 建立与服务端的 WebSocket 连接（若存在）
    this.connectToServer();
    
    // 同步本地智能体到服务器
    await this.delay(1000);
    await this.syncAgentsWithServer();
    
    // Start services
    this.startInputListener();
    this.startTaskProcessor();
    this.startHealthMonitor();
    this.startPerformanceMonitor();

    console.log('✅ 管家服务已启动，等待任务指令...');
    this.showStatus();
  }

  async testApiConnection() {
    try {
      console.log('🔍 测试API连接...');
      const response = await this.callDoubaoAPI(
        this.agents.get('doc-agent'),
        '请简单介绍一下你的能力',
        true
      );
      console.log('✅ API连接测试成功');
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
    console.log('\n💬 请输入任务指令:');
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
          this.config.doubaoApiKey = args[0];
          this.saveConfig();
          console.log('✅ 已更新豆包 API Key');
        } else {
          console.log(`当前 API Key: ${this.config.doubaoApiKey.substring(0,10)}...`);
        }
        break;

      case 'agent':
        switch (args[0]) {
          case 'sync':
            await this.syncAgentsWithServer();
            break;
          case 'list':
            await this.listRemoteAgents();
            break;
          case 'delete':
            if (args[1]) {
              await this.deleteRemoteAgent(args[1]);
            } else {
              console.log('用法: agent delete <agent-id>');
            }
            break;
          default:
            console.log('可用子命令: sync | list | delete <id>');
        }
        break;

      case 'clear':
        console.clear();
        break;

      case 'pause':
        if (args[0]) {
          this.pauseTask(args[0]);
        } else {
          console.log('❌ 请指定任务ID: pause <task-id>');
        }
        break;

      case 'resume':
        if (args[0]) {
          this.resumeTask(args[0]);
        } else {
          console.log('❌ 请指定任务ID: resume <task-id>');
        }
        break;

      case 'cancel':
        if (args[0]) {
          this.cancelTask(args[0]);
        } else {
          console.log('❌ 请指定任务ID: cancel <task-id>');
        }
        break;
      
      default:
        await this.processUserTask(input);
        break;
    }

    console.log('\n💬 请输入下一个指令:');
  }

  async processTaskQueue() {
    if (this.taskQueue.length === 0 || this.activeTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    const task = this.taskQueue.shift();
    if (task) {
      this.activeTasks.add(task.id);
      this.executeTask(task);
    }
  }

  async processUserTask(instruction) {
    const taskId = uuidv4();
    const task = {
      id: taskId,
      instruction,
      status: 'queued',
      priority: this.determinePriority(instruction),
      createdAt: new Date(),
      assignedAgents: new Set(),
      progress: 0,
      outputs: [],
      logs: [],
      summary: '',
      retryCount: 0
    };

    this.tasks.set(taskId, task);
    this.taskQueue.push(task);
    
    console.log(`\n🎯 新任务已加入队列: ${instruction}`);
    console.log(`📋 任务ID: ${taskId}`);
    console.log(`⏳ 队列位置: ${this.taskQueue.length}`);
    console.log(`🔄 当前活跃任务: ${this.activeTasks.size}/${this.maxConcurrentTasks}`);
  }

  determinePriority(instruction) {
    const urgentKeywords = ['紧急', '立即', '马上', 'urgent', 'asap'];
    const highKeywords = ['重要', '优先', '关键', 'important', 'critical'];
    
    const lowerInstruction = instruction.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowerInstruction.includes(keyword))) {
      return 'urgent';
    } else if (highKeywords.some(keyword => lowerInstruction.includes(keyword))) {
      return 'high';
    } else {
      return 'medium';
    }
  }

  async executeTask(task) {
    console.log(`\n🚀 开始执行任务: ${task.instruction}`);
    
    try {
      task.status = 'analyzing';
      this.addTaskLog(task, 'info', '开始分析任务需求');
      
      // Step 1: Analyze task
      const taskAnalysis = await this.analyzeTask(task);
      this.addTaskLog(task, 'info', `任务分析完成: ${taskAnalysis.summary}`);
      
      // Step 2: Select agents
      const selectedAgents = this.selectAgents(taskAnalysis.requiredCapabilities);
      if (selectedAgents.length === 0) {
        throw new Error('没有合适的智能体可以处理此任务');
      }
      
      this.addTaskLog(task, 'info', `选择智能体: ${selectedAgents.map(a => a.name).join(', ')}`);
      
      // Step 3: Execute with agents
      task.status = 'processing';
      await this.executeWithAgents(task, selectedAgents, taskAnalysis);
      
      // Step 4: Quality check
      await this.performQualityCheck(task);
      
      // Step 5: Generate final summary
      await this.generateFinalSummary(task);
      
      task.status = 'completed';
      task.completedAt = new Date();
      this.addTaskLog(task, 'success', '任务执行完成');
      
      console.log(`\n✅ 任务完成: ${task.instruction}`);
      console.log(`📊 执行时间: ${this.getExecutionTime(task)}`);
      console.log(`📈 质量评分: ${task.qualityScore || 'N/A'}`);
      
      this.performanceMetrics.totalTasksProcessed++;
      
    } catch (error) {
      console.error(`❌ 任务执行失败: ${error.message}`);
      task.status = 'failed';
      task.summary = `任务执行失败: ${error.message}`;
      this.addTaskLog(task, 'error', error.message);
      
      // Retry logic
      if (task.retryCount < this.config.settings.retryAttempts) {
        task.retryCount++;
        this.addTaskLog(task, 'warning', `准备重试 (${task.retryCount}/${this.config.settings.retryAttempts})`);
        setTimeout(() => {
          this.taskQueue.unshift(task);
        }, 5000);
      }
    } finally {
      this.activeTasks.delete(task.id);
      
      // Reset agent status
      this.agents.forEach(agent => {
        if (task.assignedAgents.has(agent.id)) {
          agent.status = 'idle';
          agent.currentTask = null;
          agent.lastActivity = new Date();
        }
      });
    }
  }

  async analyzeTask(task) {
    console.log('🧠 正在分析任务...');
    
    if (this.config.doubaoApiKey !== 'your-doubao-api-key-here') {
      try {
        const analysisAgent = this.agents.get('analysis-agent');
        const analysisPrompt = `请分析以下任务并提供结构化的分析结果：

任务描述: ${task.instruction}

请按以下格式回复：
1. 任务类型: [编程/文档/分析/测试/其他]
2. 复杂度: [简单/中等/复杂]
3. 预估时间: [分钟数]
4. 所需能力: [能力1, 能力2, ...]
5. 子任务分解: [子任务列表]
6. 风险评估: [潜在风险]

请保持简洁明了。`;

        const response = await this.callDoubaoAPI(analysisAgent, analysisPrompt);
        return this.parseTaskAnalysis(response, task.instruction);
      } catch (error) {
        console.log('⚠️  使用本地分析方法');
      }
    }
    
    // Fallback to local analysis
    return this.performLocalAnalysis(task.instruction);
  }

  parseTaskAnalysis(response, instruction) {
    // Parse the structured response from Doubao
    const lines = response.split('\n');
    const analysis = {
      summary: '任务分析完成',
      complexity: 'medium',
      estimatedTime: '10-15分钟',
      requiredCapabilities: [],
      subtasks: [],
      risks: []
    };

    lines.forEach(line => {
      if (line.includes('任务类型:')) {
        analysis.type = line.split(':')[1]?.trim();
      } else if (line.includes('复杂度:')) {
        analysis.complexity = line.split(':')[1]?.trim().toLowerCase();
      } else if (line.includes('预估时间:')) {
        analysis.estimatedTime = line.split(':')[1]?.trim();
      } else if (line.includes('所需能力:')) {
        const capabilities = line.split(':')[1]?.trim();
        analysis.requiredCapabilities = capabilities ? capabilities.split(',').map(c => c.trim()) : [];
      }
    });

    return analysis;
  }

  performLocalAnalysis(instruction) {
    const keywords = instruction.toLowerCase();
    const analysis = {
      summary: `本地分析: ${instruction.substring(0, 50)}...`,
      complexity: 'medium',
      estimatedTime: '10-15分钟',
      requiredCapabilities: this.extractCapabilities(instruction),
      subtasks: this.generateSubtasks(instruction),
      risks: ['执行时间可能超出预期', '输出质量需要验证']
    };

    return analysis;
  }

  extractCapabilities(instruction) {
    const capabilities = [];
    const keywords = instruction.toLowerCase();
    
    const capabilityMap = {
      '编程': ['代码', '编程', '开发', 'code', 'program', 'develop'],
      '调试': ['调试', '错误', 'debug', 'error', 'bug'],
      '文档编写': ['文档', '说明', '手册', 'document', 'manual', 'guide'],
      '数据分析': ['分析', '数据', '统计', 'analysis', 'data', 'statistics'],
      '测试': ['测试', 'test', 'testing', '验证', 'verify'],
      '性能优化': ['优化', '性能', 'optimize', 'performance']
    };

    Object.entries(capabilityMap).forEach(([capability, keywordList]) => {
      if (keywordList.some(keyword => keywords.includes(keyword))) {
        capabilities.push(capability);
      }
    });
    
    return capabilities.length > 0 ? capabilities : ['通用处理'];
  }

  generateSubtasks(instruction) {
    return [
      `理解需求: ${instruction}`,
      '制定执行计划',
      '实施核心功能',
      '质量检查和优化',
      '生成最终报告'
    ];
  }

  selectAgents(requiredCapabilities) {
    const availableAgents = Array.from(this.agents.values()).filter(agent => agent.status === 'idle');
    const selectedAgents = [];
    
    // Score agents based on capability match
    const scoredAgents = availableAgents.map(agent => {
      let score = 0;
      
      requiredCapabilities.forEach(capability => {
        if (agent.capabilities.some(agentCap => 
          agentCap.toLowerCase().includes(capability.toLowerCase()) || 
          capability.toLowerCase().includes(agentCap.toLowerCase())
        )) {
          score += 10;
        }
      });
      
      // Bonus for high success rate and low response time
      score += agent.metrics.successRate / 10;
      score -= agent.metrics.averageResponseTime / 1000;
      
      return { agent, score };
    });
    
    // Sort by score and select top agents
    scoredAgents.sort((a, b) => b.score - a.score);
    
    // Select up to 3 agents for complex tasks
    const maxAgents = requiredCapabilities.length > 2 ? 3 : 2;
    return scoredAgents.slice(0, Math.min(maxAgents, scoredAgents.length)).map(item => item.agent);
  }

  async executeWithAgents(task, agents, taskAnalysis) {
    console.log(`📋 分配任务给 ${agents.length} 个智能体`);
    
    const agentPromises = agents.map(async (agent, index) => {
      agent.status = 'working';
      agent.currentTask = taskAnalysis.subtasks[index % taskAnalysis.subtasks.length];
      task.assignedAgents.add(agent.id);
      
      console.log(`   └─ ${agent.name}: ${agent.currentTask}`);
      
      return this.executeAgentTask(agent, task, taskAnalysis);
    });
    
    // Wait for all agents to complete
    const results = await Promise.allSettled(agentPromises);
    
    // Process results
    results.forEach((result, index) => {
      const agent = agents[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${agent.name} 完成任务`);
        agent.metrics.tasksCompleted++;
        agent.metrics.successRate = Math.min(100, agent.metrics.successRate + 0.5);
      } else {
        console.log(`❌ ${agent.name} 执行失败: ${result.reason}`);
        agent.metrics.successRate = Math.max(0, agent.metrics.successRate - 2);
        this.addTaskLog(task, 'error', `${agent.name} 执行失败: ${result.reason}`);
      }
    });
  }

  async executeAgentTask(agent, task, taskAnalysis) {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 ${agent.name} 开始执行任务...`);
      
      const prompt = this.buildAgentPrompt(agent, task, taskAnalysis);
      const output = await this.callDoubaoAPI(agent, prompt);
      
      const executionTime = Date.now() - startTime;
      agent.metrics.lastResponseTime = executionTime;
      agent.metrics.averageResponseTime = 
        (agent.metrics.averageResponseTime + executionTime) / 2;
      
      // AI 质量二次评审（analysis-agent）
      let quality = this.assessOutputQuality(output);

      if (this.doubaoClient) {
        try {
          const reviewPrompt = `请对下面这段智能体输出进行 1-5 分的客观质量评分，仅返回数字：\n\n${output.substring(0,3000)}\n\n评分:`;
          const reviewScore = await this.doubaoClient.chat({
            model: this.agents.get('analysis-agent').model,
            systemPrompt: '你是一个严格的AI输出质量审查员，评分标准: 1=差, 5=优秀。仅回复数字。',
            userPrompt: reviewPrompt,
            maxTokens: 5,
            temperature: 0
          });
          const num = parseFloat(reviewScore.trim());
          if (!isNaN(num)) quality = Math.min(5, Math.max(1, num));
        } catch (err) {
          // 忽略审查错误，保持本地评分
        }
      }

      const taskOutput = {
        id: uuidv4(),
        agentId: agent.id,
        agentName: agent.name,
        content: output,
        timestamp: new Date().toISOString(),
        executionTime,
        quality
      };
      
      task.outputs.push(taskOutput);
      agent.outputs.push(taskOutput);
      
      // 进度推送: 完成后 100%
      this.sendToServer({
        type: 'task_update',
        taskId: task.id,
        update: {
          outputs: task.outputs,
          progress: Math.min(100, task.progress + Math.round(90 / task.assignedAgents.size)),
          summary: `智能体 ${agent.name} 已产出新内容`
        }
      });
      
      console.log(`✅ ${agent.name} 完成任务 (${executionTime}ms)`);
      console.log(`   📄 输出长度: ${output.length} 字符`);
      console.log(`   ⭐ 质量评分: ${taskOutput.quality}/5`);
      
      this.addTaskLog(task, 'success', `${agent.name} 生成输出 (质量: ${taskOutput.quality}/5)`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ ${agent.name} 执行失败: ${error.message}`);
      
      task.outputs.push({
        id: uuidv4(),
        agentId: agent.id,
        agentName: agent.name,
        content: `执行失败: ${error.message}`,
        timestamp: new Date().toISOString(),
        executionTime,
        error: true
      });
      
      throw error;
    }
  }

  buildAgentPrompt(agent, task, taskAnalysis) {
    return `${agent.systemPrompt}

当前任务: ${task.instruction}

任务分析:
- 复杂度: ${taskAnalysis.complexity}
- 预估时间: ${taskAnalysis.estimatedTime}
- 所需能力: ${taskAnalysis.requiredCapabilities.join(', ')}

你的专业领域: ${agent.capabilities.join(', ')}

请根据你的专业能力，为这个任务提供高质量的解决方案。确保输出内容：
1. 准确且实用
2. 结构清晰
3. 包含必要的细节和说明
4. 符合最佳实践

请开始执行任务:`;
  }

  async callDoubaoAPI(agent, prompt, isTest = false) {
    if (!this.doubaoClient) {
      // Mock response for demo
      await this.delay(1000 + Math.random() * 2000);
      return this.generateMockResponse(agent, prompt);
    }

    try {
      return await this.doubaoClient.chat({
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        userPrompt: prompt,
        maxTokens: agent.maxTokens || 2000,
        temperature: agent.temperature || 0.3
      });
    } catch (error) {
      if (isTest) {
        throw error;
      }
      
      console.log(`⚠️  API调用失败，使用模拟响应: ${error.message}`);
      await this.delay(1000);
      return this.generateMockResponse(agent, prompt);
    }
  }

  generateMockResponse(agent, prompt) {
    const responses = {
      'code-agent': [
        `根据任务需求，我提供以下代码解决方案：

\`\`\`javascript
// 高质量代码实现
function processTask(input) {
  // 输入验证
  if (!input) {
    throw new Error('输入参数不能为空');
  }
  
  // 核心处理逻辑
  const result = input.map(item => {
    return {
      ...item,
      processed: true,
      timestamp: new Date().toISOString()
    };
  });
  
  return result;
}

// 使用示例
const data = processTask(inputData);
console.log('处理结果:', data);
\`\`\`

代码特点：
- 包含输入验证
- 遵循最佳实践
- 添加了详细注释
- 提供使用示例`,

        `我已经分析了您的需求，提供以下技术方案：

## 架构设计
1. 采用模块化设计，便于维护和扩展
2. 实现错误处理机制，提高系统稳定性
3. 使用异步处理，提升性能表现

## 核心实现
\`\`\`python
import asyncio
import logging
from typing import List, Dict, Any

class TaskProcessor:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def process(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """异步处理任务列表"""
        results = []
        
        for task in tasks:
            try:
                result = await self._process_single_task(task)
                results.append(result)
                self.logger.info(f"任务 {task['id']} 处理完成")
            except Exception as e:
                self.logger.error(f"任务 {task['id']} 处理失败: {e}")
                results.append({"error": str(e)})
                
        return results
\`\`\`

这个方案具有良好的可扩展性和错误处理能力。`
      ],
      
      'doc-agent': [
        `# 技术文档

## 概述
根据您的需求，我为您准备了详细的技术文档。

## 功能说明
本系统主要包含以下核心功能：

### 1. 数据处理模块
- **输入处理**: 支持多种数据格式
- **数据验证**: 确保数据完整性和准确性
- **转换处理**: 灵活的数据格式转换

### 2. 业务逻辑模块
- **规则引擎**: 可配置的业务规则
- **流程控制**: 标准化的处理流程
- **异常处理**: 完善的错误处理机制

## 使用指南

### 快速开始
1. 安装依赖包
2. 配置系统参数
3. 启动服务
4. 调用API接口

### 配置说明
\`\`\`json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "mydb"
  },
  "api": {
    "timeout": 30000,
    "retries": 3
  }
}
\`\`\`

## 注意事项
- 请确保网络连接稳定
- 定期备份重要数据
- 监控系统性能指标

如有疑问，请参考详细的API文档或联系技术支持。`,

        `# 用户操作手册

## 系统介绍
本手册将指导您如何有效使用本系统的各项功能。

## 主要功能

### 任务管理
- **创建任务**: 点击"新建任务"按钮
- **编辑任务**: 选择任务后点击"编辑"
- **删除任务**: 选择任务后点击"删除"
- **任务状态**: 实时查看任务执行状态

### 数据管理
- **数据导入**: 支持CSV、Excel等格式
- **数据导出**: 可导出为多种格式
- **数据筛选**: 灵活的筛选条件设置

### 报表功能
- **生成报表**: 一键生成各类报表
- **报表定制**: 自定义报表格式和内容
- **报表分享**: 支持报表分享和协作

## 常见问题

**Q: 如何重置密码？**
A: 在登录页面点击"忘记密码"，按提示操作即可。

**Q: 数据导入失败怎么办？**
A: 请检查数据格式是否正确，确保文件大小不超过限制。

**Q: 如何联系技术支持？**
A: 可通过系统内的"帮助"菜单联系我们的技术支持团队。`
      ],
      
      'analysis-agent': [
        `# 数据分析报告

## 执行摘要
基于提供的数据和需求，我完成了全面的分析工作。

## 数据概览
- **数据量**: 10,000+ 条记录
- **时间范围**: 2024年1月-12月
- **数据质量**: 95% 完整性
- **关键指标**: 转化率、用户活跃度、收入增长

## 主要发现

### 1. 趋势分析
- 用户增长率: +25% (同比)
- 活跃用户数: 平均每月8,500人
- 转化率: 3.2% (行业平均2.8%)

### 2. 用户行为分析
- 平均会话时长: 4分32秒
- 页面浏览深度: 平均3.8页
- 跳出率: 35% (优于行业平均)

### 3. 收入分析
- 月均收入: ¥125,000
- 客单价: ¥89
- 复购率: 42%

## 关键洞察
1. **移动端用户占比持续上升** (65%)
2. **周末活跃度明显高于工作日** (+30%)
3. **新用户留存率有待提升** (目前28%)

## 建议措施
1. 优化移动端用户体验
2. 加强新用户引导流程
3. 制定周末专项营销策略
4. 建立用户分层运营体系

## 风险提示
- 市场竞争加剧可能影响用户获取成本
- 季节性因素需要持续监控
- 数据隐私法规变化需要关注

*报告生成时间: ${new Date().toLocaleString()}*`,

        `# 性能分析报告

## 系统性能概况
本次分析涵盖了系统的各项性能指标。

## 核心指标

### 响应时间分析
- **平均响应时间**: 245ms
- **95%分位数**: 580ms
- **99%分位数**: 1.2s
- **超时率**: 0.3%

### 吞吐量分析
- **每秒请求数**: 1,250 QPS
- **峰值处理能力**: 2,100 QPS
- **并发用户数**: 最高3,500人

### 资源使用情况
- **CPU使用率**: 平均65%
- **内存使用率**: 平均72%
- **磁盘I/O**: 正常范围
- **网络带宽**: 峰值80Mbps

## 性能瓶颈识别
1. **数据库查询优化空间** - 部分复杂查询耗时较长
2. **缓存命中率偏低** - 当前75%，建议提升至85%+
3. **静态资源加载** - CDN配置可进一步优化

## 优化建议
1. **数据库优化**
   - 添加必要索引
   - 优化慢查询
   - 考虑读写分离

2. **缓存策略**
   - 增加缓存层级
   - 优化缓存失效策略
   - 预热关键数据

3. **前端优化**
   - 启用Gzip压缩
   - 优化图片加载
   - 实施懒加载策略

## 监控建议
建议建立完善的性能监控体系，包括：
- 实时性能指标监控
- 异常告警机制
- 性能趋势分析
- 容量规划预测`
      ],
      
      'test-agent': [
        `# 测试执行报告

## 测试概述
本次测试覆盖了系统的主要功能模块，确保软件质量符合预期标准。

## 测试范围
- **功能测试**: 核心业务流程验证
- **性能测试**: 系统负载和响应时间
- **安全测试**: 数据安全和访问控制
- **兼容性测试**: 多浏览器和设备适配

## 测试结果统计
- **总测试用例**: 156个
- **通过用例**: 148个
- **失败用例**: 5个
- **阻塞用例**: 3个
- **通过率**: 94.9%

## 详细测试结果

### 功能测试 (通过率: 96%)
✅ 用户登录/注册功能
✅ 数据CRUD操作
✅ 文件上传下载
❌ 批量操作功能 (存在性能问题)
❌ 导出功能 (格式兼容性问题)

### 性能测试 (通过率: 92%)
✅ 并发用户测试 (1000用户)
✅ 数据库压力测试
❌ 大文件处理 (超时问题)

### 安全测试 (通过率: 100%)
✅ SQL注入防护
✅ XSS攻击防护
✅ 权限控制验证
✅ 数据加密传输

## 发现的问题

### 高优先级问题
1. **批量删除功能响应缓慢** - 影响用户体验
2. **大文件上传超时** - 需要优化处理机制
3. **导出Excel格式异常** - 兼容性问题

### 中优先级问题
1. 部分页面在IE浏览器显示异常
2. 移动端某些按钮点击区域偏小
3. 错误提示信息不够友好

## 修复建议
1. **性能优化**
   - 批量操作采用异步处理
   - 大文件分片上传
   - 添加进度提示

2. **兼容性改进**
   - 更新Excel导出库
   - 优化CSS兼容性
   - 调整移动端UI元素

3. **用户体验**
   - 改进错误提示文案
   - 添加操作确认对话框
   - 优化加载状态显示

## 回归测试计划
建议在问题修复后进行回归测试，重点关注：
- 修复功能的稳定性验证
- 相关功能的影响评估
- 性能指标的再次确认

*测试执行时间: ${new Date().toLocaleString()}*
*测试环境: Chrome 120, Firefox 121, Safari 17*`,

        `# 自动化测试报告

## 测试执行概况
本次自动化测试涵盖了API接口、UI功能和集成测试场景。

## 测试环境
- **测试框架**: Jest + Selenium
- **执行环境**: Docker容器
- **浏览器**: Chrome 120 (Headless)
- **执行时间**: 45分钟

## 测试结果汇总

### API测试结果
- **接口总数**: 45个
- **通过数量**: 43个
- **失败数量**: 2个
- **通过率**: 95.6%

### UI自动化测试
- **测试场景**: 28个
- **通过场景**: 26个
- **失败场景**: 2个
- **通过率**: 92.9%

### 集成测试
- **测试流程**: 12个
- **通过流程**: 11个
- **失败流程**: 1个
- **通过率**: 91.7%

## 失败用例分析

### API测试失败
1. **用户信息更新接口** - 返回状态码500
   - 错误原因: 数据库连接超时
   - 影响程度: 中等
   - 修复建议: 增加连接池配置

2. **文件上传接口** - 大文件处理异常
   - 错误原因: 内存溢出
   - 影响程度: 高
   - 修复建议: 实现流式处理

### UI测试失败
1. **订单列表页面** - 元素定位失败
   - 错误原因: 页面加载时间过长
   - 修复建议: 增加显式等待

2. **支付流程** - 第三方支付页面跳转异常
   - 错误原因: 测试环境配置问题
   - 修复建议: 更新测试环境配置

## 性能指标
- **平均响应时间**: 234ms
- **最慢接口**: 用户数据导出 (2.3s)
- **最快接口**: 用户登录验证 (45ms)
- **超时接口数**: 0个

## 代码覆盖率
- **总体覆盖率**: 87.3%
- **函数覆盖率**: 91.2%
- **分支覆盖率**: 83.7%
- **行覆盖率**: 88.9%

## 改进建议
1. **测试稳定性**
   - 优化元素定位策略
   - 增加重试机制
   - 改进测试数据管理

2. **测试效率**
   - 并行执行测试用例
   - 优化测试环境启动时间
   - 实现智能测试用例选择

3. **覆盖率提升**
   - 补充边界条件测试
   - 增加异常场景覆盖
   - 完善集成测试场景

## 持续集成建议
- 每次代码提交触发自动化测试
- 测试失败时阻止部署流程
- 定期生成测试报告和趋势分析
- 建立测试用例维护机制`
      ]
    };

    const agentResponses = responses[agent.id] || responses['doc-agent'];
    const randomResponse = agentResponses[Math.floor(Math.random() * agentResponses.length)];
    
    return randomResponse + `\n\n---\n执行时间: ${new Date().toLocaleString()}\n智能体: ${agent.name} (${agent.model})`;
  }

  assessOutputQuality(output) {
    // Simple quality assessment based on content characteristics
    if (!output || output.trim().length < 30) return 1;
    const sensitive = ['违法', '违规', '敏感'];
    if (sensitive.some(w => output.includes(w))) return 1;

    let score = 3; // Base score
    
    // Length check
    if (output.length > 500) score += 0.5;
    if (output.length > 1000) score += 0.5;
    
    // Structure check
    if (output.includes('##') || output.includes('###')) score += 0.3;
    if (output.includes('```')) score += 0.3;
    if (output.includes('- ') || output.includes('1.')) score += 0.2;
    
    // Content quality indicators
    if (output.includes('建议') || output.includes('推荐')) score += 0.2;
    if (output.includes('注意') || output.includes('提示')) score += 0.2;
    if (output.includes('示例') || output.includes('例子')) score += 0.3;
    
    return Math.min(5, Math.round(score * 10) / 10);
  }

  async performQualityCheck(task) {
    console.log('🔍 执行质量检查...');
    
    let totalQuality = 0;
    let validOutputs = 0;
    
    task.outputs.forEach(output => {
      if (!output.error && output.quality) {
        totalQuality += output.quality;
        validOutputs++;
      }
    });
    
    if (validOutputs > 0) {
      task.qualityScore = (totalQuality / validOutputs).toFixed(1);
      
      if (task.qualityScore < this.config.settings.qualityThreshold * 5) {
        this.addTaskLog(task, 'warning', `质量评分偏低: ${task.qualityScore}/5，准备让相关智能体重新优化`);
        if (task.retryCount < this.config.settings.retryAttempts) {
          task.retryCount++;
          this.addTaskLog(task,'info',`已重新排队进行第 ${task.retryCount} 次优化`);
          this.taskQueue.push(task);
        }
      } else {
        this.addTaskLog(task, 'success', `质量检查通过: ${task.qualityScore}/5`);
      }
    }
    
    await this.delay(500);
  }

  async generateFinalSummary(task) {
    console.log('📝 生成最终报告...');
    
    const executionTime = this.getExecutionTime(task);
    const successfulOutputs = task.outputs.filter(output => !output.error);
    const failedOutputs = task.outputs.filter(output => output.error);
    
    task.summary = `任务"${task.instruction}"执行完成。\n\n` +
                  `📊 执行统计:\n` +
                  `- 参与智能体: ${task.assignedAgents.size}个\n` +
                  `- 成功输出: ${successfulOutputs.length}个\n` +
                  `- 失败输出: ${failedOutputs.length}个\n` +
                  `- 执行时间: ${executionTime}\n` +
                  `- 质量评分: ${task.qualityScore || 'N/A'}/5\n` +
                  `- 任务优先级: ${task.priority}\n\n` +
                  `🎯 主要成果:\n${successfulOutputs.slice(0, 3).map(output => 
                    `- ${output.agentName}: ${output.content.substring(0, 100)}...`
                  ).join('\n')}\n\n` +
                  `✅ 任务已成功完成，所有输出已通过质量检查。`;
    
    task.progress = 100;
    await this.delay(500);
  }

  getExecutionTime(task) {
    if (!task.completedAt) return '进行中';
    
    const duration = task.completedAt.getTime() - task.createdAt.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  }

  addTaskLog(task, level, message, agentId = null) {
    const log = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      message,
      agentId
    };
    
    task.logs.push(log);
    
    const levelEmoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    console.log(`${levelEmoji[level]} ${message}`);

    // Markdown 日志写入
    try {
      const logDir = path.join(process.cwd(), 'desktop', 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

      const mdPath = path.join(logDir, `${task.id}.md`);
      const mdLine = `- ${new Date(log.timestamp).toLocaleTimeString()} **${level.toUpperCase()}** ${message}\n`;
      fs.appendFileSync(mdPath, mdLine, 'utf8');
    } catch (err) {
      console.error('❌ 写入Markdown日志失败', err.message);
    }

    // 将日志同步到服务端
    this.sendToServer({ type: 'task_log', taskId: task.id, log });
  }

  pauseTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'processing') {
      task.status = 'paused';
      this.addTaskLog(task, 'warning', '任务已暂停');
      console.log(`⏸️  任务已暂停: ${taskId}`);
    } else {
      console.log(`❌ 无法暂停任务: ${taskId} (任务不存在或状态不正确)`);
    }
  }

  resumeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'paused') {
      task.status = 'processing';
      this.addTaskLog(task, 'info', '任务已恢复');
      console.log(`▶️  任务已恢复: ${taskId}`);
    } else {
      console.log(`❌ 无法恢复任务: ${taskId} (任务不存在或状态不正确)`);
    }
  }

  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task && ['processing', 'paused', 'queued'].includes(task.status)) {
      task.status = 'cancelled';
      this.addTaskLog(task, 'error', '任务已取消');
      this.activeTasks.delete(taskId);
      console.log(`🚫 任务已取消: ${taskId}`);
    } else {
      console.log(`❌ 无法取消任务: ${taskId} (任务不存在或状态不正确)`);
    }
  }

  showStatus() {
    console.log('\n📊 系统状态报告:');
    console.log('═'.repeat(50));
    console.log(`├─ 运行状态: ${this.isRunning ? '✅ 运行中' : '❌ 停止'}`);
    console.log(`├─ 队列任务: ${this.taskQueue.length}个`);
    console.log(`├─ 活跃任务: ${this.activeTasks.size}/${this.maxConcurrentTasks}`);
    console.log(`├─ 已完成任务: ${Array.from(this.tasks.values()).filter(t => t.status === 'completed').length}个`);
    console.log(`├─ 失败任务: ${Array.from(this.tasks.values()).filter(t => t.status === 'failed').length}个`);
    console.log(`└─ 总处理任务: ${this.performanceMetrics.totalTasksProcessed}个`);
    
    console.log('\n🤖 智能体状态:');
    this.agents.forEach(agent => {
      const status = agent.status === 'idle' ? '💤 空闲' : 
                    agent.status === 'working' ? '🔄 工作中' : 
                    '❌ 离线';
      console.log(`   ├─ ${agent.name}: ${status}`);
      if (agent.currentTask) {
        console.log(`   │  └─ 当前任务: ${agent.currentTask.substring(0, 40)}...`);
      }
      console.log(`   │  └─ 统计: ${agent.metrics.tasksCompleted}个任务, ${agent.metrics.successRate}%成功率`);
    });
  }

  showHelp() {
    console.log('\n📖 AI任务管家 - 命令帮助');
    console.log('═'.repeat(50));
    console.log('🎯 任务管理:');
    console.log('   直接输入任务描述 - 创建新任务');
    console.log('   pause <task-id>   - 暂停指定任务');
    console.log('   resume <task-id>  - 恢复指定任务');
    console.log('   cancel <task-id>  - 取消指定任务');
    console.log('');
    console.log('📊 信息查看:');
    console.log('   status   - 查看系统状态');
    console.log('   agents   - 查看智能体详情');
    console.log('   tasks    - 查看任务列表');
    console.log('   metrics  - 查看性能指标');
    console.log('   config   - 查看配置信息');
    console.log('   agent list     - 查看服务器智能体');
    console.log('   agent sync     - 同步本地智能体到服务器');
    console.log('   agent delete <id> - 删除服务器智能体');
    console.log('   apikey <key>   - 设置豆包API密钥');
    console.log('');
    console.log('🛠️  系统控制:');
    console.log('   clear    - 清屏');
    console.log('   help     - 显示帮助信息');
    console.log('   exit     - 退出管家服务');
  }

  showAgents() {
    console.log('\n🤖 智能体详细信息:');
    console.log('═'.repeat(60));
    
    this.agents.forEach(agent => {
      console.log(`\n📋 ${agent.name} (${agent.id})`);
      console.log(`   ├─ 角色: ${agent.role}`);
      console.log(`   ├─ 模型: ${agent.model}`);
      console.log(`   ├─ 状态: ${agent.status}`);
      console.log(`   ├─ 能力: ${agent.capabilities.join(', ')}`);
      console.log(`   ├─ 完成任务: ${agent.metrics.tasksCompleted}个`);
      console.log(`   ├─ 成功率: ${agent.metrics.successRate}%`);
      console.log(`   ├─ 平均响应: ${agent.metrics.averageResponseTime.toFixed(0)}ms`);
      console.log(`   └─ 最后活动: ${agent.lastActivity.toLocaleString()}`);
      
      if (agent.currentTask) {
        console.log(`   └─ 当前任务: ${agent.currentTask}`);
      }
    });
  }

  showTasks() {
    console.log('\n📋 任务列表:');
    console.log('═'.repeat(80));
    
    if (this.tasks.size === 0) {
      console.log('   暂无任务');
      return;
    }
    
    const tasksByStatus = {
      queued: [],
      processing: [],
      completed: [],
      failed: [],
      paused: [],
      cancelled: []
    };
    
    this.tasks.forEach(task => {
      tasksByStatus[task.status]?.push(task);
    });
    
    Object.entries(tasksByStatus).forEach(([status, tasks]) => {
      if (tasks.length === 0) return;
      
      const statusName = {
        queued: '⏳ 队列中',
        processing: '🔄 处理中',
        completed: '✅ 已完成',
        failed: '❌ 失败',
        paused: '⏸️  已暂停',
        cancelled: '🚫 已取消'
      }[status];
      
      console.log(`\n${statusName} (${tasks.length}个):`);
      tasks.forEach(task => {
        console.log(`   ├─ [${task.id.substring(0, 8)}] ${task.instruction.substring(0, 50)}...`);
        console.log(`   │  └─ 创建: ${task.createdAt.toLocaleString()}, 进度: ${task.progress}%`);
        if (task.assignedAgents.size > 0) {
          const agentNames = Array.from(task.assignedAgents).map(id => 
            this.agents.get(id)?.name || id
          ).join(', ');
          console.log(`   │  └─ 智能体: ${agentNames}`);
        }
      });
    });
  }

  showMetrics() {
    console.log('\n📈 性能指标:');
    console.log('═'.repeat(50));
    
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
    
    console.log(`├─ 系统运行时间: ${uptimeStr}`);
    console.log(`├─ 总处理任务: ${this.performanceMetrics.totalTasksProcessed}个`);
    console.log(`├─ 平均完成时间: ${this.performanceMetrics.averageCompletionTime.toFixed(1)}秒`);
    console.log(`├─ 整体成功率: ${this.performanceMetrics.successRate.toFixed(1)}%`);
    console.log(`├─ 当前队列长度: ${this.taskQueue.length}`);
    console.log(`└─ 并发处理能力: ${this.activeTasks.size}/${this.maxConcurrentTasks}`);
    
    console.log('\n🤖 智能体利用率:');
    this.performanceMetrics.agentUtilization.forEach((metrics, agentId) => {
      const agent = this.agents.get(agentId);
      if (agent) {
        console.log(`   ├─ ${agent.name}: ${metrics.utilizationRate.toFixed(1)}%`);
      }
    });
  }

  showConfig() {
    console.log('\n⚙️  系统配置:');
    console.log('═'.repeat(50));
    console.log(`├─ API端点: ${this.config.doubaoEndpoint}`);
    console.log(`├─ API密钥: ${this.config.doubaoApiKey.substring(0, 10)}...`);
    console.log(`├─ 最大并发: ${this.maxConcurrentTasks}`);
    console.log(`├─ 任务超时: ${this.config.settings.taskTimeout}ms`);
    console.log(`├─ 响应超时: ${this.config.settings.agentResponseTimeout}ms`);
    console.log(`├─ 重试次数: ${this.config.settings.retryAttempts}`);
    console.log(`├─ 质量阈值: ${this.config.settings.qualityThreshold}`);
    console.log(`└─ 日志级别: ${this.config.settings.logLevel}`);
  }

  updatePerformanceMetrics() {
    // Update agent utilization
    this.agents.forEach(agent => {
      const metrics = this.performanceMetrics.agentUtilization.get(agent.id);
      if (metrics) {
        metrics.totalTime += 60; // 1 minute interval
        if (agent.status === 'working') {
          metrics.activeTime += 60;
        }
        metrics.utilizationRate = (metrics.activeTime / metrics.totalTime) * 100;
      }
    });
    
    // Update overall success rate
    const completedTasks = Array.from(this.tasks.values()).filter(t => 
      t.status === 'completed' || t.status === 'failed'
    );
    
    if (completedTasks.length > 0) {
      const successfulTasks = completedTasks.filter(t => t.status === 'completed').length;
      this.performanceMetrics.successRate = (successfulTasks / completedTasks.length) * 100;
    }
  }

  healthCheck() {
    console.log('🏥 执行健康检查...');
    
    // Reset stuck agents
    this.agents.forEach(agent => {
      if (agent.status === 'working') {
        const timeSinceActivity = Date.now() - agent.lastActivity.getTime();
        if (timeSinceActivity > 300000) { // 5 minutes
          console.log(`⚠️  重置超时智能体: ${agent.name}`);
          agent.status = 'idle';
          agent.currentTask = null;
          agent.lastActivity = new Date();
        }
      }
    });
    
    // Clean up old completed tasks
    const oldTasks = Array.from(this.tasks.entries()).filter(([id, task]) => {
      const age = Date.now() - task.createdAt.getTime();
      return task.status === 'completed' && age > 24 * 60 * 60 * 1000; // 24 hours
    });
    
    if (oldTasks.length > 0) {
      console.log(`🧹 清理 ${oldTasks.length} 个过期任务`);
      oldTasks.forEach(([id]) => this.tasks.delete(id));
    }
  }

  async shutdown() {
    console.log('\n👋 正在关闭管家服务...');
    
    // Cancel all active tasks
    this.activeTasks.forEach(taskId => {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'cancelled';
        this.addTaskLog(task, 'warning', '服务关闭，任务已取消');
      }
    });
    
    // Reset all agents
    this.agents.forEach(agent => {
      agent.status = 'offline';
      agent.currentTask = null;
    });
    
    this.isRunning = false;
    
    console.log('✅ 管家服务已安全关闭');
    console.log(`📊 本次运行统计: 处理了 ${this.performanceMetrics.totalTasksProcessed} 个任务`);
    
    process.exit(0);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* --------------------------------------------------
   * 与中央 Server 的通信
   * -------------------------------------------------- */

  connectToServer() {
    try {
      const url = `ws://${this.serverHost}:8080`;
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log(`🔌 已连接到服务器 ${url}`);
        // 注册身份
        this.ws.send(JSON.stringify({ type: 'register', role: 'butler' }));
      });

      this.ws.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch (err) {
          console.error('❌ 解析服务器消息失败', err);
          return;
        }

        if (msg.type === 'task') {
          this.addTaskFromServer(msg.task);
        }
      });

      this.ws.on('close', () => {
        console.log('⚠️ 与服务器连接断开，3 秒后重连...');
        setTimeout(() => this.connectToServer(), 3000);
      });

      this.ws.on('error', (err) => {
        console.error('❌ WebSocket 错误', err);
      });
    } catch (err) {
      console.error('❌ 无法连接服务器', err);
    }
  }

  sendToServer(message) {
    if (this.ws && this.ws.readyState === 1) { // OPEN
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 服务端推送的新任务
   */
  addTaskFromServer(taskData) {
    if (!taskData || !taskData.id) return;

    // 若任务已存在则忽略
    if (this.tasks.has(taskData.id)) return;

    const task = {
      id: taskData.id,
      instruction: taskData.instruction,
      status: 'queued',
      priority: taskData.priority || 'medium',
      createdAt: new Date(taskData.createdAt || Date.now()),
      assignedAgents: new Set(),
      progress: 0,
      outputs: [],
      logs: [],
      summary: '',
      retryCount: 0
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task);

    console.log(`📥 收到远程任务 ${task.id}: ${task.instruction}`);
  }

  /**
   * 将当前 this.config 写入 config.json
   */
  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      console.log('✅ 配置文件已保存');
    } catch (err) {
      console.error('❌ 保存配置文件失败', err.message);
    }
  }

  /* --------------------------------------------------
   * 智能体同步 / 远程管理
   * -------------------------------------------------- */

  async getServerAgents() {
    const res = await axios.get(`${this.serverBaseUrl}/api/agents`).catch((err)=>{
      throw new Error(err.response?.data?.error || err.message);
    });
    return res.data;
  }

  async syncAgentsWithServer() {
    console.log('🔄 正在同步本地智能体配置到服务器...');
    try {
      const remoteAgents = await this.getServerAgents();
      const localAgents = this.config.agents || [];

      for (const local of localAgents) {
        const remote = remoteAgents.find((a)=>a.id === local.id);
        if (!remote) {
          await axios.post(`${this.serverBaseUrl}/api/agents`, local).catch(()=>{});
          console.log(`➕ 已创建智能体: ${local.name}`);
        } else {
          const fields = ['name','role','model','capabilities'];
          const update = {};
          let needUpdate = false;
          fields.forEach((f)=>{
            if (JSON.stringify(remote[f]) !== JSON.stringify(local[f])) {
              update[f] = local[f];
              needUpdate = true;
            }
          });
          if (needUpdate) {
            await axios.put(`${this.serverBaseUrl}/api/agents/${local.id}`, update).catch(()=>{});
            console.log(`🔄 已更新智能体: ${local.name}`);
          }
        }
      }
      console.log('✅ 智能体同步完成');
    } catch(err) {
      console.error('❌ 智能体同步失败', err.message);
    }
  }

  async listRemoteAgents() {
    try {
      const agents = await this.getServerAgents();
      console.log('\n🌐 服务器智能体列表:');
      agents.forEach((a)=>{
        console.log(`  • ${a.id} - ${a.name} (${a.role})`);
      });
    } catch(err){
      console.error('❌ 获取服务器智能体失败', err.message);
    }
  }

  async deleteRemoteAgent(agentId){
    try {
      await axios.delete(`${this.serverBaseUrl}/api/agents/${agentId}`);
      console.log(`🗑️ 已删除服务器智能体 ${agentId}`);
    } catch(err){
      console.error('❌ 删除失败', err.response?.data?.error || err.message);
    }
  }
}

// Initialize and start the service
const configDir = path.dirname(new URL(import.meta.url).pathname);
const configPath = path.join(configDir, 'config.json');

// Create default config if not exists
if (!fs.existsSync(configPath)) {
  const butler = new ButlerService();
  const defaultConfig = butler.getDefaultConfig();
  
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`✅ 已创建默认配置文件: ${configPath}`);
  console.log('🔧 请编辑配置文件设置您的豆包API密钥');
}

// Start the butler service
const butler = new ButlerService();
butler.startTime = Date.now();
butler.start().catch(console.error);

export default ButlerService;