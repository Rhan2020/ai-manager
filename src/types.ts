export interface Task {
  id: string;
  instruction: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'queued';
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

export interface TaskAgent {
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

export interface Agent {
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

export interface TaskOutput {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'code' | 'file' | 'analysis';
  quality?: number;
  approved?: boolean;
}

export interface TaskLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  agentId?: string;
}

export interface SystemStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeAgents: number;
  avgCompletionTime: number;
  systemUptime: number;
}

export interface NewTaskPayload {
  id: string;
  instruction: string;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  timestamp: string;
}