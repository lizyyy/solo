import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  FileText,
  Download,
  Check,
  X,
  Scale,
  Lightbulb,
  ChevronRight,
  Filter,
  Search,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useHistoryStore } from '@/store/useHistoryStore';
import { ConflictDetector } from '@/engine/ConflictDetector';
import { cn } from '@/lib/utils';
import type { Conflict, GameRound } from '@/types/game';

export default function ConflictsPage() {
  const {
    rounds,
    conflicts,
    loadAllData,
    updateConflict,
    addConflict,
  } = useHistoryStore();

  const [selected, setSelected] = useState<Conflict | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [resolutionReason, setResolutionReason] = useState('');
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    roundId: '',
    field: 'score',
    classroomValue: '',
    classroomNote: '',
    classroomSource: '课堂计分表',
    importedValue: '',
    importedNote: '',
    importedSource: '导入数据',
    suggestedAction: '',
    suggestedReason: '',
  });

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const allConflicts = Object.values(conflicts).flat();

  const filteredConflicts = allConflicts.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (searchTerm) {
      const round = rounds.find((r: GameRound) => r.id === c.roundId);
      const search = searchTerm.toLowerCase();
      return (
        c.field.toLowerCase().includes(search) ||
        round?.playerName.toLowerCase().includes(search) ||
        round?.levelName.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const pendingCount = allConflicts.filter((c) => c.status === 'pending').length;
  const resolvedCount = allConflicts.filter((c) => c.status === 'resolved').length;

  const getRoundInfo = (roundId: string) => {
    return rounds.find((r: GameRound) => r.id === roundId);
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      score: '分数',
      resources: '资源',
      risk: '风险',
      scoreDelta: '分数变化',
      resourceDelta: '资源变化',
      finalScore: '最终分数',
      finalResources: '最终资源',
      finalRisk: '最终风险',
    };
    return labels[field] || field;
  };

  const getDiff = (conflict: Conflict) => {
    const v1 = Number(conflict.classroomData.value);
    const v2 = Number(conflict.importedData.value);
    if (!isNaN(v1) && !isNaN(v2)) {
      return v1 - v2;
    }
    return 0;
  };

  const handleResolve = (conflict: Conflict, resolution: 'classroom' | 'imported') => {
    const detector = new ConflictDetector();
    const reason = resolutionReason || conflict.suggestedReason;
    const updated = detector.resolveConflict(conflict, resolution, reason);
    updateConflict(conflict.id, updated);
    setResolutionReason('');
    setSelected(null);
    setShowEvidenceModal(false);
  };

  const handleViewEvidence = (conflict: Conflict) => {
    setSelected(conflict);
    setResolutionReason(conflict.suggestedReason);
    setShowEvidenceModal(true);
  };

  const generateSuggestion = (field: string, classroomValue: string, importedValue: string) => {
    const fieldLabel = getFieldLabel(field);
    const cVal = Number(classroomValue);
    const iVal = Number(importedValue);
    
    if (!isNaN(cVal) && !isNaN(iVal)) {
      const diff = cVal - iVal;
      const absDiff = Math.abs(diff);
      
      if (absDiff <= 5) {
        return {
          suggestedAction: '建议采信课堂计分表数据',
          suggestedReason: `${fieldLabel}差异较小（${diff > 0 ? '+' : ''}${diff}），课堂数据通常更准确，建议采信课堂计分表。`,
        };
      } else if (cVal > iVal) {
        return {
          suggestedAction: '建议核实后采信课堂数据',
          suggestedReason: `${fieldLabel}课堂数据比导入数据高${diff}，差异较大，建议核实原始记录后采信课堂计分表。`,
        };
      } else {
        return {
          suggestedAction: '建议核实后采信导入数据',
          suggestedReason: `${fieldLabel}导入数据比课堂数据高${Math.abs(diff)}，差异较大，建议核实后采信导入数据。`,
        };
      }
    }
    
    return {
      suggestedAction: '建议人工核实后裁决',
      suggestedReason: `${fieldLabel}数据格式存在差异，建议人工核对原始记录后进行裁决。`,
    };
  };

  const handleFormChange = (field: string, value: string) => {
    const updated = { ...formData, [field]: value };
    
    if (field === 'classroomValue' || field === 'importedValue' || field === 'field') {
      const suggestion = generateSuggestion(
        updated.field,
        updated.classroomValue,
        updated.importedValue
      );
      updated.suggestedAction = suggestion.suggestedAction;
      updated.suggestedReason = suggestion.suggestedReason;
    }
    
    setFormData(updated);
  };

  const handleCreateConflict = () => {
    if (!formData.roundId || !formData.classroomValue || !formData.importedValue) {
      return;
    }

    const now = new Date().toISOString();
    const newConflict: Conflict = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      roundId: formData.roundId,
      field: formData.field,
      classroomData: {
        value: isNaN(Number(formData.classroomValue)) ? formData.classroomValue : Number(formData.classroomValue),
        note: formData.classroomNote,
        source: formData.classroomSource,
        timestamp: now,
      },
      importedData: {
        value: isNaN(Number(formData.importedValue)) ? formData.importedValue : Number(formData.importedValue),
        note: formData.importedNote,
        source: formData.importedSource,
        timestamp: now,
      },
      status: 'pending',
      resolution: 'pending',
      suggestedAction: formData.suggestedAction || '建议人工核实后裁决',
      suggestedReason: formData.suggestedReason || '手动补录的差异记录，请核实后裁决。',
    };

    addConflict(newConflict);
    setShowCreateModal(false);
    setFormData({
      roundId: '',
      field: 'score',
      classroomValue: '',
      classroomNote: '',
      classroomSource: '课堂计分表',
      importedValue: '',
      importedNote: '',
      importedSource: '导入数据',
      suggestedAction: '',
      suggestedReason: '',
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Scale className="text-gold-500" size={40} />
            <div>
            <h1 className="text-3xl font-bold text-gold-500">冲突处理</h1>
            <p className="text-vinyl-400">处理课堂计分表与导入数据的冲突</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gold-500 text-vinyl-900 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gold-400 transition-colors font-medium"
          >
            <Plus size={16} />
            手动补录差异
          </button>
          <button
            onClick={loadAllData}
            className="bg-vinyl-700 text-vinyl-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-vinyl-600 transition-colors"
          >
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
      </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="text-vinyl-400" size={20} />
              <span className="text-vinyl-400 text-sm">总计</span>
            </div>
            <div className="text-3xl font-bold text-vinyl-100">{allConflicts.length}</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-orange-500/30 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <Clock className="text-orange-400" size={20} />
              <span className="text-orange-400 text-sm">待处理</span>
            </div>
            <div className="text-3xl font-bold text-orange-400">{pendingCount}</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-green-500/30 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="text-green-400" size={20} />
              <span className="text-green-400 text-sm">已解决</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{resolvedCount}</div>
          </motion.div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-vinyl-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索玩家、关卡或字段..."
              className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg pl-10 pr-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-vinyl-400" />
            {(['all', 'pending', 'resolved'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filterStatus === status
                    ? 'bg-gold-500 text-vinyl-900'
                    : 'bg-vinyl-700 text-vinyl-300 hover:bg-vinyl-600'
                )}
              >
                {status === 'all' ? '全部' : status === 'pending' ? '待处理' : '已解决'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredConflicts.length === 0 ? (
            <div className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 p-12 text-center">
              <CheckCircle className="mx-auto text-green-400 mb-4" size={48} />
              <p className="text-xl text-vinyl-300 mb-1">暂无冲突数据</p>
              <p className="text-vinyl-500">所有数据已同步一致</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredConflicts.map((conflict) => {
                const round = getRoundInfo(conflict.roundId);
                const diff = getDiff(conflict);
                return (
                  <motion.div
                    key={conflict.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 p-5 hover:border-vinyl-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          conflict.status === 'pending' ? 'bg-orange-500/20' : 'bg-green-500/20'
                        )}>
                          {conflict.status === 'pending' ? (
                            <AlertTriangle className="text-orange-400" size={20} />
                          ) : (
                            <CheckCircle className="text-green-400" size={20} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-vinyl-100">
                              {round?.playerName || '未知玩家'}
                            </span>
                            <span className="text-xs text-vinyl-500">
                              {round?.levelName}
                            </span>
                          </div>
                          <div className="text-sm text-vinyl-400">
                            字段: <span className="text-vinyl-200">{getFieldLabel(conflict.field)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'px-2.5 py-1 rounded text-xs font-medium',
                          conflict.status === 'pending'
                            ? 'text-orange-400 bg-orange-500/20'
                            : 'text-green-400 bg-green-500/20'
                        )}>
                          {conflict.status === 'pending' ? '待处理' : '已解决'}
                        </span>
                        {conflict.status === 'resolved' && (
                          <span className={cn(
                            'px-2.5 py-1 rounded text-xs font-medium',
                            conflict.resolution === 'classroom'
                              ? 'text-blue-400 bg-blue-500/20'
                              : 'text-purple-400 bg-purple-500/20'
                          )}>
                            {conflict.resolution === 'classroom' ? '采信课堂' : '采信导入'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={14} className="text-blue-400" />
                          <span className="text-sm font-medium text-blue-400">课堂计分表</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-300 font-mono">
                          {conflict.classroomData.value}
                        </div>
                        <div className="text-xs text-vinyl-500 mt-1">
                          {formatDateTime(conflict.classroomData.timestamp)}
                        </div>
                        {conflict.classroomData.note && (
                          <div className="text-xs text-vinyl-400 mt-1 italic">
                            备注: {conflict.classroomData.note}
                          </div>
                        )}
                      </div>

                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Download size={14} className="text-purple-400" />
                          <span className="text-sm font-medium text-purple-400">导入数据</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-300 font-mono">
                          {conflict.importedData.value}
                        </div>
                        <div className="text-xs text-vinyl-500 mt-1">
                          {formatDateTime(conflict.importedData.timestamp)}
                        </div>
                        {conflict.importedData.note && (
                          <div className="text-xs text-vinyl-400 mt-1 italic">
                            备注: {conflict.importedData.note}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-vinyl-500">
                        <span className="flex items-center gap-1">
                          <Scale size={12} />
                          差异: {diff > 0 ? '+' : ''}{diff}
                        </span>
                        {conflict.resolvedBy && (
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            裁决人: {conflict.resolvedBy}
                          </span>
                        )}
                        {conflict.resolvedAt && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDateTime(conflict.resolvedAt)}
                          </span>
                        )}
                      </div>

                      {conflict.status === 'pending' && (
                        <button
                          onClick={() => handleViewEvidence(conflict)}
                          className="text-gold-400 hover:text-gold-300 text-sm font-medium flex items-center gap-1"
                        >
                          查看详情并裁决
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <AnimatePresence>
          {showEvidenceModal && selected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowEvidenceModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-vinyl-800 rounded-xl border border-vinyl-700 w-full max-w-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-vinyl-700">
                  <h2 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                    <Scale size={24} />
                    证据对比与裁决
                  </h2>
                </div>

                <div className="p-6 space-y-6">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                      <div>
                        <div className="font-medium text-yellow-400 mb-1">
                          {selected.suggestedAction}
                        </div>
                        <p className="text-sm text-yellow-200/80">
                          {selected.suggestedReason}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-blue-400" />
                          <span className="font-medium text-blue-400">课堂计分表</span>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-blue-300 font-mono mb-3">
                        {selected.classroomData.value}
                      </div>
                      <div className="text-sm text-vinyl-400 mb-2">
                        <span className="text-vinyl-500">来源:</span> {selected.classroomData.source}
                      </div>
                      <div className="text-sm text-vinyl-400 mb-2">
                        <span className="text-vinyl-500">时间:</span> {formatDateTime(selected.classroomData.timestamp)}
                      </div>
                      {selected.classroomData.note && (
                        <div className="text-sm text-vinyl-300 bg-vinyl-700/50 p-2 rounded mt-2">
                          <span className="text-vinyl-500">备注:</span> {selected.classroomData.note}
                        </div>
                      )}
                    </div>

                    <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Download size={16} className="text-purple-400" />
                          <span className="font-medium text-purple-400">导入数据</span>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-purple-300 font-mono mb-3">
                        {selected.importedData.value}
                      </div>
                      <div className="text-sm text-vinyl-400 mb-2">
                        <span className="text-vinyl-500">来源:</span> {selected.importedData.source}
                      </div>
                      <div className="text-sm text-vinyl-400 mb-2">
                        <span className="text-vinyl-500">时间:</span> {formatDateTime(selected.importedData.timestamp)}
                      </div>
                      {selected.importedData.note && (
                        <div className="text-sm text-vinyl-300 bg-vinyl-700/50 p-2 rounded mt-2">
                          <span className="text-vinyl-500">备注:</span> {selected.importedData.note}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-vinyl-300 mb-2">裁决理由</label>
                    <textarea
                      value={resolutionReason}
                      onChange={(e) => setResolutionReason(e.target.value)}
                      placeholder="请输入裁决理由..."
                      rows={3}
                      className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-3 text-vinyl-100 focus:border-gold-500 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleResolve(selected, 'classroom')}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors"
                    >
                      <Check size={18} />
                      采信课堂数据
                    </button>
                    <button
                      onClick={() => handleResolve(selected, 'imported')}
                      className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-purple-500 transition-colors"
                    >
                      <Check size={18} />
                      采信导入数据
                    </button>
                    <button
                      onClick={() => setShowEvidenceModal(false)}
                      className="px-6 bg-vinyl-700 text-vinyl-300 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-vinyl-600 transition-colors"
                    >
                      <X size={18} />
                      取消
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-vinyl-800 rounded-xl border border-vinyl-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-vinyl-700">
                  <h2 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                    <Plus size={24} />
                    手动补录差异
                  </h2>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-vinyl-300 mb-2">比赛局</label>
                      <select
                        value={formData.roundId}
                        onChange={(e) => handleFormChange('roundId', e.target.value)}
                        className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
                      >
                        <option value="">请选择比赛局</option>
                        {rounds.map((round: GameRound) => (
                          <option key={round.id} value={round.id}>
                            {round.playerName} - {round.levelName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-vinyl-300 mb-2">字段</label>
                      <select
                        value={formData.field}
                        onChange={(e) => handleFormChange('field', e.target.value)}
                        className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-2.5 text-vinyl-100 focus:border-gold-500 focus:outline-none"
                      >
                        <option value="score">分数</option>
                        <option value="resources">资源</option>
                        <option value="risk">风险</option>
                        <option value="finalScore">最终分数</option>
                        <option value="finalResources">最终资源</option>
                        <option value="finalRisk">最终风险</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText size={16} className="text-blue-400" />
                        <span className="font-medium text-blue-400">课堂计分表</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-vinyl-400 mb-1">数值</label>
                          <input
                            type="text"
                            value={formData.classroomValue}
                            onChange={(e) => handleFormChange('classroomValue', e.target.value)}
                            placeholder="请输入数值"
                            className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-3 py-2 text-vinyl-100 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-vinyl-400 mb-1">备注</label>
                          <input
                            type="text"
                            value={formData.classroomNote}
                            onChange={(e) => handleFormChange('classroomNote', e.target.value)}
                            placeholder="备注（可选）"
                            className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-3 py-2 text-vinyl-100 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-vinyl-400 mb-1">来源</label>
                          <input
                            type="text"
                            value={formData.classroomSource}
                            onChange={(e) => handleFormChange('classroomSource', e.target.value)}
                            placeholder="来源"
                            className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-3 py-2 text-vinyl-100 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Download size={16} className="text-purple-400" />
                        <span className="font-medium text-purple-400">导入数据</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-vinyl-400 mb-1">数值</label>
                          <input
                            type="text"
                            value={formData.importedValue}
                            onChange={(e) => handleFormChange('importedValue', e.target.value)}
                            placeholder="请输入数值"
                            className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-3 py-2 text-vinyl-100 text-sm focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-vinyl-400 mb-1">备注</label>
                          <input
                            type="text"
                            value={formData.importedNote}
                            onChange={(e) => handleFormChange('importedNote', e.target.value)}
                            placeholder="备注（可选）"
                            className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-3 py-2 text-vinyl-100 text-sm focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-vinyl-400 mb-1">来源</label>
                          <input
                            type="text"
                            value={formData.importedSource}
                            onChange={(e) => handleFormChange('importedSource', e.target.value)}
                            placeholder="来源"
                            className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-3 py-2 text-vinyl-100 text-sm focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                      <div className="flex-1">
                        <div>
                          <label className="block text-xs text-yellow-400 mb-1">建议动作</label>
                          <input
                            type="text"
                            value={formData.suggestedAction}
                            onChange={(e) => handleFormChange('suggestedAction', e.target.value)}
                            placeholder="建议动作"
                            className="w-full bg-vinyl-700/50 border border-yellow-500/30 rounded-lg px-3 py-2 text-yellow-200 text-sm focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs text-yellow-400 mb-1">建议理由</label>
                          <textarea
                            value={formData.suggestedReason}
                            onChange={(e) => handleFormChange('suggestedReason', e.target.value)}
                            placeholder="建议理由"
                            rows={2}
                            className="w-full bg-vinyl-700/50 border border-yellow-500/30 rounded-lg px-3 py-2 text-yellow-200 text-sm focus:border-yellow-500 focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleCreateConflict}
                      disabled={!formData.roundId || !formData.classroomValue || !formData.importedValue}
                      className="flex-1 bg-gold-500 text-vinyl-900 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check size={18} />
                      创建冲突记录
                    </button>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-6 bg-vinyl-700 text-vinyl-300 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-vinyl-600 transition-colors"
                    >
                      <X size={18} />
                      取消
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
