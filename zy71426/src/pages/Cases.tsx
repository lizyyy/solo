import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, AlertCircle, CheckCircle2, XCircle, Clock, Star, Car, Home, Shield, Heart } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { getConclusionLabel } from '../utils/gameEngine';

const Cases = () => {
  const navigate = useNavigate();
  const { cases, setCurrentCase, loadCases } = useGameStore();

  const getCaseTypeIcon = (type: string) => {
    const icons: Record<string, React.ElementType> = {
      'vehicle': Car,
      'property': Home,
      'liability': Shield,
      'health': Heart
    };
    return icons[type] || FileText;
  };

  const getCaseTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'vehicle': '车险',
      'property': '财产险',
      'liability': '责任险',
      'health': '健康险'
    };
    return labels[type] || type;
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { icon: React.ElementType; color: string; label: string }> = {
      'pending': { icon: Clock, color: 'text-slate-400', label: '待调查' },
      'in_progress': { icon: AlertCircle, color: 'text-amber-400', label: '调查中' },
      'passed': { icon: CheckCircle2, color: 'text-emerald-400', label: '已通过' },
      'failed': { icon: XCircle, color: 'text-red-400', label: '未通过' },
      'completed': { icon: CheckCircle2, color: 'text-emerald-400', label: '已完成' }
    };
    return configs[status] || configs['pending'];
  };

  const handleSelectCase = (caseId: string) => {
    setCurrentCase(caseId);
    navigate(`/case/${caseId}`);
  };

  const handleViewResult = (caseId: string) => {
    navigate(`/result/${caseId}`);
  };

  const renderStars = (difficulty: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < difficulty ? 'text-detective-accent fill-detective-accent' : 'text-slate-600'}`}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-detective-bg p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-detective-accent transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          返回主菜单
        </button>

        <h1 className="font-serif text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-detective-accent to-amber-300">
          案件大厅
        </h1>
        <p className="text-slate-400 mb-8">选择一个案件开始你的调查工作</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((caseItem, index) => {
            const TypeIcon = getCaseTypeIcon(caseItem.type);
            const StatusIcon = getStatusConfig(caseItem.status).icon;
            const statusConfig = getStatusConfig(caseItem.status);
            
            return (
              <div
                key={caseItem.id}
                className="file-folder card-hover cursor-pointer animate-fade-in relative overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => {
                  if (caseItem.status === 'passed' || caseItem.status === 'failed') {
                    handleViewResult(caseItem.id);
                  } else {
                    handleSelectCase(caseItem.id);
                  }
                }}
              >
                {caseItem.status === 'passed' && (
                  <div className="absolute top-4 right-4">
                    <div className="stamp-green animate-stamp text-xs">已结案</div>
                  </div>
                )}
                {caseItem.status === 'failed' && (
                  <div className="absolute top-4 right-4">
                    <div className="stamp-red animate-stamp text-xs">需重审</div>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-detective-accent to-orange-500 flex items-center justify-center">
                      <TypeIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-detective-accent font-medium mb-1">
                        {getCaseTypeLabel(caseItem.type)} · {caseItem.id.toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1">
                        {renderStars(caseItem.difficulty)}
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-bold mb-3 text-slate-100 line-clamp-2">
                  {caseItem.title}
                </h3>

                <p className="text-slate-400 text-sm mb-4 line-clamp-3">
                  {caseItem.accidentCard.mainInfo}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-detective-bgLighter">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                    <span className={`text-sm ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    索赔金额: ¥{caseItem.accidentCard.claimAmount.toLocaleString()}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-detective-bgLighter flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    证据材料: {caseItem.policyClauses.length + caseItem.photoEvidence.length + 1} 份
                  </div>
                  <button
                    className="text-detective-accent text-sm font-medium hover:underline flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (caseItem.status === 'passed' || caseItem.status === 'failed') {
                        handleViewResult(caseItem.id);
                      } else {
                        handleSelectCase(caseItem.id);
                      }
                    }}
                  >
                    {caseItem.status === 'passed' || caseItem.status === 'failed' ? '查看结果' : '开始调查'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {cases.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">暂无案件数据</p>
            <button onClick={loadCases} className="btn-secondary mt-4">
              刷新数据
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cases;
