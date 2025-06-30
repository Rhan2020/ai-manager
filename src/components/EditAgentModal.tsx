import type React from 'react';
import { useState } from 'react';
import type { Agent } from '../types';

interface Props {
  agent: Agent;
  onClose: () => void;
  onSaved?: (agent: Agent) => void;
}

export default function EditAgentModal({ agent, onClose, onSaved }: Props) {
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [model, setModel] = useState(agent.model);
  const [capabilities, setCapabilities] = useState(agent.capabilities.join(', '));
  const [saving, setSaving] = useState(false);
  const canSave = name.trim() && role.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          model: model.trim(),
          capabilities: capabilities.split(',').map((c: string) => c.trim()).filter(Boolean)
        })
      });
      if (res.ok) {
        const data = await res.json();
        onSaved?.(data.agent);
        onClose();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">编辑智能体</h3>
        <div className="space-y-3">
          <input className="border p-2 w-full rounded" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setName(e.target.value)} placeholder="名称" />
          <input className="border p-2 w-full rounded" value={role} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setRole(e.target.value)} placeholder="角色" />
          <input className="border p-2 w-full rounded" value={model} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setModel(e.target.value)} placeholder="模型" />
          <input className="border p-2 w-full rounded" value={capabilities} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setCapabilities(e.target.value)} placeholder="能力 (逗号分隔)" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-3 py-1 rounded border">取消</button>
          <button disabled={!canSave || saving} onClick={handleSave} className="px-4 py-1 rounded bg-blue-600 text-white disabled:opacity-60">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}