import * as React from 'react';
import useWebSocket from './hooks/useWebSocket';
import TaskSubmission from './components/TaskSubmission';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import AgentManagement from './components/AgentManagement';
import { Task, Agent } from './types';

export default function App() {
  const { connected, error: wsError, tasks, agents, sendNewTask, sendTaskAction } = useWebSocket();
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | undefined>();
  const [agentList, setAgentList] = React.useState<Agent[]>(agents);

  // 同步agents状态
  React.useEffect(() => {
    setAgentList(agents);
  }, [agents]);

  const selectedTask: Task | undefined = tasks.find((t) => t.id === selectedTaskId);

  const handleAgentCreated = (agent: Agent) => {
    setAgentList(prev => [...prev, agent]);
  };

  const handleAgentUpdated = (updatedAgent: Agent) => {
    setAgentList(prev => prev.map(agent => 
      agent.id === updatedAgent.id ? updatedAgent : agent
    ));
  };

  const handleAgentDeleted = (agentId: string) => {
    setAgentList(prev => prev.filter(agent => agent.id !== agentId));
  };

  return (
    <div className="min-h-screen p-4 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                AI 任务管家系统
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                智能体协作的任务管理平台
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                connected 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                {connected ? '已连接' : '未连接'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                智能体: {agentList.length} | 任务: {tasks.length}
              </div>
            </div>
          </div>
          
          {wsError && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-300">
                连接错误: {wsError}
              </p>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* 左侧 - 任务管理 */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                创建新任务
              </h2>
              <TaskSubmission onSubmit={sendNewTask} disabled={!connected} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                  任务列表
                </h2>
                <TaskList
                  tasks={tasks}
                  onSelect={setSelectedTaskId}
                  onAction={sendTaskAction}
                  selectedTaskId={selectedTaskId}
                />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                  任务详情
                </h2>
                <TaskDetail task={selectedTask} />
              </div>
            </div>
          </div>

          {/* 右侧 - 智能体管理 */}
          <div className="space-y-6">
            <AgentManagement 
              agents={agentList}
              onCreated={handleAgentCreated}
              onUpdated={handleAgentUpdated}
              onDeleted={handleAgentDeleted}
            />
          </div>
        </div>
      </div>
    </div>
  );
}