import { useEffect, useRef, useState, useCallback } from 'react';
import { Task, Agent, SystemStats, NewTaskPayload } from '../types';
import axios from 'axios';

interface UsePollingResult {
  connected: boolean;
  error: string | null;
  tasks: Task[];
  agents: Agent[];
  stats: SystemStats;
  sendNewTask: (task: NewTaskPayload) => void;
  sendTaskAction: (taskId: string, action: 'pause' | 'resume' | 'cancel' | 'restart') => void;
}

const defaultStats: SystemStats = {
  totalTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  activeAgents: 0,
  avgCompletionTime: 0,
  systemUptime: 0
};

const API_BASE_URL = `http://${window.location.hostname}:8080/api`;
const POLLING_INTERVAL = 2000; // 2秒轮询一次

export default function usePolling(): UsePollingResult {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<SystemStats>(defaultStats);
  const intervalRef = useRef<number | null>(null);

  // 获取任务列表
  const fetchTasks = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/tasks`);
      if (response.data.success) {
        setTasks(response.data.tasks);
      }
    } catch (err) {
      console.error('获取任务列表失败:', err);
    }
  }, []);

  // 获取智能体列表
  const fetchAgents = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/agents`);
      if (response.data.success) {
        setAgents(response.data.agents);
      }
    } catch (err) {
      console.error('获取智能体列表失败:', err);
    }
  }, []);

  // 获取系统统计
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/stats`);
      if (response.data.success) {
        setStats(response.data.stats);
        setConnected(true);
        setError(null);
      }
    } catch (err) {
      console.error('获取系统统计失败:', err);
      setConnected(false);
      setError('无法连接到服务器');
    }
  }, []);

  // 轮询所有数据
  const pollData = useCallback(async () => {
    await Promise.all([
      fetchTasks(),
      fetchAgents(),
      fetchStats()
    ]);
  }, [fetchTasks, fetchAgents, fetchStats]);

  // 提交新任务
  const sendNewTask = useCallback(async (task: NewTaskPayload) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/tasks`, {
        type: 'new_task',
        task
      });
      
      if (response.data.success) {
        // 立即刷新任务列表
        await fetchTasks();
      } else {
        setError(response.data.error || '提交任务失败');
      }
    } catch (err) {
      console.error('提交任务失败:', err);
      setError('提交任务失败');
    }
  }, [fetchTasks]);

  // 发送任务操作
  const sendTaskAction = useCallback(async (taskId: string, action: 'pause' | 'resume' | 'cancel' | 'restart') => {
    try {
      const response = await axios.post(`${API_BASE_URL}/tasks/${taskId}/action`, {
        action
      });
      
      if (response.data.success) {
        // 立即刷新任务列表
        await fetchTasks();
      } else {
        setError(response.data.error || '操作失败');
      }
    } catch (err) {
      console.error('任务操作失败:', err);
      setError('任务操作失败');
    }
  }, [fetchTasks]);

  // 设置轮询
  useEffect(() => {
    // 立即获取一次数据
    pollData();

    // 设置定时轮询
    intervalRef.current = setInterval(() => {
      pollData();
    }, POLLING_INTERVAL);

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pollData]);

  return { 
    connected, 
    error, 
    tasks, 
    agents, 
    stats, 
    sendNewTask, 
    sendTaskAction 
  };
} 