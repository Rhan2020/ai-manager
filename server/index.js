import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store connected clients and data
const clients = new Map();
const tasks = new Map();
const agents = new Map();
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

// Initialize enhanced demo agents
const demoAgents = [
  {
    id: 'agent-1',
    name: '代码助手',
    role: '负责代码编写和调试',
    status: 'idle',
    capabilities: ['编程', '调试', '代码审查', '性能优化'],
    model: 'doubao-pro-32k',
    totalTasks: 15,
    successRate: 92,
    avgResponseTime: 2.3,
    lastActivity: new Date().toISOString()
  },
  {
    id: 'agent-2',
    name: '文档助手',
    role: '负责文档编写和整理',
    status: 'idle',
    capabilities: ['文档编写', '格式化', '翻译', '技术写作'],
    model: 'doubao-pro-4k',
    totalTasks: 23,
    successRate: 96,
    avgResponseTime: 1.8,
    lastActivity: new Date().toISOString()
  },
  {
    id: 'agent-3',
    name: '分析助手',
    role: '负责数据分析和报告',
    status: 'idle',
    capabilities: ['数据分析', '报告生成', '可视化', '统计分析'],
    model: 'doubao-pro-128k',
    totalTasks: 8,
    successRate: 88,
    avgResponseTime: 4.2,
    lastActivity: new Date().toISOString()
  },
  {
    id: 'agent-4',
    name: '测试助手',
    role: '负责软件测试和质量保证',
    status: 'idle',
    capabilities: ['测试设计', '自动化测试', '性能测试', '质量保证'],
    model: 'doubao-pro-4k',
    totalTasks: 12,
    successRate: 94,
    avgResponseTime: 3.1,
    lastActivity: new Date().toISOString()
  }
];

demoAgents.forEach(agent => {
  agents.set(agent.id, agent);
  if (agent.status !== 'offline') {
    systemStats.activeAgents++;
  }
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  console.log(`Client ${clientId} connected`);
  
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
        return; // 不继续向下分发
      }

      // 来自 Butler 的消息直接广播给客户端
      if (ws.isButler) {
        handleButlerMessage(message);
        return;
      }

      handleMessage(clientId, message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
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
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
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

// REST API endpoints
app.get('/api/tasks', (req, res) => {
  res.json(Array.from(tasks.values()));
});

app.get('/api/agents', (req, res) => {
  res.json(Array.from(agents.values()));
});

app.get('/api/stats', (req, res) => {
  res.json({
    ...systemStats,
    systemUptime: Math.floor((Date.now() - systemStats.systemUptime) / 1000)
  });
});

app.post('/api/tasks', (req, res) => {
  const { instruction, priority = 'medium', category = '通用' } = req.body;
  
  if (!instruction) {
    return res.status(400).json({ error: 'Instruction is required' });
  }

  const task = {
    id: uuidv4(),
    instruction,
    priority,
    category,
    timestamp: new Date().toISOString()
  };

  handleNewTask(task);
  res.json({ success: true, taskId: task.id });
});

function handleButlerMessage(message) {
  switch (message.type) {
    case 'task_update':
      // 更新缓存的任务信息
      if (tasks.has(message.taskId)) {
        const task = tasks.get(message.taskId);
        Object.assign(task, message.update);
      }
      broadcast(message);
      break;
    case 'task_log':
    case 'agent_update':
      broadcast(message);
      break;
    default:
      console.log('Unknown butler message type:', message.type);
  }
}

// 新增: REST API - 创建智能体
app.post('/api/agents', (req, res) => {
  const { id = uuidv4(), name, role, capabilities = [], model = 'doubao-pro-4k' } = req.body;

  if (!name || !role) {
    return res.status(400).json({ error: 'name 和 role 为必填字段' });
  }
  if (agents.has(id)) {
    return res.status(400).json({ error: '智能体 ID 已存在' });
  }

  const newAgent = {
    id,
    name,
    role,
    status: 'idle',
    capabilities,
    model,
    totalTasks: 0,
    successRate: 100,
    avgResponseTime: 0,
    lastActivity: new Date().toISOString()
  };
  agents.set(id, newAgent);
  systemStats.activeAgents++;

  broadcast({ type: 'agent_created', agent: newAgent });
  return res.json({ success: true, agent: newAgent });
});

// 新增: REST API - 更新智能体
app.put('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  if (!agents.has(id)) {
    return res.status(404).json({ error: '智能体不存在' });
  }
  const agent = agents.get(id);
  const allowedFields = ['name', 'role', 'capabilities', 'model', 'status'];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      agent[field] = req.body[field];
    }
  });
  agent.lastActivity = new Date().toISOString();

  broadcast({ type: 'agent_updated', agentId: id, update: agent });
  return res.json({ success: true, agent });
});

// 新增: REST API - 删除智能体
app.delete('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  if (!agents.has(id)) {
    return res.status(404).json({ error: '智能体不存在' });
  }
  agents.delete(id);
  systemStats.activeAgents = Math.max(0, systemStats.activeAgents - 1);

  broadcast({ type: 'agent_deleted', agentId: id });
  return res.json({ success: true });
});

// 静态文件托管 (生产构建后的 dist)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = path.resolve(__dirname, '../dist');
app.use(express.static(staticDir));
// 前端路由回退
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: staticDir });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Enhanced AI Task Manager Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🤖 ${agents.size} AI agents initialized`);
});