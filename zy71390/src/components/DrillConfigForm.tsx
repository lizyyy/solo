import { useState } from 'react';
import { Play, ChevronDown, SlidersHorizontal, Calendar, Clock } from 'lucide-react';
import { RateLimitRule, DrillConfig } from '../../shared/types';

interface DrillConfigFormProps {
  onSubmit: (config: DrillConfig) => void;
  rules: RateLimitRule[];
  loading?: boolean;
}

export default function DrillConfigForm({ onSubmit, rules, loading }: DrillConfigFormProps) {
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [sampleRate, setSampleRate] = useState<number>(0.5);

  const selectedRule = rules.find(r => r.id === selectedRuleId);
  const versions = selectedRule ? Array.from({ length: selectedRule.currentVersion }, (_, i) => i + 1) : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRuleId || !startTime || !endTime) return;

    onSubmit({
      ruleId: selectedRuleId,
      ruleVersion: selectedVersion,
      startTime,
      endTime,
      sampleRate
    });
  };

  const setDefaultTimeRange = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    setStartTime(yesterday.toISOString().slice(0, 16));
    setEndTime(now.toISOString().slice(0, 16));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-dark-100 rounded-xl border border-dark-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <SlidersHorizontal className="w-5 h-5 text-primary-light" />
        <h3 className="text-lg font-semibold text-white">演练配置</h3>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              选择规则
            </label>
            <div className="relative">
              <select
                value={selectedRuleId}
                onChange={(e) => {
                  setSelectedRuleId(e.target.value);
                  setSelectedVersion(1);
                }}
                className="w-full bg-dark border border-dark-200 text-white text-sm rounded-lg px-4 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="">请选择规则</option>
                {rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name} - {rule.path}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              选择版本
            </label>
            <div className="relative">
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(Number(e.target.value))}
                disabled={!selectedRuleId}
                className="w-full bg-dark border border-dark-200 text-white text-sm rounded-lg px-4 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>
                    版本 v{v}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-400">时间范围</label>
            <button
              type="button"
              onClick={setDefaultTimeRange}
              className="text-xs text-primary-light hover:text-primary transition-colors"
            >
              最近24小时
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-dark border border-dark-200 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-dark border border-dark-200 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-400">抽样比例</label>
            <span className="text-sm font-semibold text-primary-light">
              {Math.round(sampleRate * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={sampleRate}
            onChange={(e) => setSampleRate(Number(e.target.value))}
            className="w-full h-2 bg-dark-200 rounded-lg appearance-none cursor-pointer accent-primary-light"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>10%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={!selectedRuleId || !startTime || !endTime || loading}
          className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {loading ? '演练进行中...' : '开始演练'}
        </button>
      </div>
    </form>
  );
}
