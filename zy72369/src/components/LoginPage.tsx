import { useState } from 'react';
import { useStore } from '@/store';
import type { UserRole } from '@/types';
import { Cable } from 'lucide-react';

const roles: { value: UserRole; label: string; desc: string }[] = [
  { value: 'equipment_engineer', label: '设备工程师', desc: '导入铭牌、裁决冲突、导出报告' },
  { value: 'field_worker', label: '现场施工师傅', desc: '录入数据、上传截图、补录' },
  { value: 'lab_teacher', label: '实验老师', desc: '复核异常工况、标记结论' },
];

export default function LoginPage() {
  const login = useStore(s => s.login);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('equipment_engineer');

  const handleLogin = () => {
    if (!name.trim()) return;
    login({ role, name: name.trim() });
  };

  return (
    <div className="min-h-screen bg-[#0F4C5C] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-4">
            <Cable className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">光纤弯曲损耗记录</h1>
          <p className="text-white/50 mt-2 text-sm">保留原始材料痕迹，杜绝自动拍板</p>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="请输入姓名"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">角色</label>
            <div className="space-y-2">
              {roles.map(r => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    role === r.value
                      ? 'border-[#0F4C5C] bg-[#0F4C5C]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={handleLogin}
            disabled={!name.trim()}
            className="w-full py-2.5 bg-[#0F4C5C] text-white rounded-lg font-medium text-sm hover:bg-[#0d3f4d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            进入系统
          </button>
        </div>
      </div>
    </div>
  );
}
