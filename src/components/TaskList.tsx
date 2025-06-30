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
        <div
          key={task.id}
          className={`border rounded p-4 mb-3 cursor-pointer hover:shadow transition-colors ${selectedTaskId === task.id ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-gray-800'}`}
          onClick={() => onSelect(task.id)}
        >
          <div className="flex items-center justify-between">
            <div className="font-medium truncate max-w-xs sm:max-w-sm md:max-w-md">
              {task.instruction}
            </div>
            <span className="text-xs opacity-70">({task.status})</span>
          </div>
          <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded">
            <div className="h-2 bg-blue-500 rounded" style={{ width: `${task.progress}%` }}></div>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap text-xs">
            {task.status === 'processing' && (
              <button onClick={(e)=>{e.stopPropagation();onAction(task.id,'pause')}} className="px-2 py-1 bg-yellow-500 text-white rounded">暂停</button>
            )}
            {task.status === 'paused' && (
              <button onClick={(e)=>{e.stopPropagation();onAction(task.id,'resume')}} className="px-2 py-1 bg-green-600 text-white rounded">恢复</button>
            )}
            {(task.status === 'failed' || task.status === 'completed') && (
              <button onClick={(e)=>{e.stopPropagation();onAction(task.id,'restart')}} className="px-2 py-1 bg-indigo-600 text-white rounded">重启</button>
            )}
            {(task.status === 'processing' || task.status === 'queued') && (
              <button onClick={(e)=>{e.stopPropagation();onAction(task.id,'cancel')}} className="px-2 py-1 bg-red-600 text-white rounded">取消</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}