import { useState } from 'react';
import useWebSocket from './hooks/useWebSocket';
import TaskSubmission from './components/TaskSubmission';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import { Task } from './types';

export default function App() {
  const { connected, error: wsError, tasks, sendNewTask, sendTaskAction } = useWebSocket();
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();

  const selectedTask: Task | undefined = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="min-h-screen p-4 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h2 className="text-xl font-bold mb-4">AI 任务管家 {connected ? '🟢' : '🔴'}</h2>
      {wsError && <p style={{ color: 'red' }}>{wsError}</p>}
      <TaskSubmission onSubmit={sendNewTask} disabled={!connected} />
      <hr className="my-4" />
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/3 w-full">
          <h3>任务列表</h3>
          <TaskList
            tasks={tasks}
            onSelect={setSelectedTaskId}
            onAction={sendTaskAction}
            selectedTaskId={selectedTaskId}
          />
        </div>
        <div className="lg:flex-1 w-full">
          <h3>任务详情</h3>
          <TaskDetail task={selectedTask} />
        </div>
      </div>
    </div>
  );
}