import { useState } from 'react';
import { Upload, RefreshCw, CheckCircle, Clock, Edit3, Music, Image, User } from 'lucide-react';
import { useAppStore } from '@/store';
import { BatchCard } from '@/components/BatchCard';
import { ImportModal } from '@/components/ImportModal';

export const Dashboard = () => {
  const { batches, rerunBatch, addToast, showHumanError } = useAppStore();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const stats = {
    normal: batches.filter((b) => b.status === 'normal' || b.status === 'completed').length,
    pending: batches.filter((b) => b.status === 'pending_review').length,
    supplemented: batches.filter((b) => b.status === 'supplemented').length,
  };

  const handleRerunAll = () => {
    if (batches.length === 0) {
      showHumanError('EMPTY_DATA');
      return;
    }
    addToast('info', '正在重跑所有批次...');
    setTimeout(() => {
      addToast('success', '所有批次重跑完成');
    }, 2000);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto scrollbar-thin">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-gold-200 text-shadow-gold mb-2">
              KTV 曲库下架复核
            </h1>
            <p className="text-white/60">
              管理曲目别名、查看课时签到照片、完成复核流程
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRerunAll} className="btn-secondary flex items-center gap-2">
              <RefreshCw size={18} />
              全部重跑
            </button>
            <button
              onClick={() => setImportModalOpen(true)}
              className="btn-gold flex items-center gap-2"
            >
              <Upload size={18} />
              导入曲目别名表
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6 border-l-4 border-l-forest-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-forest-700/30 flex items-center justify-center">
                <CheckCircle className="text-forest-400" size={24} />
              </div>
              <span className="text-4xl font-bold text-forest-400">{stats.normal}</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">顺利通过</h3>
            <p className="text-sm text-white/50">正常复核完成的批次</p>
          </div>

          <div className="glass-card p-6 border-l-4 border-l-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-700/30 flex items-center justify-center">
                <Clock className="text-orange-400" size={24} />
              </div>
              <span className="text-4xl font-bold text-orange-400">{stats.pending}</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">待录音师复核</h3>
            <p className="text-sm text-white/50">赠票售票混批，需人工确认</p>
          </div>

          <div className="glass-card p-6 border-l-4 border-l-gray-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gray-700/30 flex items-center justify-center">
                <Edit3 className="text-gray-400" size={24} />
              </div>
              <span className="text-4xl font-bold text-gray-400">{stats.supplemented}</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">旧口径补录</h3>
            <p className="text-sm text-white/50">从签到照片补充信息的批次</p>
          </div>
        </div>

        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-wine-800/50 flex items-center justify-center">
              <Music className="text-gold-400" size={28} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-gold-200">
                演示流程说明
              </h2>
              <p className="text-sm text-white/50">
                供许老师给新人讲解的标准流程
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-forest-700/20 border border-forest-700/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-forest-700 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="font-semibold text-forest-300">顺利记录</span>
              </div>
              <p className="text-sm text-white/70">
                《夜曲》单首，纯售票，新口径。系统自动判断正常通过，无需额外操作。
              </p>
            </div>
            <div className="p-4 rounded-lg bg-orange-700/20 border border-orange-700/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-orange-700 text-white text-xs font-bold flex items-center justify-center">2</span>
                <span className="font-semibold text-orange-300">混批场景</span>
              </div>
              <p className="text-sm text-white/70">
                《稻香》+《晴天》，同批次有赠票有售票。系统自动标记"待录音师复核"，不自动归正常。
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-700/20 border border-gray-700/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-gray-700 text-white text-xs font-bold flex items-center justify-center">3</span>
                <span className="font-semibold text-gray-300">旧口径补录</span>
              </div>
              <p className="text-sm text-white/70">
                《七里香》，系统初判下架。许老师从课时签到照片发现旧口径备注，人工修正为保留。
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-white mb-4">
            复核批次列表
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {batches.map((batch, index) => (
              <BatchCard key={batch.id} batch={batch} index={index} />
            ))}
          </div>
        </div>
      </div>

      <ImportModal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} />
    </div>
  );
};
