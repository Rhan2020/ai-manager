import * as React from 'react';
import { NewTaskPayload } from '../types';

interface Props {
  onSubmit: (task: NewTaskPayload) => void;
  disabled?: boolean;
}

export default function TaskSubmission({ onSubmit, disabled }: Props) {
  const [instruction, setInstruction] = React.useState('');
  const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = React.useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!instruction.trim()) return;
    const task: NewTaskPayload = {
      id: Date.now().toString(),
      instruction: instruction.trim(),
      priority,
      category: category.trim() || '通用',
      timestamp: new Date().toISOString()
    };
    onSubmit(task);
    setInstruction('');
    setCategory('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="请输入任务描述"
        rows={3}
        disabled={disabled}
        className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400"
      />
      <div className="flex gap-2 flex-col sm:flex-row">
        <select
          value={priority}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          disabled={disabled}
          className="border rounded p-2 flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
        >
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
        <input
          type="text"
          placeholder="分类 (可选)"
          value={category}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
          disabled={disabled}
          className="border rounded p-2 flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !instruction.trim()}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700 transition-colors"
      >
        提交
      </button>
    </form>
  );
}