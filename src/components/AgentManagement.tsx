import * as React from 'react';
import { Agent } from '../types';

interface Props {
  agents: Agent[];
  onCreated: (agent: Agent) => void;
  onDeleted: (agentId: string) => void;
  onUpdated: (agent: Agent) => void;
}

interface AgentFormData {
  name: string;
  role: string;
  model: string;
  capabilities: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
}

export default function AgentManagement({ agents, onCreated, onDeleted, onUpdated }: Props) {
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<Agent | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<AgentFormData>({
    name: '',
    role: '',
    model: 'doubao-pro-4k',
    capabilities: '',
    systemPrompt: '',
    maxTokens: 2000,
    temperature: 0.3
  });

  const modelOptions = [
    { value: 'doubao-pro-4k', label: '豆包Pro 4K' },
    { value: 'doubao-pro-32k', label: '豆包Pro 32K' },
    { value: 'doubao-pro-128k', label: '豆包Pro 128K' }
  ];

  const resetForm = () => {
    setFormData((prev: AgentFormData) => ({
      name: '',
      role: '',
      model: 'doubao-pro-4k',
      capabilities: '',
      systemPrompt: '',
      maxTokens: 2000,
      temperature: 0.3
    }));
    setEditing(null);
    setShowForm(false);
  };

  const handleInputChange = (field: keyof AgentFormData, value: string | number) => {
    setFormData((prev: AgentFormData) => ({
      ...prev,
      [field]: value
    }));
  };

  const generateSystemPrompt = () => {
    if (formData.role) {
      const prompt = `你是一个专业的${formData.role}，擅长${formData.capabilities.replace(/,/g, '、')}。请按照用户需求提供高质量的服务，确保回复准确、专业、有用。请始终保持礼貌和耐心，如果遇到不确定的问题，请诚实说明并提供可能的解决方案。`;
      setFormData((prev: AgentFormData) => ({ ...prev, systemPrompt: prompt }));
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.role.trim()) {
      alert('请填写智能体名称和角色');
      return;
    }

    setLoading(true);
    try {
      const agentData = {
        name: formData.name.trim(),
        role: formData.role.trim(),
        model: formData.model,
        capabilities: formData.capabilities.split(',').map((c: string) => c.trim()).filter(Boolean),
        systemPrompt: formData.systemPrompt || `你是一个专业的${formData.role}，请按照用户需求提供高质量的服务。`,
        maxTokens: formData.maxTokens,
        temperature: formData.temperature
      };

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData)
      });

      const data = await res.json();
      if (data.success) {
        onCreated(data.agent);
        resetForm();
        alert('智能体创建成功！');
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建智能体失败:', error);
      alert('创建失败，请检查网络连接');
    }
    setLoading(false);
  };

  const handleEdit = (agent: Agent) => {
    setFormData({
      name: agent.name,
      role: agent.role,
      model: agent.model || 'doubao-pro-4k',
      capabilities: Array.isArray(agent.capabilities) ? agent.capabilities.join(', ') : '',
      systemPrompt: agent.systemPrompt || '',
      maxTokens: agent.maxTokens || 2000,
      temperature: agent.temperature || 0.3
    });
    setEditing(agent);
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!editing || !formData.name.trim() || !formData.role.trim()) {
      alert('请填写智能体名称和角色');
      return;
    }

    setLoading(true);
    try {
      const agentData = {
        name: formData.name.trim(),
        role: formData.role.trim(),
        model: formData.model,
        capabilities: formData.capabilities.split(',').map((c: string) => c.trim()).filter(Boolean),
        systemPrompt: formData.systemPrompt,
        maxTokens: formData.maxTokens,
        temperature: formData.temperature
      };

      const res = await fetch(`/api/agents/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData)
      });

      const data = await res.json();
      if (data.success) {
        onUpdated(data.agent);
        resetForm();
        alert('智能体更新成功！');
      } else {
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('更新智能体失败:', error);
      alert('更新失败，请检查网络连接');
    }
    setLoading(false);
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`确定删除智能体"${agent.name}"吗？此操作不可撤销。`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { 
        method: 'DELETE' 
      });
      
      const data = await res.json();
      if (data.success) {
        onDeleted(agent.id);
        alert('智能体删除成功！');
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除智能体失败:', error);
      alert('删除失败，请检查网络连接');
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-green-100 text-green-800';
      case 'working': return 'bg-blue-100 text-blue-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle': return '💤';
      case 'working': return '⚡';
      case 'offline': return '📴';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  return React.createElement('div', { className: "bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6" },
    React.createElement('div', { className: "flex items-center justify-between mb-6" },
      React.createElement('div', null,
        React.createElement('h3', { className: "text-xl font-bold text-gray-900 dark:text-white" }, '智能体管理'),
        React.createElement('p', { className: "text-sm text-gray-600 dark:text-gray-400 mt-1" },
          '管理和配置AI智能体，支持创建、编辑和删除操作'
        )
      ),
      React.createElement('button', {
        onClick: () => {
          if (showForm) {
            resetForm();
          } else {
            setShowForm(true);
          }
        },
        disabled: loading,
        className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      }, showForm ? '取消' : '创建智能体')
    ),

    showForm && React.createElement('div', { className: "border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 bg-gray-50 dark:bg-gray-900" },
      React.createElement('h4', { className: "text-lg font-semibold mb-4 text-gray-900 dark:text-white" },
        editing ? `编辑智能体: ${editing.name}` : '创建新智能体'
      ),
      
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4" },
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" },
            '智能体名称 *'
          ),
          React.createElement('input', {
            type: "text",
            value: formData.name,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('name', e.target.value),
            placeholder: "例如：代码助手",
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          })
        ),

        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" },
            '角色定位 *'
          ),
          React.createElement('input', {
            type: "text",
            value: formData.role,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('role', e.target.value),
            placeholder: "例如：代码编写和调试专家",
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          })
        ),

        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" },
            '模型选择'
          ),
          React.createElement('select', {
            value: formData.model,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange('model', e.target.value),
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          },
            modelOptions.map(option => 
              React.createElement('option', { key: option.value, value: option.value }, option.label)
            )
          )
        ),

        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" },
            '能力标签'
          ),
          React.createElement('input', {
            type: "text",
            value: formData.capabilities,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('capabilities', e.target.value),
            placeholder: "例如：编程, 调试, 代码审查",
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          })
        ),

        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" },
            '最大Token数'
          ),
          React.createElement('input', {
            type: "number",
            value: formData.maxTokens,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('maxTokens', parseInt(e.target.value) || 2000),
            min: "100",
            max: "10000",
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          })
        ),

        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" },
            '温度参数 (0-1)'
          ),
          React.createElement('input', {
            type: "number",
            value: formData.temperature,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('temperature', parseFloat(e.target.value) || 0.3),
            min: "0",
            max: "1",
            step: "0.1",
            className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          })
        )
      ),

      React.createElement('div', { className: "mb-4" },
        React.createElement('div', { className: "flex items-center justify-between mb-2" },
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 dark:text-gray-300" },
            '系统提示词'
          ),
          React.createElement('button', {
            type: "button",
            onClick: generateSystemPrompt,
            className: "text-sm text-blue-600 hover:text-blue-700 font-medium"
          }, '自动生成')
        ),
        React.createElement('textarea', {
          value: formData.systemPrompt,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('systemPrompt', e.target.value),
          placeholder: "定义智能体的行为和响应风格...",
          rows: 4,
          className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
        })
      ),

      React.createElement('div', { className: "flex gap-3" },
        React.createElement('button', {
          onClick: editing ? handleUpdate : handleCreate,
          disabled: loading || !formData.name.trim() || !formData.role.trim(),
          className: "px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        }, loading ? '处理中...' : editing ? '更新智能体' : '创建智能体'),
        React.createElement('button', {
          onClick: resetForm,
          disabled: loading,
          className: "px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        }, '取消')
      )
    ),

    React.createElement('div', { className: "space-y-4" },
      agents.length === 0 ? 
        React.createElement('div', { className: "text-center py-8 text-gray-500 dark:text-gray-400" },
          React.createElement('div', { className: "text-4xl mb-2" }, '🤖'),
          React.createElement('p', null, '暂无智能体，点击上方按钮创建第一个智能体')
        ) :
        agents.map(agent => 
          React.createElement('div', {
            key: agent.id,
            className: "border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
          },
            React.createElement('div', { className: "flex items-start justify-between" },
              React.createElement('div', { className: "flex-1" },
                React.createElement('div', { className: "flex items-center gap-3 mb-2" },
                  React.createElement('h4', { className: "text-lg font-semibold text-gray-900 dark:text-white" },
                    agent.name
                  ),
                  React.createElement('span', { 
                    className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status || 'idle')}` 
                  }, `${getStatusIcon(agent.status || 'idle')} ${agent.status || 'idle'}`),
                  React.createElement('span', { 
                    className: "px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs font-medium" 
                  }, agent.model || 'doubao-pro-4k')
                ),
                
                React.createElement('p', { className: "text-gray-600 dark:text-gray-300 mb-2" },
                  agent.role
                ),
                
                agent.capabilities && agent.capabilities.length > 0 &&
                  React.createElement('div', { className: "flex flex-wrap gap-1 mb-3" },
                    agent.capabilities.map((capability, index) =>
                      React.createElement('span', {
                        key: index,
                        className: "px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                      }, capability)
                    )
                  ),
                
                React.createElement('div', { className: "flex gap-4 text-sm text-gray-500 dark:text-gray-400" },
                  React.createElement('span', null, `任务: ${agent.totalTasks || 0}`),
                  React.createElement('span', null, `成功率: ${Math.round(agent.successRate || 100)}%`),
                  React.createElement('span', null, `平均响应: ${Math.round(agent.avgResponseTime || 0)}ms`),
                  agent.lastActivity &&
                    React.createElement('span', null,
                      `最后活动: ${new Date(agent.lastActivity).toLocaleString()}`
                    )
                ),

                agent.currentTask &&
                  React.createElement('div', { className: "mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm" },
                    React.createElement('span', { className: "text-blue-700 dark:text-blue-300" },
                      `当前任务: ${agent.currentTask}`
                    )
                  )
              ),
              
              React.createElement('div', { className: "flex gap-2 ml-4" },
                React.createElement('button', {
                  onClick: () => handleEdit(agent),
                  disabled: loading,
                  className: "px-3 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                }, '编辑'),
                React.createElement('button', {
                  onClick: () => handleDelete(agent),
                  disabled: loading || agent.status === 'working',
                  className: "px-3 py-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                }, '删除')
              )
            )
          )
        )
    )
  );
}