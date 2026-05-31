import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import StatusBadge from '@/components/StatusBadge';
import DifficultyBadge from '@/components/DifficultyBadge';
import { CheckCircle, AlertTriangle, Clock, Eye, ArrowLeft, RefreshCw, FileWarning, ImageOff } from 'lucide-react';

const ConfirmPage = () => {
  const navigate = useNavigate();
  const chains = useStore(state => state.chains);
  const mistakes = useStore(state => state.mistakes);
  const resolveConflict = useStore(state => state.resolveConflict);
  const loadFromStorage = useStore(state => state.loadFromStorage);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (chains.length === 0) {
      loadFromStorage();
    }
  }, [chains.length, loadFromStorage]);

  const pendingChains = chains.filter(c => c.status === 'pending' || c.status === 'conflict');

  const handleResolve = async (chainId: string) => {
    setResolving(chainId);
    await new Promise(resolve => setTimeout(resolve, 500));
    resolveConflict(chainId);
    setResolving(null);
  };

  const handleViewEvidence = (chainId: string) => {
    navigate(`/evidence/${chainId}`);
  };

  if (chains.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-12 h-12 text-primary-400" />
        </div>
        <h3 className="text-xl font-semibold text-primary-800 mb-2">暂无数据</h3>
        <p className="text-primary-600 mb-6">请先导入材料包以查看待确认记录</p>
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
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/overview')}
          className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-primary-600" />
        </button>
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary-800 mb-1">人工确认</h2>
          <p className="text-primary-600">
            处理重复项和冲突记录，确认后状态将更新为"已确认"
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-primary-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-primary-800">{chains.length}</p>
              <p className="text-sm text-primary-600">总记录数</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <FileWarning className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-yellow-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-yellow-700">
                {chains.filter(c => c.status === 'pending').length}
              </p>
              <p className="text-sm text-yellow-600">待处理（重复项）</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-red-700">
                {chains.filter(c => c.status === 'conflict').length}
              </p>
              <p className="text-sm text-red-600">有冲突</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {pendingChains.length === 0 ? (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-green-800 mb-2">全部处理完成</h3>
          <p className="text-green-600">所有记录已确认，没有待处理的项目</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingChains.map((chain, index) => {
            const mistake = mistakes.find(m => m.id === chain.mistakeId);
            if (!mistake) return null;

            return (
              <div 
                key={chain.id}
                className="bg-white rounded-xl border border-primary-100 shadow-sm p-6 animate-slide-in"
                style={{ opacity: 0, animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <span className="font-semibold text-primary-800 text-lg">
                        {mistake.studentName}
                      </span>
                      <span className="font-mono text-primary-600 text-sm">
                        {mistake.questionId}
                      </span>
                      <DifficultyBadge difficulty={mistake.difficulty} />
                      <StatusBadge status={chain.status} />
                    </div>

                    <div className="flex flex-wrap gap-3 mb-4">
                      {chain.hasDuplicate && (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                          <FileWarning className="w-4 h-4" />
                          <span>存在重复记录</span>
                        </span>
                      )}
                      {chain.missingSnapshot && (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                          <ImageOff className="w-4 h-4" />
                          <span>缺少讲义截图</span>
                        </span>
                      )}
                      {chain.status === 'conflict' && (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                          <AlertTriangle className="w-4 h-4" />
                          <span>难度标签冲突</span>
                        </span>
                      )}
                    </div>

                    <p className="text-primary-600 text-sm">
                      {chain.currentConclusion}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 ml-6">
                    <button
                      onClick={() => handleViewEvidence(chain.id)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg font-medium transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>查看证据</span>
                    </button>
                    <button
                      onClick={() => handleResolve(chain.id)}
                      disabled={resolving === chain.id}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors"
                    >
                      {resolving === chain.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>确认处理</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConfirmPage;
