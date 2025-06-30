import * as React from 'react';
import type { FC, ChangeEvent } from 'react';
import { Agent } from '../types';
import EditAgentModal from './EditAgentModal';

interface Props {
  agents: Agent[];
  onCreated: (agent: Agent) => void;
  onDeleted: (agentId: string) => void;
}

export default function AgentManagement({ agents, onCreated, onDeleted }: Props) {
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [model, setModel] = React.useState('doubao-pro-4k');
  const [capabilities, setCapabilities] = React.useState('');
  const [editing, setEditing] = React.useState<Agent|null>(null);

  const resetForm = () => {
    setName('');
    setRole('');
    setModel('doubao-pro-4k');
    setCapabilities('');
  };

  const handleCreate = async () => {
    if (!name.trim() || !role.trim()) return;
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), role: role.trim(), model, capabilities: capabilities.split(',').map((c: string)=>c.trim()).filter(Boolean) })
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.agent);
        resetForm();
        setShowForm(false);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该智能体？')) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted(id);
      }
    } catch(err){
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">智能体管理</h3>
        <button onClick={()=>setShowForm(!showForm)} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">{showForm?'关闭':'新建'}</button>
      </div>
      {showForm && (
        <div className="border p-3 rounded mb-4 space-y-2 bg-white dark:bg-gray-800">
          <input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setName(e.target.value)} placeholder="名称" className="border p-2 w-full rounded" />
          <input value={role} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setRole(e.target.value)} placeholder="角色" className="border p-2 w-full rounded" />
          <input value={model} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setModel(e.target.value)} placeholder="模型" className="border p-2 w-full rounded" />
          <input value={capabilities} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setCapabilities(e.target.value)} placeholder="能力 (逗号分隔)" className="border p-2 w-full rounded" />
          <button onClick={handleCreate} className="px-3 py-1 bg-green-600 text-white rounded">创建</button>
        </div>
      )}
      {/* 列表 */}
      <div className="space-y-2">
        {agents.map(agent=> (
          <div key={agent.id} className="border rounded p-3 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
            <div>
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs opacity-70">{agent.role}</div>
            </div>
            <button onClick={()=>handleDelete(agent.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">删除</button>
            <button onClick={()=>setEditing(agent)} className="px-2 py-1 bg-yellow-500 text-white rounded text-xs ml-2">编辑</button>
          </div>
        ))}
      </div>
      {editing && (
        <EditAgentModal agent={editing} onClose={()=>setEditing(null)} />
      )}
    </div>
  );
}