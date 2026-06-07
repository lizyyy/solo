import React, { useState } from 'react';
import { List, CheckCircle, AlertTriangle, Clock, FileCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { StatsCard } from '../../components/StatsCard/StatsCard';
import { SampleCard } from '../../components/SampleCard/SampleCard';
import { SampleType } from '../../types';
import { getSampleTypeLabel } from '../../utils';

const Home: React.FC = () => {
  const { samples, getStatistics } = useStore();
  const [filterType, setFilterType] = useState<SampleType | 'all'>('all');
  const stats = getStatistics();

  const filteredSamples = filterType === 'all' 
    ? samples 
    : samples.filter(s => s.type === filterType);

  const groupedSamples = {
    [SampleType.NORMAL]: samples.filter(s => s.type === SampleType.NORMAL),
    [SampleType.VERSION_CONFLICT]: samples.filter(s => s.type === SampleType.VERSION_CONFLICT),
    [SampleType.GRAY_BACKFILL]: samples.filter(s => s.type === SampleType.GRAY_BACKFILL)
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          归因分析概览
        </h2>
        <p className="text-sm text-slate-500">
          查看所有归因样本，支持按类型筛选。包含顺利记录、版本冲突、灰度补录三种类型。
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatsCard
          title="样本总数"
          value={stats.total}
          icon={List}
          color="text-slate-700"
          bgColor="bg-slate-100"
          borderColor="border-slate-200"
        />
        <StatsCard
          title="顺利记录"
          value={stats.normal}
          icon={CheckCircle}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          borderColor="border-emerald-200"
        />
        <StatsCard
          title="存在冲突"
          value={stats.conflict}
          icon={AlertTriangle}
          color="text-red-600"
          bgColor="bg-red-50"
          borderColor="border-red-200"
        />
        <StatsCard
          title="待运营复核"
          value={stats.pendingReview}
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-50"
          borderColor="border-amber-200"
        />
        <StatsCard
          title="已确认"
          value={stats.confirmed}
          icon={FileCheck}
          color="text-blue-600"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
        />
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">筛选类型：</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              filterType === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            全部
          </button>
          {Object.values(SampleType).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                filterType === type
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {getSampleTypeLabel(type)} ({groupedSamples[type].length})
            </button>
          ))}
        </div>
      </div>

      {filterType === 'all' ? (
        <div className="space-y-6">
          {Object.values(SampleType).map((type) => (
            <div key={type}>
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                {getSampleTypeLabel(type)}
                <span className="text-xs text-slate-400">({groupedSamples[type].length} 条)</span>
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {groupedSamples[type].map((sample) => (
                  <SampleCard key={sample.id} sample={sample} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredSamples.map((sample) => (
            <SampleCard key={sample.id} sample={sample} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
