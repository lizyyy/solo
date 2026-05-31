import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  X,
  User,
  Music,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RefreshCw,
  Filter,
  Zap,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { SourceTag } from '../components/ui/SourceTag';
import { MismatchRecord, MismatchType, DataSource, BeatRecord } from '../types';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function MismatchHandler() {
  const {
    mismatchRecords,
    records,
    sections,
    updateMismatchStatus,
    updateRecord,
  } = useStore();

  const { success, warning } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'fixed' | 'ignored'>('pending');
  const [filterSource, setFilterSource] = useState<'all' | DataSource>('all');
  const [showFilters, setShowFilters] = useState(true);

  const filteredMismatches = useMemo(() => {
    return mismatchRecords.filter((m) => {
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      if (filterSource !== 'all' && m.source !== filterSource) return false;
      return true;
    }).sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }, [mismatchRecords, filterStatus, filterSource]);

  const stats = useMemo(() => {
    return {
      total: mismatchRecords.length,
      pending: mismatchRecords.filter((m) => m.status === 'pending').length,
      fixed: mismatchRecords.filter((m) => m.status === 'fixed').length,
      ignored: mismatchRecords.filter((m) => m.status === 'ignored').length,
    };
  }, [mismatchRecords]);

  const getRecordById = (id: string) => records.find((r) => r.id === id);

  const getMismatchTypeInfo = (type: MismatchType) => {
    switch (type) {
      case MismatchType.DISCONTINUOUS:
        return {
          label: '小节不连续',
          color: 'text-warning-600',
          bgColor: 'bg-warning-100',
          icon: Clock,
        };
      case MismatchType.OVERLAP:
        return {
          label: '小节重叠',
          color: 'text-error-600',
          bgColor: 'bg-error-100',
          icon: Zap,
        };
      case MismatchType.REVERSED:
        return {
          label: '小节颠倒',
          color: 'text-error-600',
          bgColor: 'bg-error-100',
          icon: ArrowRight,
        };
      default:
        return {
          label: '未知',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: AlertTriangle,
        };
    }
  };

  const getSourceInfo = (source: DataSource) => {
    switch (source) {
      case DataSource.METRONOME:
        return { label: '节拍器记录', description: '来自节拍器自动记录的数据' };
      case DataSource.MUSIC_SHEET:
        return { label: '选曲表', description: '来自选曲表或乐谱PDF的数据' };
      case DataSource.MANUAL:
        return { label: '手工录入', description: '人工手动输入的数据' };
      default:
        return { label: '未知来源', description: '' };
    }
  };

  const handleFix = (mismatch: MismatchRecord) => {
    const record = getRecordById(mismatch.recordId);
    if (!record) {
      warning('找不到对应的记录');
      return;
    }

    if (mismatch.mismatchType === MismatchType.REVERSED) {
      const newStart = Math.min(record.measureStart, record.measureEnd);
      const newEnd = Math.max(record.measureStart, record.measureEnd);
      updateRecord(
        record.id,
        { measureStart: newStart, measureEnd: newEnd },
        '自动修复小节颠倒',
        '系统'
      );
    }

    updateMismatchStatus(mismatch.id, 'fixed');
    success('已标记为已修复');
  };

  const handleIgnore = (mismatch: MismatchRecord) => {
    updateMismatchStatus(mismatch.id, 'ignored');
    success('已忽略此错位');
  };

  const handleReopen = (mismatch: MismatchRecord) => {
    updateMismatchStatus(mismatch.id, 'pending');
    success('已重新打开此错位');
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const MismatchCard = ({ mismatch }: { mismatch: MismatchRecord }) => {
    const record = getRecordById(mismatch.recordId);
    const typeInfo = getMismatchTypeInfo(mismatch.mismatchType);
    const sourceInfo = getSourceInfo(mismatch.source);
    const TypeIcon = typeInfo.icon;
    const isExpanded = expandedId === mismatch.id;

    if (!record) return null;

    return (
      <div
        className={`card overflow-hidden transition-all duration-300 ${
          mismatch.status === 'fixed' ? 'opacity-75' : ''
        } ${mismatch.status === 'ignored' ? 'opacity-60' : ''}`}
      >
        <div
          className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => toggleExpand(mismatch.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo.bgColor} flex-shrink-0`}>
                <TypeIcon className={`w-5 h-5 ${typeInfo.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeInfo.bgColor} ${typeInfo.color}`}>
                    <TypeIcon className="w-3 h-3" />
                    {typeInfo.label}
                  </span>
                  <SourceTag source={mismatch.source} />
                  {mismatch.status === 'fixed' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success-100 text-success-700">
                      <Check className="w-3 h-3" />
                      已修复
                    </span>
                  )}
                  {mismatch.status === 'ignored' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      <X className="w-3 h-3" />
                      已忽略
                    </span>
                  )}
                </div>
                <p className="mt-2 font-medium text-gray-900">{mismatch.description}</p>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {record.studentName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Music className="w-3.5 h-3.5" />
                    {record.sectionName}
                  </span>
                  <span className="font-mono text-xs">
                    小节 {record.measureStart}-{record.measureEnd}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-2">数据来源</h4>
                <p className="text-lg font-medium text-gray-900">{sourceInfo.label}</p>
                <p className="text-sm text-gray-500 mt-1">{sourceInfo.description}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary-50">
                <h4 className="text-sm font-medium text-gray-700 mb-2">下一步找谁</h4>
                <p className="text-lg font-medium text-secondary-700">{mismatch.suggestedHandler}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {mismatch.suggestedHandler === '声部长' && '请联系声部负责人核对原始记录'}
                  {mismatch.suggestedHandler === '指挥' && '请与指挥确认排练顺序和范围'}
                  {mismatch.suggestedHandler === '本人核对' && '请该同学自行确认数据准确性'}
                </p>
              </div>
            </div>

            <div className="handling-caliber">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">处理口径</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {mismatch.mismatchType === MismatchType.REVERSED && (
                    <>
                      <li>• 检查选曲表或乐谱PDF确认正确的小节范围</li>
                      <li>• 如确实写反了，点击"自动修复"系统会自动调换顺序</li>
                      <li>• 修复后请确认小节范围的准确性</li>
                    </>
                  )}
                  {mismatch.mismatchType === MismatchType.OVERLAP && (
                    <>
                      <li>• 查看该学生当天的所有记录，确认是否重复录入</li>
                      <li>• 如果是重复记录，请合并或删除多余的记录</li>
                      <li>• 如果是不同段落，请明确标注每段的内容</li>
                    </>
                  )}
                  {mismatch.mismatchType === MismatchType.DISCONTINUOUS && (
                    <>
                      <li>• 检查节拍器记录是否有遗漏</li>
                      <li>• 确认中间缺失的小节是否真的没有演奏</li>
                      <li>• 如确实跳过了，请在备注中说明原因</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                检测时间：{format(new Date(mismatch.detectedAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
              </span>
              <div className="flex items-center gap-2">
                {mismatch.status === 'pending' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFix(mismatch);
                      }}
                      className="btn btn-success text-sm py-1.5 px-3"
                    >
                      <Check className="w-4 h-4" />
                      {mismatch.mismatchType === MismatchType.REVERSED ? '自动修复' : '标记已修复'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIgnore(mismatch);
                      }}
                      className="btn btn-ghost text-sm py-1.5 px-3"
                    >
                      <X className="w-4 h-4" />
                      忽略
                    </button>
                  </>
                )}
                {mismatch.status !== 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReopen(mismatch);
                    }}
                    className="btn btn-secondary text-sm py-1.5 px-3"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新打开
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-warning-600" />
            小节错位处理
          </h2>
          <p className="text-sm text-gray-500 mt-1">处理检测到的小节错位问题，明确来源和责任人</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <span className="text-gray-700 font-bold">{stats.total}</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">总错位数</p>
              <p className="font-medium text-gray-900">个</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">待处理</p>
              <p className="font-medium text-warning-700">{stats.pending} 个</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-success-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">已修复</p>
              <p className="font-medium text-success-700">{stats.fixed} 个</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <X className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">已忽略</p>
              <p className="font-medium text-gray-700">{stats.ignored} 个</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
          >
            <Filter className="w-4 h-4" />
            筛选条件
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  className="input-field"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待处理</option>
                  <option value="fixed">已修复</option>
                  <option value="ignored">已忽略</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
                <select
                  className="input-field"
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as any)}
                >
                  <option value="all">全部来源</option>
                  <option value={DataSource.METRONOME}>节拍器记录</option>
                  <option value={DataSource.MUSIC_SHEET}>选曲表</option>
                  <option value={DataSource.MANUAL}>手工录入</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {filteredMismatches.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-success-500" />
              </div>
              <p className="text-gray-500">
                {filterStatus === 'pending' ? '没有待处理的错位问题' : '没有找到符合条件的错位记录'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {filterStatus === 'pending' && '所有问题都已处理完毕，太棒了！'}
              </p>
            </div>
          ) : (
            filteredMismatches.map((mismatch) => (
              <MismatchCard key={mismatch.id} mismatch={mismatch} />
            ))
          )}
        </div>

        {filteredMismatches.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              共 <strong>{filteredMismatches.length}</strong> 条错位记录
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
