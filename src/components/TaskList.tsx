import { Task } from '../types';

interface Props {
  tasks: Task[];
  onSelect: (taskId: string) => void;
  onAction: (taskId: string, action: 'pause' | 'resume' | 'cancel' | 'restart') => void;
  selectedTaskId?: string;
}

export default function TaskList({ tasks, onSelect, onAction, selectedTaskId }: Props) {
  return (
    <div>
      {tasks.map((task) => (
        <div key={task.id} style={{ border: '1px solid #ccc', padding: 8, marginBottom: 6, background: selectedTaskId === task.id ? '#eef' : '#fff' }}>
          <div>
            <strong>{task.instruction}</strong>
            <span style={{ marginLeft: 8 }}>({task.status})</span>
          </div>
          <div>进度: {task.progress}%</div>
          <button onClick={() => onSelect(task.id)}>详情</button>
          {task.status === 'processing' && <button onClick={() => onAction(task.id, 'pause')}>暂停</button>}
          {task.status === 'paused' && <button onClick={() => onAction(task.id, 'resume')}>恢复</button>}
          {(task.status === 'failed' || task.status === 'completed') && <button onClick={() => onAction(task.id, 'restart')}>重启</button>}
          {(task.status === 'processing' || task.status === 'queued') && <button onClick={() => onAction(task.id, 'cancel')}>取消</button>}
        </div>
      ))}
    </div>
  );
}