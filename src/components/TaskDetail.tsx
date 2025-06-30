import { Task } from '../types';

interface Props {
  task?: Task;
}

export default function TaskDetail({ task }: Props) {
  if (!task) return <div>请选择任务查看详情</div>;

  return (
    <div style={{ border: '1px solid #999', padding: 12 }}>
      <h3>{task.instruction}</h3>
      <p>状态: {task.status} 进度: {task.progress}%</p>
      {task.summary && <p>概要: {task.summary}</p>}

      <h4>日志</h4>
      <div style={{ maxHeight: 200, overflowY: 'auto', background: '#f7f7f7', padding: 6 }}>
        {task.logs.map((log) => (
          <div key={log.id}>
            [{new Date(log.timestamp).toLocaleTimeString()}] ({log.level}) {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}