import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  Droplets,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Eye,
  Edit3,
  FileText,
  TrendingUp,
  TrendingDown,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import type { CavitationCalculation } from '../../shared/types';

export const CalculationList: React.FC = () => {
  const navigate = useNavigate();
  const { calculations, loadAllData, isLoading, currentUser, createCalculation, screenshots, samplingIntervals } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedScreenshots, setSelectedScreenshots] = useState<string[]>([]);
  const [selectedIntervals, setSelectedIntervals] = useState<string[]>([]);
  const [calcName, setCalcName] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const filteredCalculations = calculations.filter((calc) => {
    const matchesSearch = calc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      calc.pumpId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || calc.status === statusFilter;
    const matchesRisk = riskFilter === 'all' || calc.riskLevel === riskFilter;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  const stats = [
    { label: '总计算数', value: calculations.length, icon: Calculator, color: 'from-cyan-500 to-blue-500' },
    { label: '待复核', value: calculations.filter(c => c.status === 'pending_review').length, icon: AlertTriangle, color: 'from-amber-500 to-orange-500' },
    { label: '高风险', value: calculations.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length, icon: TrendingUp, color: 'from-red-500 to-rose-500' },
    { label: '已完成', value: calculations.filter(c => c.status === 'completed').length, icon: TrendingDown, color: 'from-emerald-500 to-green-500' },
  ];

  const handleCreateCalculation = async () => {
    if (selectedScreenshots.length === 0) return;
    
    const selectedShots = screenshots.filter(s => selectedScreenshots.includes(s.id));
    
    const pressure: number[] = [];
    const flowRate: number[] = [];
    const temperatures: number[] = [];
    const sampleTimes: string[] = [];
    let pumpId = '';
    
    selectedShots.forEach(shot => {
      if (shot.extractedData) {
        if (shot.extractedData.pumpId && !pumpId) pumpId = shot.extractedData.pumpId;
        if (shot.extractedData.pressure !== undefined) pressure.push(shot.extractedData.pressure);
        if (shot.extractedData.flowRate !== undefined) flowRate.push(shot.extractedData.flowRate);
        if (shot.extractedData.temperature !== undefined) temperatures.push(shot.extractedData.temperature);
        if (shot.extractedData.sampleTime) sampleTimes.push(shot.extractedData.sampleTime);
      }
    });
    
    if (!pumpId) pumpId = 'PUMP-001';
    
    const calc = await createCalculation({
      name: calcName || '汽蚀风险计算',
      pumpId,
      screenshotIds: selectedScreenshots,
      samplingIntervalIds: selectedIntervals,
      parameters: {
        pressure,
        flowRate,
        temperatures,
        sampleTimes,
        missingIntervals: [],
      },
    });
    if (calc) {
      setShowCreateModal(false);
      navigate(`/calculations/${calc.id}`);
    }
  };

  const toggleScreenshot = (id: string) => {
    setSelectedScreenshots(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleInterval = (id: string) => {
    setSelectedIntervals(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">泵站汽蚀风险计算</h1>
          <p className="text-slate-400 text-sm">所有计算任务 · 智能去重 · 全链路追溯</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" />
          新建计算
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center',
                stat.color
              )}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-slate-400">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索计算名称或泵站编号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 w-64"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
            >
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="pending_review">待复核</option>
              <option value="reviewing">复核中</option>
              <option value="completed">已完成</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>

          <div className="relative">
            <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
            >
              <option value="all">全部风险等级</option>
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
              <option value="critical">严重</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredCalculations.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 rounded-xl border border-slate-800">
            <Calculator className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 mb-2">暂无计算任务</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-cyan-400 hover:text-cyan-300 text-sm"
            >
              创建第一个计算任务
            </button>
          </div>
        ) : (
          filteredCalculations.map((calc) => (
            <CalculationCard
              key={calc.id}
              calc={calc}
              onView={() => navigate(`/calculations/${calc.id}`)}
              onAudit={() => navigate(`/audit?entityType=calculation&entityId=${calc.id}`)}
              onReport={() => navigate(`/report/${calc.id}`)}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-fade-in">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">新建汽蚀风险计算</h2>
              <p className="text-sm text-slate-400 mt-1">
                选择截图和采样间隔说明
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  计算名称
                </label>
                <input
                  type="text"
                  value={calcName}
                  onChange={(e) => setCalcName(e.target.value)}
                  placeholder="例如：1号泵站主泵汽蚀计算"
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  选择维修群截图 <span className="text-amber-400">*</span>
                </label>
                <div className="space-y-2 max-h-48 overflow-auto space-y-2">
                  {screenshots.filter(s => s.status !== 'duplicate').map((shot) => (
                    <label
                      key={shot.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        selectedScreenshots.includes(shot.id)
                          ? 'bg-cyan-500/10 border-cyan-500/50'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScreenshots.includes(shot.id)}
                        onChange={() => toggleScreenshot(shot.id)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{shot.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {shot.extractedData?.pumpId || '未识别泵站'} · {new Date(shot.uploadTime).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <StatusBadge status={shot.status} size="sm" />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  选择采样间隔说明（可选）
                </label>
                <div className="space-y-2 max-h-48 overflow-auto space-y-2">
                  {samplingIntervals.map((interval) => (
                    <label
                      key={interval.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        selectedIntervals.includes(interval.id)
                          ? 'bg-cyan-500/10 border-cyan-500/50'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIntervals.includes(interval.id)}
                        onChange={() => toggleInterval(interval.id)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{interval.pumpId} · {interval.description}</p>
                        <p className="text-xs text-slate-500">
                          每{interval.intervalMinutes}分钟采样 · {new Date(interval.startTime).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateCalculation}
                disabled={selectedScreenshots.length === 0}
                className={cn(
                  'px-6 py-2.5 rounded-lg text-sm font-medium transition-all',
                  selectedScreenshots.length > 0
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                )}
              >
                开始计算
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CalculationCardProps {
  calc: CavitationCalculation;
  onView: () => void;
  onAudit: () => void;
  onReport: () => void;
}

const CalculationCard: React.FC<CalculationCardProps> = ({ calc, onView, onAudit, onReport }) => {
  const { updateCalculationRemark, currentUser } = useStore();
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [remarkText, setRemarkText] = useState(calc.remark);
  const [changeReason, setChangeReason] = useState('');

  const handleSaveRemark = async () => {
    await updateCalculationRemark(calc.id, remarkText, changeReason || '修改备注');
    setIsEditingRemark(false);
    setChangeReason('');
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
            calc.riskLevel === 'low' && 'bg-emerald-500/20',
            calc.riskLevel === 'medium' && 'bg-amber-500/20',
            calc.riskLevel === 'high' && 'bg-orange-500/20',
            calc.riskLevel === 'critical' && 'bg-red-500/20'
          )}>
            <Droplets className={cn(
              'w-6 h-6',
              calc.riskLevel === 'low' && 'text-emerald-400',
              calc.riskLevel === 'medium' && 'text-amber-400',
              calc.riskLevel === 'high' && 'text-orange-400',
              calc.riskLevel === 'critical' && 'text-red-400'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold text-lg group-hover:text-cyan-300 transition-colors">
                {calc.name}
              </h3>
              <StatusBadge status={calc.status} />
              <StatusBadge status={calc.riskLevel} />
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>泵站: {calc.pumpId}</span>
              <span>·</span>
              <span>创建: {new Date(calc.createdAt).toLocaleDateString('zh-CN')}</span>
              <span>·</span>
              <span>创建人: {calc.createdBy}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={cn(
              'text-3xl font-bold font-mono',
              calc.riskLevel === 'low' && 'text-emerald-400',
              calc.riskLevel === 'medium' && 'text-amber-400',
              calc.riskLevel === 'high' && 'text-orange-400',
              calc.riskLevel === 'critical' && 'text-red-400'
            )}>
              {calc.riskScore}
              <span className="text-sm font-normal text-slate-500 ml-1">分</span>
            </div>
            <div className="text-xs text-slate-500">
              NPSH可用: {calc.result.npshAvailable.toFixed(2)}m
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">NPSH 必需值</div>
          <div className="text-lg font-mono text-slate-200">{calc.result.npshRequired.toFixed(2)}m</div>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">汽蚀概率</div>
          <div className="text-lg font-mono text-slate-200">{(calc.result.cavitationProbability * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">数据点数</div>
          <div className="text-lg font-mono text-slate-200">{calc.parameters.sampleTimes?.length || 0} 个</div>
        </div>
      </div>

      {calc.parameters.missingIntervals.length > 0 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-300 font-medium">
            缺失 {calc.parameters.missingIntervals.length} 个采样间隔
            </p>
            <p className="text-xs text-amber-200/80">
              {calc.parameters.missingIntervals.map((m, i) => (
                <span key={i} className="mr-2">
                  {new Date(m.start).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})} - {new Date(m.end).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}
                  ({m.duration}分钟)
                </span>
              ))}
            </p>
            <p className="text-xs text-amber-300/60 mt-1">已流转质检员复核，别急着归正常</p>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">备注</span>
          {!isEditingRemark && (
            <button
              onClick={() => {
                setRemarkText(calc.remark);
                setIsEditingRemark(true);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              修改
            </button>
          )}
        </div>
        {isEditingRemark ? (
          <div className="space-y-2">
            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
              rows={2}
              placeholder="输入备注信息..."
            />
            <input
              type="text"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
              placeholder="修改原因（可选）"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveRemark}
                className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded text-xs font-medium"
              >
                保存
              </button>
              <button
                onClick={() => setIsEditingRemark(false)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300 bg-slate-800/30 rounded-lg p-3">
            {calc.remark || '暂无备注'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>
            截图 {calc.screenshotIds.length} 张 · 采样间隔 {calc.samplingIntervalIds.length} 条
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAudit}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <Clock className="w-3 h-3" />
            变更历史
          </button>
          <button
            onClick={onReport}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <FileText className="w-3 h-3" />
            复盘报告
          </button>
          <button
            onClick={onView}
            className="px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium flex items-center gap-1 transition-colors"
          >
            <Eye className="w-3 h-3" />
            查看详情
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
