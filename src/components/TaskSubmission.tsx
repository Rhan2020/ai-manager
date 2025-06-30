import type React from 'react';
import { useState } from 'react';
import { NewTaskPayload } from '../types';

interface Props {
  onSubmit: (task: NewTaskPayload) => void;
  disabled?: boolean;
}

export default function TaskSubmission({ onSubmit, disabled }: Props) {
  const [instruction, setInstruction] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('');

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
    <form onSubmit={handleSubmit}>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="请输入任务描述"
        rows={3}
        disabled={disabled}
      />
      <select value={priority} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriority(e.target.value as 'low' | 'medium' | 'high')} disabled={disabled}>
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
      />
      <button type="submit" disabled={disabled || !instruction.trim()}>提交</button>
    </form>
  );
}