import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, Users, Activity, CheckCircle, XCircle, Clock, Zap, 
  Settings, Trash2, Play, Pause, RotateCcw, Download, Upload,
  MessageSquare, AlertTriangle, TrendingUp, Filter, Search,
  Moon, Sun, Bell, BellOff, Maximize2, Minimize2
} from 'lucide-react';

interface Task {
  id: string;
  instruction: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  createdAt: string;
  completedAt?: string;
  agents: TaskAgent[];
  progress: number;
  summary?: string;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  estimatedTime?: string;
  actualTime?: string;
  outputs: TaskOutput[];
  logs: TaskLog[];
}

interface TaskAgent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'completed' | 'failed' | 'paused';
  currentTask?: string;
  output?: string;
  progress?: number;
  startTime?: string;
  endTime?: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'completed' | 'failed' | 'offline';
  currentTask?: string;
  capabilities: string[];
  model: string;
  totalTasks: number;
  successRate: number;
  avgResponseTime: number;
  lastActivity?: string;
}

interface TaskOutput {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'code' | 'file' | 'analysis';
  quality?: number;
  approved?: boolean;
}

interface TaskLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  agentId?: string;
}

interface SystemStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeAgents: number;
  avgCompletionTime: number;
  systemUptime: number;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskCategory, setTaskCategory] = useState('');
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    activeAgents: 0,
    avgCompletionTime: 0,
    systemUptime: 0
  });
  
  // UI State
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const notificationRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load saved preferences
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    const savedNotifications = localStorage.getItem('notifications') !== 'false';
    setDarkMode(savedDarkMode);
    setNotifications(savedNotifications);
    
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    // Connect to WebSocket server
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`ws://${window.location.hostname}:8080`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          console.log('Connected to butler service');
          showNotification('已连接到管家服务', 'success');
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'task_update':
              setTasks(prev => prev.map(task => 
                task.id === data.taskId ? { ...task, ...data.update } : task
              ));
              if (data.update.status === 'completed') {
                showNotification(`任务已完成: ${data.update.summary?.substring(0, 50)}...`, 'success');
              }
              break;
            case 'agent_update':
              setAgents(prev => prev.map(agent => 
                agent.id === data.agentId ? { ...agent, ...data.update } : agent
              ));
              break;
            case 'task_created':
              setTasks(prev => [...prev, data.task]);
              showNotification('新任务已创建', 'info');
              break;
            case 'agents_status':
              setAgents(data.agents);
              break;
            case 'system_stats':
              setSystemStats(data.stats);
              break;
            case 'task_log':
              setTasks(prev => prev.map(task => 
                task.id === data.taskId 
                  ? { ...task, logs: [...(task.logs || []), data.log] }
                  : task
              ));
              break;
          }
        };

        ws.onclose = () => {
          setConnected(false);
          console.log('Disconnected from butler service');
          showNotification('与管家服务断开连接，正在重连...', 'warning');
          setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          showNotification('连接错误', 'error');
        };
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto refresh system stats
  useEffect(() => {
    if (!autoRefresh || !connected) return;
    
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'get_stats' }));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, connected]);

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    if (!notifications) return;
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'warning' ? 'bg-yellow-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 100);
    
    setTimeout(() => {
      toast.classList.add('translate-x-full');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || !connected) return;

    const task = {
      id: Date.now().toString(),
      instruction: newTask.trim(),
      priority: taskPriority,
      category: taskCategory || '通用',
      timestamp: new Date().toISOString()
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'new_task',
        task
      }));
    }

    setNewTask('');
    setTaskCategory('');
  };

  const handleTaskAction = (taskId: string, action: 'pause' | 'resume' | 'cancel' | 'restart') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'task_action',
        taskId,
        action
      }));
    }
  };

  const exportTasks = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleNotifications = () => {
    const newNotifications = !notifications;
    setNotifications(newNotifications);
    localStorage.setItem('notifications', newNotifications.toString());
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesSearch = task.instruction.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.category?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const theme = darkMode ? 'dark' : '';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 text-white' 
        : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900'
    }`}>
      {/* Header */}
      <div className={`backdrop-blur-sm border-b sticky top-0 z-50 ${
        darkMode 
          ? 'bg-gray-800/80 border-gray-700' 
          : 'bg-white/80 border-gray-200'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AI 任务管家</h1>
                <p className="text-sm opacity-70">智能任务管理系统</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* System Stats */}
              <div className="hidden md:flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span>{systemStats.completedTasks}/{systemStats.totalTasks}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>{systemStats.activeAgents}</span>
                </div>
              </div>
              
              {/* Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleNotifications}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {notifications ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm opacity-70">
                  {connected ? '已连接' : '连接中...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Settings Panel */}
        {showSettings && (
          <div className={`backdrop-blur-sm rounded-2xl border p-6 shadow-sm ${
            darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'
          }`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Settings className="w-5 h-5 text-purple-500 mr-2" />
              系统设置
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">自动刷新</label>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`w-full p-2 rounded-lg border text-left ${
                    autoRefresh 
                      ? 'bg-green-100 border-green-200 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-gray-100 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                  }`}
                >
                  {autoRefresh ? '已启用' : '已禁用'}
                </button>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">导出数据</label>
                <button
                  onClick={exportTasks}
                  className="w-full p-2 bg-blue-100 border border-blue-200 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors dark:bg-blue-900 dark:text-blue-200 flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>导出任务</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task Input */}
        <div className={`backdrop-blur-sm rounded-2xl border p-6 shadow-sm ${
          darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'
        }`}>
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 text-blue-500 mr-2" />
            新建任务
          </h2>
          <form onSubmit={handleSubmitTask} className="space-y-4">
            <div>
              <textarea
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="请详细描述您需要AI助手完成的任务..."
                className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                rows={3}
                disabled={!connected}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">优先级</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="low">低优先级</option>
                  <option value="medium">中优先级</option>
                  <option value="high">高优先级</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">分类</label>
                <input
                  type="text"
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  placeholder="任务分类（可选）"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!newTask.trim() || !connected}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-xl font-medium flex items-center justify-center space-x-2 hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
              <span>提交任务</span>
            </button>
          </form>
        </div>

        {/* Agent Status */}
        {agents.length > 0 && (
          <div className={`backdrop-blur-sm rounded-2xl border p-6 shadow-sm ${
            darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'
          }`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Users className="w-5 h-5 text-purple-500 mr-2" />
              智能体状态
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <div key={agent.id} className={`rounded-lg p-4 border ${
                  darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{agent.name}</h3>
                    {getStatusIcon(agent.status)}
                  </div>
                  <p className="text-sm opacity-70 mb-2">{agent.role}</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>任务数:</span>
                      <span>{agent.totalTasks || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>成功率:</span>
                      <span>{agent.successRate || 0}%</span>
                    </div>
                  </div>
                  {agent.currentTask && (
                    <p className={`text-xs mt-2 p-2 rounded border ${
                      darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'
                    }`}>
                      {agent.currentTask}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task List */}
        <div className={`backdrop-blur-sm rounded-2xl border p-6 shadow-sm ${
          darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <Activity className="w-5 h-5 text-green-500 mr-2" />
              任务列表
            </h2>
            
            <div className="flex items-center space-x-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索任务..."
                  className={`pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
              
              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">全部状态</option>
                <option value="pending">等待中</option>
                <option value="processing">处理中</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
                <option value="paused">已暂停</option>
              </select>
            </div>
          </div>
          
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {tasks.length === 0 ? '暂无任务，请创建新任务' : '没有匹配的任务'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => (
                <div key={task.id} className={`border rounded-xl p-4 hover:shadow-md transition-all ${
                  darkMode ? 'border-gray-600 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="font-medium">{task.instruction}</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                        </span>
                        {task.category && (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            darkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {task.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm opacity-70">
                        创建: {new Date(task.createdAt).toLocaleString()}
                        {task.completedAt && (
                          <span className="ml-4">
                            完成: {new Date(task.completedAt).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* Task Actions */}
                      {task.status === 'processing' && (
                        <button
                          onClick={() => handleTaskAction(task.id, 'pause')}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {task.status === 'paused' && (
                        <button
                          onClick={() => handleTaskAction(task.id, 'resume')}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {(task.status === 'failed' || task.status === 'completed') && (
                        <button
                          onClick={() => handleTaskAction(task.id, 'restart')}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        {expandedTask === task.id ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                      
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                        {task.status === 'pending' && '等待中'}
                        {task.status === 'processing' && '处理中'}
                        {task.status === 'completed' && '已完成'}
                        {task.status === 'failed' && '失败'}
                        {task.status === 'paused' && '已暂停'}
                      </span>
                    </div>
                  </div>
                  
                  {task.status === 'processing' && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm opacity-70 mb-1">
                        <span>进度</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div className={`w-full rounded-full h-2 ${
                        darkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`}>
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {task.summary && (
                    <div className={`mt-3 p-3 rounded-lg ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-50'
                    }`}>
                      <p className="text-sm">{task.summary}</p>
                    </div>
                  )}

                  {task.agents.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">参与智能体:</p>
                      <div className="flex flex-wrap gap-2">
                        {task.agents.map((agent) => (
                          <span
                            key={agent.id}
                            className={`px-2 py-1 rounded-md text-xs flex items-center space-x-1 ${
                              darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            <span>{agent.name}</span>
                            {agent.progress && (
                              <span className="text-xs opacity-70">({agent.progress}%)</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded Task Details */}
                  {expandedTask === task.id && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* Task Outputs */}
                      {task.outputs && task.outputs.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center">
                            <MessageSquare className="w-4 h-4 mr-1" />
                            智能体输出
                          </h4>
                          <div className="space-y-2">
                            {task.outputs.map((output) => (
                              <div key={output.id} className={`p-3 rounded-lg border ${
                                darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">{output.agentName}</span>
                                  <span className="text-xs opacity-70">
                                    {new Date(output.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-sm">{output.content}</p>
                                {output.quality && (
                                  <div className="mt-2 flex items-center space-x-2">
                                    <span className="text-xs">质量评分:</span>
                                    <div className="flex space-x-1">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <div
                                          key={star}
                                          className={`w-3 h-3 rounded-full ${
                                            star <= (output.quality || 0) ? 'bg-yellow-400' : 'bg-gray-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Task Logs */}
                      {task.logs && task.logs.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center">
                            <Activity className="w-4 h-4 mr-1" />
                            执行日志
                          </h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {task.logs.map((log) => (
                              <div key={log.id} className={`text-xs p-2 rounded flex items-center space-x-2 ${
                                log.level === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                log.level === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                log.level === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                                {log.level === 'error' && <XCircle className="w-3 h-3" />}
                                {log.level === 'warning' && <AlertTriangle className="w-3 h-3" />}
                                {log.level === 'success' && <CheckCircle className="w-3 h-3" />}
                                {log.level === 'info' && <Activity className="w-3 h-3" />}
                                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span>{log.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;