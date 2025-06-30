import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// 数据存储路径
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const agentsFile = path.join(dataDir, 'agents.json');
const tasksFile = path.join(dataDir, 'tasks.json');

// 持久化数据存储
function saveData(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

function loadData(file, defaultData = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (error) {
    console.error('加载数据失败:', error);
  }
  return defaultData;
}

// Store connected clients and data
const clients = new Map();
const tasks = new Map();
const agents = new Map();

// 系统统计
const systemStats = {
  totalTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  activeAgents: 0,
  avgCompletionTime: 0,
  systemUptime: Date.now()
};

// Butler WebSocket 连接（仅支持单实例）
let butlerSocket = null;

// 初始化数据
function initializeData() {
  // 加载任务数据
  const savedTasks = loadData(tasksFile, {});
  Object.entries(savedTasks).forEach(([key, value]) => {
    tasks.set(key, value);
  });

  // 加载智能体数据
  const savedAgents = loadData(agentsFile, {});
  const agentKeys = Object.keys(savedAgents);
  
  if (agentKeys.length === 0) {
    // 初始化默认智能体
    const defaultAgents = [
      {
        id: 'agent-1',
        name: '代码助手',
        role: '负责代码编写和调试',
        status: 'idle',
        capabilities: ['编程', '调试', '代码审查', '性能优化'],
        model: 'doubao-pro-32k',
        systemPrompt: '你是一个专业的代码编写和调试专家，擅长多种编程语言和框架。请按照用户需求提供高质量的代码解决方案。',
        maxTokens: 4000,
        temperature: 0.1,
        totalTasks: 0,
        successRate: 100,
        avgResponseTime: 2.3,
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        id: 'agent-2',
        name: '文档助手',
        role: '负责文档编写和整理',
        status: 'idle',
        capabilities: ['文档编写', '格式化', '翻译', '技术写作'],
        model: 'doubao-pro-4k',
        systemPrompt: '你是一个专业的技术文档编写专家，擅长将复杂的技术概念转化为清晰易懂的文档。',
        maxTokens: 2000,
        temperature: 0.3,
        totalTasks: 0,
        successRate: 100,
        avgResponseTime: 1.8,
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        id: 'agent-3',
        name: '分析助手',
        role: '负责数据分析和报告',
        status: 'idle',
        capabilities: ['数据分析', '报告生成', '可视化', '统计分析'],
        model: 'doubao-pro-128k',
        systemPrompt: '你是一个专业的数据分析专家，擅长数据处理、分析和可视化报告生成。',
        maxTokens: 6000,
        temperature: 0.2,
        totalTasks: 0,
        successRate: 100,
        avgResponseTime: 4.2,
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      }
    ];

    defaultAgents.forEach(agent => {
      agents.set(agent.id, agent);
      if (agent.status !== 'offline') {
        systemStats.activeAgents++;
      }
    });

    saveData(agentsFile, Object.fromEntries(agents));
  } else {
    Object.entries(savedAgents).forEach(([key, value]) => {
      agents.set(key, value);
      if (value.status !== 'offline') {
        systemStats.activeAgents++;
      }
    });
  }

  systemStats.totalTasks = tasks.size;
  console.log(`✅ 数据初始化完成 - 智能体: ${agents.size}, 任务: ${tasks.size}`);
}

// REST API 路由

// 获取所有智能体
app.get('/api/agents', (req, res) => {
  res.json({
    success: true,
    agents: Array.from(agents.values())
  });
});

// 创建新智能体
app.post('/api/agents', (req, res) => {
  try {
    const { name, role, model, capabilities, systemPrompt, maxTokens, temperature } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({
        success: false,
        error: '智能体名称和角色是必填项'
      });
    }

    const agentId = uuidv4();
    const newAgent = {
      id: agentId,
      name: name.trim(),
      role: role.trim(),
      model: model || 'doubao-pro-4k',
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      systemPrompt: systemPrompt || `你是一个专业的${role}，请按照用户需求提供高质量的服务。`,
      maxTokens: maxTokens || 2000,
      temperature: temperature || 0.3,
      status: 'idle',
      totalTasks: 0,
      successRate: 100,
      avgResponseTime: 0,
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: 'user'
    };

    agents.set(agentId, newAgent);
    systemStats.activeAgents++;
    
    // 保存到文件
    saveData(agentsFile, Object.fromEntries(agents));
    
    // 广播给所有客户端
    broadcast({
      type: 'agent_created',
      agent: newAgent
    });

    res.json({
      success: true,
      agent: newAgent
    });
  } catch (error) {
    console.error('创建智能体失败:', error);
    res.status(500).json({
      success: false,
      error: '创建智能体失败'
    });
  }
});

// 更新智能体
app.put('/api/agents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const agent = agents.get(id);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: '智能体不存在'
      });
    }

    const { name, role, model, capabilities, systemPrompt, maxTokens, temperature } = req.body;
    
    // 更新智能体信息
    if (name) agent.name = name.trim();
    if (role) agent.role = role.trim();
    if (model) agent.model = model;
    if (capabilities) agent.capabilities = Array.isArray(capabilities) ? capabilities : [];
    if (systemPrompt) agent.systemPrompt = systemPrompt;
    if (maxTokens) agent.maxTokens = maxTokens;
    if (temperature !== undefined) agent.temperature = temperature;
    
    agent.lastActivity = new Date().toISOString();
    
    // 保存到文件
    saveData(agentsFile, Object.fromEntries(agents));
    
    // 广播给所有客户端
    broadcast({
      type: 'agent_updated',
      agent
    });

    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('更新智能体失败:', error);
    res.status(500).json({
      success: false,
      error: '更新智能体失败'
    });
  }
});

// 删除智能体
app.delete('/api/agents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const agent = agents.get(id);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: '智能体不存在'
      });
    }

    // 检查是否有正在执行的任务
    const hasActiveTasks = Array.from(tasks.values()).some(task => 
      task.status === 'processing' && task.agents?.some(a => a.id === id)
    );

    if (hasActiveTasks) {
      return res.status(400).json({
        success: false,
        error: '该智能体正在执行任务，无法删除'
      });
    }

    agents.delete(id);
    if (agent.status !== 'offline') {
      systemStats.activeAgents--;
    }
    
    // 保存到文件
    saveData(agentsFile, Object.fromEntries(agents));
    
    // 广播给所有客户端
    broadcast({
      type: 'agent_deleted',
      agentId: id
    });

    res.json({
      success: true,
      message: '智能体删除成功'
    });
  } catch (error) {
    console.error('删除智能体失败:', error);
    res.status(500).json({
      success: false,
      error: '删除智能体失败'
    });
  }
});

// 获取系统统计
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      ...systemStats,
      systemUptime: Math.floor((Date.now() - systemStats.systemUptime) / 1000)
    }
  });
});

// 获取所有任务
app.get('/api/tasks', (req, res) => {
  res.json({
    success: true,
    tasks: Array.from(tasks.values())
  });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  console.log(`客户端 ${clientId} 已连接`);
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'agents_status',
    agents: Array.from(agents.values())
  }));

  ws.send(JSON.stringify({
    type: 'system_stats',
    stats: {
      ...systemStats,
      systemUptime: Math.floor((Date.now() - systemStats.systemUptime) / 1000)
    }
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      /* Butler 注册与消息处理 */
      if (message.type === 'register' && message.role === 'butler') {
        ws.isButler = true;
        butlerSocket = ws;
        console.log('🤖 Butler 已注册连接');
        
        // 发送当前智能体配置给Butler
        ws.send(JSON.stringify({
          type: 'agents_sync',
          agents: Array.from(agents.values())
        }));
        return;
      }

      // 来自 Butler 的消息直接广播给客户端
      if (ws.isButler) {
        handleButlerMessage(message);
        return;
      }

      handleMessage(clientId, message);
    } catch (error) {
      console.error('解析消息错误:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    if (ws.isButler) {
      butlerSocket = null;
      console.log('🤖 Butler 连接已断开');
    }
    console.log(`客户端 ${clientId} 已断开连接`);
  });
});

function handleMessage(clientId, message) {
  switch (message.type) {
    case 'new_task':
      handleNewTask(message.task);
      break;
    case 'task_action':
      handleTaskAction(message.taskId, message.action);
      break;
    case 'get_tasks':
      sendTasksToClient(clientId);
      break;
    case 'get_stats':
      sendStatsToClient(clientId);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

function handleNewTask(taskData) {
  const task = {
    id: taskData.id,
    instruction: taskData.instruction,
    status: 'pending',
    priority: taskData.priority || 'medium',
    category: taskData.category || '通用',
    createdAt: taskData.timestamp,
    agents: [],
    progress: 0,
    outputs: [],
    logs: []
  };

  tasks.set(task.id, task);
  systemStats.totalTasks++;
  
  // 保存任务数据
  saveData(tasksFile, Object.fromEntries(tasks));
  
  // Add initial log
  addTaskLog(task.id, 'info', '任务已创建，等待处理');
  
  // Broadcast new task to all clients
  broadcast({
    type: 'task_created',
    task
  });

  // 若 Butler 在线，则交由 Butler 处理；否则服务器本地模拟处理
  if (butlerSocket && butlerSocket.readyState === 1) {
    butlerSocket.send(JSON.stringify({ type: 'task', task }));
  } else {
    // Start processing the task locally
    processTask(task.id);
  }
}

function handleTaskAction(taskId, action) {
  const task = tasks.get(taskId);
  if (!task) return;

  switch (action) {
    case 'pause':
      if (task.status === 'processing') {
        task.status = 'paused';
        addTaskLog(taskId, 'warning', '任务已暂停');
        saveData(tasksFile, Object.fromEntries(tasks));
        broadcast({
          type: 'task_update',
          taskId,
          update: { status: 'paused' }
        });
      }
      break;
    case 'resume':
      if (task.status === 'paused') {
        task.status = 'processing';
        addTaskLog(taskId, 'info', '任务已恢复');
        saveData(tasksFile, Object.fromEntries(tasks));
        broadcast({
          type: 'task_update',
          taskId,
          update: { status: 'processing' }
        });
      }
      break;
    case 'cancel':
      task.status = 'failed';
      task.summary = '任务已被用户取消';
      addTaskLog(taskId, 'error', '任务已取消');
      systemStats.failedTasks++;
      saveData(tasksFile, Object.fromEntries(tasks));
      broadcast({
        type: 'task_update',
        taskId,
        update: { status: 'failed', summary: task.summary }
      });
      break;
    case 'restart':
      if (task.status === 'failed' || task.status === 'completed') {
        task.status = 'pending';
        task.progress = 0;
        task.outputs = [];
        task.logs = [];
        addTaskLog(taskId, 'info', '任务已重启');
        saveData(tasksFile, Object.fromEntries(tasks));
        broadcast({
          type: 'task_update',
          taskId,
          update: { status: 'pending', progress: 0 }
        });
        processTask(taskId);
      }
      break;
  }
}

function addTaskLog(taskId, level, message, agentId = null) {
  const task = tasks.get(taskId);
  if (!task) return;

  const log = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    level,
    message,
    agentId
  };

  task.logs.push(log);

  broadcast({
    type: 'task_log',
    taskId,
    log
  });
}

async function processTask(taskId) {
  const task = tasks.get(taskId);
  if (!task || task.status !== 'pending') return;

  // Update task status to processing
  task.status = 'processing';
  task.progress = 5;
  
  addTaskLog(taskId, 'info', '开始分析任务需求');
  
  broadcast({
    type: 'task_update',
    taskId,
    update: { status: 'processing', progress: 5 }
  });

  // Simulate task analysis delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Select appropriate agents based on task content and priority
  const availableAgents = Array.from(agents.values()).filter(agent => agent.status === 'idle');
  const selectedAgents = selectAgentsForTask(task, availableAgents);
  
  if (selectedAgents.length === 0) {
    task.status = 'failed';
    task.summary = '没有可用的智能体处理此任务';
    addTaskLog(taskId, 'error', '没有可用的智能体');
    systemStats.failedTasks++;
    saveData(tasksFile, Object.fromEntries(tasks));
    
    broadcast({
      type: 'task_update',
      taskId,
      update: { status: 'failed', summary: task.summary }
    });
    return;
  }

  task.agents = selectedAgents.map(agent => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    status: 'working',
    progress: 0,
    startTime: new Date().toISOString()
  }));

  // Update agent status
  selectedAgents.forEach(agent => {
    agent.status = 'working';
    agent.currentTask = `处理任务: ${task.instruction.substring(0, 50)}...`;
    agent.lastActivity = new Date().toISOString();
    
    broadcast({
      type: 'agent_update',
      agentId: agent.id,
      update: { 
        status: 'working', 
        currentTask: agent.currentTask,
        lastActivity: agent.lastActivity
      }
    });
  });

  addTaskLog(taskId, 'info', `已分配给 ${selectedAgents.length} 个智能体`);

  // Simulate progressive task completion with more detailed steps
  const progressSteps = [15, 30, 45, 60, 75, 85, 95, 100];
  const summaries = [
    '正在理解任务需求...',
    '制定执行计划...',
    '开始执行主要任务...',
    '智能体协作处理中...',
    '验证中间结果...',
    '优化输出质量...',
    '进行最终检查...',
    '任务执行完成'
  ];

  const logMessages = [
    '任务需求分析完成',
    '执行计划已制定',
    '开始执行核心逻辑',
    '智能体间协作顺利',
    '中间结果验证通过',
    '输出质量优化完成',
    '最终质量检查通过',
    '所有步骤执行完毕'
  ];

  for (let i = 0; i < progressSteps.length; i++) {
    // Check if task was paused or cancelled
    const currentTask = tasks.get(taskId);
    if (!currentTask || currentTask.status !== 'processing') {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
    
    task.progress = progressSteps[i];
    task.summary = summaries[i];
    
    addTaskLog(taskId, 'info', logMessages[i]);

    // Update agent progress
    task.agents.forEach((taskAgent, index) => {
      taskAgent.progress = Math.min(100, progressSteps[i] + (index * 5));
    });

    // Generate agent outputs at certain milestones
    if ([30, 60, 85].includes(progressSteps[i])) {
      const outputAgent = selectedAgents[Math.floor(Math.random() * selectedAgents.length)];
      const output = generateAgentOutput(outputAgent, task, progressSteps[i]);
      
      task.outputs.push(output);
      addTaskLog(taskId, 'success', `${outputAgent.name} 生成了新的输出`);
    }
    
    // 保存任务进度
    saveData(tasksFile, Object.fromEntries(tasks));
    
    broadcast({
      type: 'task_update',
      taskId,
      update: { 
        progress: progressSteps[i], 
        summary: summaries[i],
        status: progressSteps[i] === 100 ? 'completed' : 'processing',
        agents: task.agents,
        outputs: task.outputs
      }
    });

    if (progressSteps[i] === 100) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.summary = generateFinalSummary(task);
      systemStats.completedTasks++;
      
      addTaskLog(taskId, 'success', '任务成功完成');
      
      // Reset agent status and update their stats
      selectedAgents.forEach(agent => {
        agent.status = 'idle';
        agent.currentTask = undefined;
        agent.totalTasks++;
        agent.lastActivity = new Date().toISOString();
        
        // Simulate success rate update
        if (Math.random() > 0.1) { // 90% success rate simulation
          agent.successRate = Math.min(100, agent.successRate + 0.1);
        }
        
        broadcast({
          type: 'agent_update',
          agentId: agent.id,
          update: { 
            status: 'idle', 
            currentTask: undefined,
            totalTasks: agent.totalTasks,
            successRate: Math.round(agent.successRate),
            lastActivity: agent.lastActivity
          }
        });
      });

      // Update task agents final status
      task.agents.forEach(taskAgent => {
        taskAgent.status = 'completed';
        taskAgent.endTime = new Date().toISOString();
        taskAgent.progress = 100;
      });
      
      // 保存最终任务状态
      saveData(tasksFile, Object.fromEntries(tasks));
      saveData(agentsFile, Object.fromEntries(agents));
    }
  }
}

function selectAgentsForTask(task, availableAgents) {
  const instruction = task.instruction.toLowerCase();
  const priority = task.priority;
  
  // Score agents based on task relevance
  const scoredAgents = availableAgents.map(agent => {
    let score = 0;
    
    // Check capability relevance
    agent.capabilities.forEach(capability => {
      if (instruction.includes(capability.toLowerCase()) || 
          instruction.includes(capability.toLowerCase().replace(/[^\w]/g, ''))) {
        score += 10;
      }
    });
    
    // Bonus for high success rate
    score += agent.successRate / 10;
    
    // Penalty for high response time
    score -= agent.avgResponseTime;
    
    // Priority bonus
    if (priority === 'high') {
      score += agent.successRate > 90 ? 5 : 0;
    }
    
    return { agent, score };
  });
  
  // Sort by score and select top agents
  scoredAgents.sort((a, b) => b.score - a.score);
  
  const maxAgents = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
  return scoredAgents.slice(0, Math.min(maxAgents, scoredAgents.length)).map(item => item.agent);
}

function generateAgentOutput(agent, task, progress) {
  const outputTypes = ['text', 'code', 'analysis'];
  const outputType = outputTypes[Math.floor(Math.random() * outputTypes.length)];
  
  const outputs = {
    text: [
      `根据任务"${task.instruction}"的要求，我已完成了初步分析和处理。`,
      `基于我的专业能力，我为此任务制定了详细的执行方案。`,
      `经过深入分析，我认为这个任务的关键点在于...`,
      `我已经完成了任务的核心部分，正在进行质量优化。`
    ],
    code: [
      `// 为任务生成的代码片段\nfunction processTask() {\n  // 实现逻辑\n  return result;\n}`,
      `# 数据处理脚本\nimport pandas as pd\ndata = pd.read_csv('input.csv')\nresult = data.process()`,
      `<!-- HTML结构 -->\n<div class="task-result">\n  <h2>处理结果</h2>\n</div>`
    ],
    analysis: [
      `数据分析结果：\n- 关键指标1: 85%\n- 关键指标2: 92%\n- 建议: 继续优化`,
      `性能分析报告：\n- 响应时间: 1.2s\n- 成功率: 98%\n- 资源使用: 正常`,
      `质量评估：\n- 准确性: 优秀\n- 完整性: 良好\n- 可维护性: 优秀`
    ]
  };
  
  return {
    id: uuidv4(),
    agentId: agent.id,
    agentName: agent.name,
    content: outputs[outputType][Math.floor(Math.random() * outputs[outputType].length)],
    timestamp: new Date().toISOString(),
    type: outputType,
    quality: Math.floor(Math.random() * 2) + 4, // 4-5 stars
    approved: Math.random() > 0.2 // 80% approval rate
  };
}

function generateFinalSummary(task) {
  const duration = Math.floor((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  return `任务"${task.instruction}"已成功完成。\n\n` +
         `📊 执行统计:\n` +
         `- 参与智能体: ${task.agents.length}个\n` +
         `- 生成输出: ${task.outputs.length}个\n` +
         `- 执行时间: ${minutes}分${seconds}秒\n` +
         `- 任务优先级: ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}\n\n` +
         `🎯 主要成果:\n${task.outputs.slice(0, 3).map(output => 
           `- ${output.agentName}: ${output.content.substring(0, 80)}...`
         ).join('\n')}\n\n` +
         `✅ 所有智能体协作顺利，任务质量符合预期要求。`;
}

function sendTasksToClient(clientId) {
  const client = clients.get(clientId);
  if (client) {
    client.send(JSON.stringify({
      type: 'tasks_list',
      tasks: Array.from(tasks.values())
    }));
  }
}

function sendStatsToClient(clientId) {
  const client = clients.get(clientId);
  if (client) {
    client.send(JSON.stringify({
      type: 'system_stats',
      stats: {
        ...systemStats,
        systemUptime: Math.floor((Date.now() - systemStats.systemUptime) / 1000)
      }
    }));
  }
}

function broadcast(message) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client, clientId) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(messageStr);
      } catch (error) {
        console.error(`向客户端 ${clientId} 发送消息失败:`, error);
        clients.delete(clientId);
      }
    }
  });
}

// Periodic stats update
setInterval(() => {
  const stats = {
    ...systemStats,
    systemUptime: Math.floor((Date.now() - systemStats.systemUptime) / 1000),
    activeAgents: Array.from(agents.values()).filter(a => a.status !== 'offline').length
  };
  
  broadcast({
    type: 'system_stats',
    stats
  });
}, 10000);

function handleButlerMessage(message) {
  switch (message.type) {
    case 'agent_created':
      if (message.agent) {
        agents.set(message.agent.id, message.agent);
        systemStats.activeAgents++;
        saveData(agentsFile, Object.fromEntries(agents));
        broadcast({
          type: 'agent_created',
          agent: message.agent
        });
      }
      break;
    
    case 'agent_updated':
      if (message.agent && agents.has(message.agent.id)) {
        agents.set(message.agent.id, message.agent);
        saveData(agentsFile, Object.fromEntries(agents));
        broadcast({
          type: 'agent_updated',
          agent: message.agent
        });
      }
      break;
    
    case 'agent_deleted':
      if (message.agentId && agents.has(message.agentId)) {
        const agent = agents.get(message.agentId);
        agents.delete(message.agentId);
        if (agent.status !== 'offline') {
          systemStats.activeAgents--;
        }
        saveData(agentsFile, Object.fromEntries(agents));
        broadcast({
          type: 'agent_deleted',
          agentId: message.agentId
        });
      }
      break;
    
    case 'task_update':
    case 'task_completed':
    case 'task_failed':
      // 转发Butler的任务更新
      broadcast(message);
      break;
    
    default:
      // 转发其他Butler消息
      broadcast(message);
  }
}

// 初始化服务器
initializeData();

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`🤖 当前智能体数量: ${agents.size}`);
  console.log(`📋 历史任务数量: ${tasks.size}`);
});