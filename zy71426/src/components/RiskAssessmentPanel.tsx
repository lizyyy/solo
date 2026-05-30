import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, FilePlus, Gauge, AlertCircle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { ConclusionType } from '../types';
import { getRiskLevelLabel, getRiskLevelColor, getRiskLevelBgColor, getConclusionLabel, validateJudgment } from '../utils/gameEngine';

const RiskAssessmentPanel = () => {
  const { currentCaseId, cases, evidenceMarks, riskAssessment, updateRiskAssessment, submitJudgment, triggerMaterialUpdate, currentUpdateIndex, showMaterialUpdate } = useGameStore();
  const [showWarnings, setShowWarnings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCase = cases.find(c => c.id === currentCaseId);

  if (!currentCase || !riskAssessment) return null;

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const score = parseInt(e.target.value);
    updateRiskAssessment({ score });
  };

  const handleConclusionChange = (conclusion: ConclusionType) => {
    updateRiskAssessment({ conclusion });
  };

  const handleSubmit = () => {
    const validation = validateJudgment(currentCase, evidenceMarks, riskAssessment);
    
    if (!validation.isValid) {
      setShowWarnings(true);
      return;
    }

    if (validation.warnings.length > 0 && !showWarnings) {
      setShowWarnings(true);
      return;
    }

    setIsSubmitting(true);
    
    setTimeout(() => {
      const result = submitJudgment();
      setIsSubmitting(false);
      
      if (result.isCorrect) {
        window.location.href = `/result/${currentCaseId}`;
      } else {
        window.location.href = `/result/${currentCaseId}`;
      }
    }, 500);
  };

  const handleTriggerUpdate = () => {
    triggerMaterialUpdate();
  };

  const getScoreColor = (score: number) => {
    if (score < 25) return 'from-emerald-500 to-emerald-600';
    if (score < 50) return 'from-amber-500 to-amber-600';
    if (score < 75) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  const conclusions: { type: ConclusionType; icon: React.ElementType; color: string; hoverColor: string }[] = [
    { type: 'approve', icon: CheckCircle, color: 'text-emerald-400', hoverColor: 'hover:bg-emerald-500/20' },
    { type: 'reject', icon: XCircle, color: 'text-red-400', hoverColor: 'hover:bg-red-500/20' },
    { type: 'supplement', icon: FilePlus, color: 'text-amber-400', hoverColor: 'hover:bg-amber-500/20' }
  ];

  const validation = validateJudgment(currentCase, evidenceMarks, riskAssessment);

  return (
    <div className="file-folder">
      <h3 className="text-lg font-bold mb-6 text-detective-accent flex items-center gap-2">
        <Gauge className="w-5 h-5" />
        风险评估
      </h3>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-300">风险评分</label>
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold bg-gradient-to-r ${getScoreColor(riskAssessment.score)} bg-clip-text text-transparent`}>
              {riskAssessment.score}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelBgColor(riskAssessment.level)} ${getRiskLevelColor(riskAssessment.level)}`}>
              {getRiskLevelLabel(riskAssessment.level)}
            </span>
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={riskAssessment.score}
          onChange={handleScoreChange}
          className="w-full h-2 bg-detective-bgLighter rounded-lg appearance-none cursor-pointer accent-detective-accent"
          style={{
            background: `linear-gradient(to right, #10b981 0%, #10b981 25%, #f59e0b 25%, #f59e0b 50%, #f97316 50%, #f97316 75%, #dc2626 75%, #dc2626 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>低风险 0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>极高风险 100</span>
        </div>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium text-slate-300 mb-3 block">案件结论</label>
        <div className="grid grid-cols-3 gap-3">
          {conclusions.map((item) => {
            const Icon = item.icon;
            const isSelected = riskAssessment.conclusion === item.type;
            return (
              <button
                key={item.type}
                onClick={() => handleConclusionChange(item.type)}
                className={`p-4 rounded-lg border transition-all duration-200 flex flex-col items-center gap-2 ${
                  isSelected
                    ? 'border-detective-accent bg-detective-accent/20'
                    : `border-detective-bgLighter ${item.hoverColor}`
                }`}
              >
                <Icon className={`w-8 h-8 ${isSelected ? 'text-detective-accent' : item.color}`} />
                <span className={`text-sm font-medium ${isSelected ? 'text-detective-accent' : 'text-slate-300'}`}>
                  {getConclusionLabel(item.type)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {showWarnings && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="mb-6 p-4 rounded-lg bg-detective-danger/10 border border-detective-danger/30 animate-shake">
          {validation.errors.length > 0 && (
            <div className="mb-3">
              <h4 className="text-detective-danger font-semibold mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                错误
              </h4>
              <ul className="text-sm text-slate-300 space-y-1">
                {validation.errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div>
              <h4 className="text-amber-400 font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                警告
              </h4>
              <ul className="text-sm text-slate-300 space-y-1">
                {validation.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
              {validation.errors.length === 0 && (
                <p className="text-xs text-slate-400 mt-3">
                  您可以忽略警告并继续提交，或返回检查。
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {currentCase.materialUpdates.length > currentUpdateIndex && !showMaterialUpdate && (
          <button
            onClick={handleTriggerUpdate}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            查看补传材料 ({currentCase.materialUpdates.length - currentUpdateIndex})
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-detective-bg border-t-transparent rounded-full animate-spin"></div>
              提交中...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              提交判断
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RiskAssessmentPanel;
