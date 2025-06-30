import { Task } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

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

      {/* 输出渲染 */}
      {task.outputs && task.outputs.length > 0 && (
        <div className="mt-4 space-y-6">
          {task.outputs.map((output) => (
            <div key={output.id} className="p-4 rounded border bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs opacity-70 mb-2">
                <span>{output.agentName}</span>
                <span>{new Date(output.timestamp).toLocaleTimeString()}</span>
              </div>
              <MarkdownRenderer markdown={output.content} />
            </div>
          ))}
        </div>
      )}

      {/* 日志 */}
      <h4 className="mt-6 font-medium">日志</h4>
      <div className="max-h-60 overflow-y-auto text-xs space-y-1 bg-gray-100 dark:bg-gray-900 p-3 rounded">
        {task.logs.map((log) => (
          <div key={log.id}>
            [{new Date(log.timestamp).toLocaleTimeString()}] ({log.level}) {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}