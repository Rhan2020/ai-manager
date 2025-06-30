import React, { useState } from 'react';
import useWebSocket from './hooks/useWebSocket';
import TaskSubmission from './components/TaskSubmission';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import { Task } from './types';

export default function App() {
  const { connected, tasks, sendNewTask, sendTaskAction } = useWebSocket();
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();

  const selectedTask: Task | undefined = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div style={{ padding: 20 }}>
      <h2>AI 任务管家 {connected ? '🟢' : '🔴'}</h2>
      <TaskSubmission onSubmit={sendNewTask} disabled={!connected} />
      <hr />
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <h3>任务列表</h3>
          <TaskList
            tasks={tasks}
            onSelect={setSelectedTaskId}
            onAction={sendTaskAction}
            selectedTaskId={selectedTaskId}
          />
        </div>
        <div style={{ flex: 2 }}>
          <h3>任务详情</h3>
          <TaskDetail task={selectedTask} />
        </div>
      </div>
    </div>
  );
}