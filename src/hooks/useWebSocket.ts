import { useEffect, useRef, useState } from 'react';
import { Task, Agent, SystemStats, NewTaskPayload, TaskLog } from '../types';

interface UseWsResult {
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

export default function useWebSocket(): UseWsResult {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<SystemStats>(defaultStats);

  useEffect(() => {
    const connect = (retry = 0) => {
      const ws = new WebSocket(`ws://${window.location.hostname}:8080`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onclose = () => {
        setConnected(false);
        const delay = Math.min(10000, 1000 * 2 ** retry);
        setTimeout(() => connect(retry + 1), delay);
      };

      ws.onerror = () => {
        setError('WebSocket 连接错误');
        ws.close();
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          handleMessage(data);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('WS parse error', err);
        }
      };
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'task_update':
        setTasks((prev: Task[]) => prev.map((t: Task) => t.id === data.taskId ? { ...t, ...data.update } : t));
        break;
      case 'task_created':
        setTasks((prev: Task[]) => [...prev, data.task]);
        break;
      case 'task_log':
        setTasks((prev: Task[]) => prev.map((t: Task) =>
          t.id === data.taskId ? { ...t, logs: [...(t.logs || []), data.log as TaskLog] } : t
        ));
        break;
      case 'agents_status':
        setAgents(data.agents);
        break;
      case 'agent_update':
        setAgents((prev: Agent[]) => prev.map((a: Agent) => a.id === data.agentId ? { ...a, ...data.update } : a));
        break;
      case 'system_stats':
        setStats(data.stats);
        break;
      default:
    }
  };

  const send = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(msg));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('WS send error', err);
        setError('消息发送失败');
      }
    } else {
      setError('未连接到服务器');
    }
  };

  const sendNewTask = (task: NewTaskPayload) => {
    send({ type: 'new_task', task });
  };

  const sendTaskAction = (taskId: string, action: 'pause' | 'resume' | 'cancel' | 'restart') => {
    send({ type: 'task_action', taskId, action });
  };

  return { connected, error, tasks, agents, stats, sendNewTask, sendTaskAction };
}