import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Difficulty, ChainStatus } from '@/types';
import { getDifficultyLabel } from '@/utils/chainBuilder';
import StatusBadge from '@/components/StatusBadge';
import DifficultyBadge from '@/components/DifficultyBadge';
import { Search, Filter, Eye, AlertTriangle, FileWarning, ImageOff, ChevronDown } from 'lucide-react';

const OverviewPage = () => {
  const navigate = useNavigate();
  const chains = useStore(state => state.chains);
  const mistakes = useStore(state => state.mistakes);
  const filters = useStore(state => state.filters);
  const setFilters = useStore(state => state.setFilters);
  const getFilteredChains = useStore(state => state.getFilteredChains);
  const loadFromStorage = useStore(state => state.loadFromStorage);
  
  const [showFilters, setShowFilters] = useState(false);
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    if (chains.length === 0) {
      loadFromStorage();
    }
  }, [chains.length, loadFromStorage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ ...filters, studentName: searchName || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchName, filters, setFilters]);

  const filteredChains = getFilteredChains();

  const handleDifficultyFilter = (difficulty: Difficulty | undefined) => {
    setFilters({ ...filters, difficulty });
  };

  const handleStatusFilter = (status: ChainStatus | undefined) => {
    setFilters({ ...filters, status });
  };

  const handleDuplicateFilter = (value: boolean | undefined) => {
    setFilters({ ...filters, hasDuplicate: value });
  };

  const handleMissingSnapshotFilter = (value: boolean | undefined) => {
    setFilters({ ...filters, missingSnapshot: value });
  };

  const handleViewEvidence = (chainId: string) => {
    navigate(`/evidence/${chainId}`);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (chains.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Search className="w-12 h-12 text-primary-400" />
        </div>
        <h3 className="text-xl font-semibold text-primary-800 mb-2">暂无数据</h3>
        <p className="text-primary-600 mb-6">请先导入材料包以查看回放记录</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors"
        >
          <span>前往导入</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary-800 mb-1">回放总览</h2>
          <p className="text-primary-600">共 {filteredChains.length} 条记录，点击查看完整证据链</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            showFilters 
              ? 'bg-primary-700 text-white' 
              : 'bg-white text-primary-700 border border-primary-200 hover:bg-primary-50'
          }`}
        >
          <Filter className="w-5 h-5" />
          <span>筛选</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl p-6 border border-primary-100 shadow-sm animate-slide-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">学生姓名</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="搜索学生姓名..."
                  className="w-full pl-10 pr-4 py-2 border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">难度</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDifficultyFilter(undefined)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    !filters.difficulty 
                      ? 'bg-primary-700 text-white' 
                      : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                  }`}
                >
                  全部
                </button>
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(diff => (
                  <button
                    key={diff}
                    onClick={() => handleDifficultyFilter(diff)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filters.difficulty === diff 
                        ? 'bg-primary-700 text-white' 
                        : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                    }`}
                  >
                    {getDifficultyLabel(diff)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">状态</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleStatusFilter(undefined)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    !filters.status 
                      ? 'bg-primary-700 text-white' 
                      : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                  }`}
                >
                  全部
                </button>
                {(['confirmed', 'pending', 'conflict'] as ChainStatus[]).map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filters.status === status 
                        ? 'bg-primary-700 text-white' 
                        : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                    }`}
                  >
                    {status === 'confirmed' ? '已确认' : status === 'pending' ? '待处理' : '有冲突'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">重复项</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDuplicateFilter(undefined)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filters.hasDuplicate === undefined 
                      ? 'bg-primary-700 text-white' 
                      : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => handleDuplicateFilter(true)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filters.hasDuplicate === true 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                >
                  仅重复
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">缺少截图</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleMissingSnapshotFilter(undefined)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filters.missingSnapshot === undefined 
                      ? 'bg-primary-700 text-white' 
                      : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => handleMissingSnapshotFilter(true)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filters.missingSnapshot === true 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  仅缺失
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-primary-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">学生</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">题目编号</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">难度</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">状态</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">标记</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">更新时间</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-primary-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {filteredChains.map((chain, index) => {
                const mistake = mistakes.find(m => m.id === chain.mistakeId);
                if (!mistake) return null;
                
                return (
                  <tr 
                    key={chain.id} 
                    className="hover:bg-primary-50 transition-colors animate-slide-in"
                    style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-primary-800">{mistake.studentName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-primary-600 font-mono text-sm">{mistake.questionId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <DifficultyBadge difficulty={mistake.difficulty} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={chain.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {chain.hasDuplicate && (
                          <span className="p-1.5 bg-yellow-100 rounded-lg" title="存在重复项">
                            <FileWarning className="w-4 h-4 text-yellow-600" />
                          </span>
                        )}
                        {chain.missingSnapshot && (
                          <span className="p-1.5 bg-amber-100 rounded-lg" title="缺少讲义截图">
                            <ImageOff className="w-4 h-4 text-amber-600" />
                          </span>
                        )}
                        {chain.status === 'conflict' && (
                          <span className="p-1.5 bg-red-100 rounded-lg" title="存在冲突">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-primary-500">{formatTime(chain.updatedAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewEvidence(chain.id)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>查看证据</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredChains.length === 0 && (
          <div className="text-center py-12">
            <p className="text-primary-500">没有符合筛选条件的记录</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewPage;
