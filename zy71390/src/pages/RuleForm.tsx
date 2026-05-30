import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useStore } from '@/store';
import Skeleton from '@/components/Skeleton';
import type { CreateRuleRequest, UpdateRuleRequest, Tier, RuleStatus } from '../../shared/types';
import { TIER_LABELS, STATUS_LABELS } from '../../shared/types';

export default function RuleForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const rules = useStore((state) => state.rules);
  const fetchRules = useStore((state) => state.fetchRules);
  const createRule = useStore((state) => state.createRule);
  const updateRule = useStore((state) => state.updateRule);
  const createLoading = useStore((state) => state.loading.createRule);
  const updateLoading = useStore((state) => state.loading[`updateRule:${editId}`]);
  const rulesLoading = useStore((state) => state.loading.rules);
  const error = useStore((state) => state.error);

  const isEdit = !!editId;
  const editingRule = rules.find((r) => r.id === editId);

  const [formData, setFormData] = useState({
    name: '',
    path: '',
    method: 'GET' as CreateRuleRequest['method'],
    windowSize: 60,
    limit: 100,
    tier: 'B' as Tier,
    status: 'active' as RuleStatus,
    changeReason: '',
  });

  useEffect(() => {
    if (isEdit && rules.length === 0) {
      fetchRules();
    }
  }, [isEdit, rules.length, fetchRules]);

  useEffect(() => {
    if (editingRule) {
      setFormData({
        name: editingRule.name,
        path: editingRule.path,
        method: editingRule.method,
        windowSize: editingRule.windowSize,
        limit: editingRule.limit,
        tier: editingRule.tier,
        status: editingRule.status,
        changeReason: '',
      });
    }
  }, [editingRule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.changeReason.trim()) return;

    let result;
    if (isEdit && editId) {
      const updateData: UpdateRuleRequest = {
        name: formData.name,
        path: formData.path,
        method: formData.method,
        windowSize: formData.windowSize,
        limit: formData.limit,
        tier: formData.tier,
        status: formData.status,
        changeReason: formData.changeReason,
      };
      result = await updateRule(editId, updateData);
    } else {
      const createData: CreateRuleRequest = {
        name: formData.name,
        path: formData.path,
        method: formData.method,
        windowSize: formData.windowSize,
        limit: formData.limit,
        tier: formData.tier,
        changeReason: formData.changeReason,
      };
      result = await createRule(createData);
    }

    if (result) {
      navigate('/rules');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (isEdit && rulesLoading) {
    return (
      <div className="card p-6">
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isLoading = isEdit ? updateLoading : createLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/rules')}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">
          {isEdit ? '编辑规则' : '新建规则'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              规则名称 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="请输入规则名称"
              className="w-full px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              接口路径 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="path"
              value={formData.path}
              onChange={handleChange}
              placeholder="例如：/api/v1/users"
              className="w-full px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              请求方法 <span className="text-danger">*</span>
            </label>
            <select
              name="method"
              value={formData.method}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary transition-colors"
              required
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="*">全部方法</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              适用层级 <span className="text-danger">*</span>
            </label>
            <select
              name="tier"
              value={formData.tier}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary transition-colors"
              required
            >
              <option value="S">{TIER_LABELS.S}</option>
              <option value="A">{TIER_LABELS.A}</option>
              <option value="B">{TIER_LABELS.B}</option>
              <option value="C">{TIER_LABELS.C}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              时间窗(秒) <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              name="windowSize"
              value={formData.windowSize}
              onChange={handleChange}
              min={1}
              max={3600}
              className="w-full px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              阈值 <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              name="limit"
              value={formData.limit}
              onChange={handleChange}
              min={1}
              className="w-full px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                状态 <span className="text-danger">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary transition-colors"
                required
              >
                <option value="active">{STATUS_LABELS.active}</option>
                <option value="draft">{STATUS_LABELS.draft}</option>
                <option value="deprecated">{STATUS_LABELS.deprecated}</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">
            修改理由 <span className="text-danger">*</span>
          </label>
          <textarea
            name="changeReason"
            value={formData.changeReason}
            onChange={handleChange}
            placeholder={isEdit ? '请描述本次修改的原因...' : '请描述创建此规则的原因...'}
            className="w-full px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors resize-none"
            rows={3}
            required
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-dark-200">
          <button
            type="button"
            onClick={() => navigate('/rules')}
            className="px-6 py-2.5 rounded-lg bg-dark-200 text-white hover:bg-dark-300 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            取消
          </button>
          <button
            type="submit"
            disabled={isLoading || !formData.changeReason.trim()}
            className="px-6 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
