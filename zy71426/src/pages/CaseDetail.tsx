import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, Image, Clock, User, MapPin, DollarSign } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import MarkToolbar from '../components/MarkToolbar';
import EvidencePanel from '../components/EvidencePanel';
import RiskAssessmentPanel from '../components/RiskAssessmentPanel';
import MaterialUpdateModal from '../components/MaterialUpdateModal';
import PlaybackTimeline from '../components/PlaybackTimeline';
import type { MarkType, EvidenceType } from '../types';
import { formatTime } from '../utils/playbackManager';

const CaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    cases, 
    currentCaseId, 
    setCurrentCase, 
    evidenceMarks, 
    addEvidenceMark,
    selectedClauseId,
    setSelectedClauseId,
    gameStartTime,
    isPlaybackMode,
    loadCases
  } = useGameStore();
  
  const [selectedEvidence, setSelectedEvidence] = useState<{ type: EvidenceType; id: string } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (cases.length === 0) {
      loadCases();
    }
  }, [cases.length, loadCases]);

  useEffect(() => {
    if (id && cases.length > 0 && (!currentCaseId || currentCaseId !== id)) {
      const caseData = cases.find(c => c.id === id);
      if (caseData) {
        setCurrentCase(id);
      } else {
        navigate('/cases');
      }
    }
  }, [id, currentCaseId, cases, setCurrentCase, navigate]);

  useEffect(() => {
    if (gameStartTime && !isPlaybackMode) {
      const timer = setInterval(() => {
        setElapsedTime(Date.now() - gameStartTime);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameStartTime, isPlaybackMode]);

  const currentCase = cases.find(c => c.id === currentCaseId);

  if (!currentCase) {
    return (
      <div className="min-h-screen bg-detective-bg flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">加载案件数据中...</p>
        </div>
      </div>
    );
  }

  const handleMark = (markType: MarkType) => {
    if (!selectedEvidence) return;
    
    addEvidenceMark({
      caseId: currentCaseId!,
      evidenceType: selectedEvidence.type,
      evidenceId: selectedEvidence.id,
      markType,
      note: ''
    });
    
    setSelectedEvidence(null);
  };

  const handleEvidenceClick = (type: EvidenceType, id: string) => {
    if (isPlaybackMode) return;
    
    if (selectedEvidence?.type === type && selectedEvidence?.id === id) {
      setSelectedEvidence(null);
    } else {
      setSelectedEvidence({ type, id });
    }

    if (type === 'clause') {
      setSelectedClauseId(id);
    }
  };

  const hasMark = (type: EvidenceType, id: string) => {
    return evidenceMarks.some(m => m.evidenceType === type && m.evidenceId === id);
  };

  const getMarksForEvidence = (type: EvidenceType, id: string) => {
    return evidenceMarks.filter(m => m.evidenceType === type && m.evidenceId === id);
  };

  return (
    <div className="min-h-screen bg-detective-bg p-4 md:p-8 pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cases')}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-detective-bgLighter"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-detective-accent to-amber-300">
                {currentCase.title}
              </h1>
              <p className="text-sm text-slate-400">
                {currentCase.id.toUpperCase()} · {currentCase.type === 'vehicle' ? '车险' : currentCase.type === 'property' ? '财产险' : currentCase.type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{formatTime(elapsedTime)}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-slate-400">
              <FileText className="w-4 h-4" />
              <span>已标记 {evidenceMarks.length} 处疑点</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="file-folder">
              <h3 className="text-lg font-bold mb-4 text-detective-accent flex items-center gap-2">
                <FileText className="w-5 h-5" />
                事故卡
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-detective-accent" />
                  <span className="text-slate-400">报案人：</span>
                  <span className="text-slate-200">{currentCase.accidentCard.reporter}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-detective-accent" />
                  <span className="text-slate-400">事故时间：</span>
                  <span className="text-slate-200">{currentCase.accidentCard.accidentTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-detective-accent" />
                  <span className="text-slate-400">事故地点：</span>
                  <span className="text-slate-200">{currentCase.accidentCard.location}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-detective-accent" />
                  <span className="text-slate-400">索赔金额：</span>
                  <span className="text-detective-accent font-bold">¥{currentCase.accidentCard.claimAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <EvidencePanel
              type="accident"
              title="事故描述"
              icon={FileText}
              evidenceId={currentCase.accidentCard.id}
              hasMark={hasMark('accident', currentCase.accidentCard.id)}
              hasContradiction={getMarksForEvidence('accident', currentCase.accidentCard.id).some(m => m.markType === 'contradiction')}
              isSelected={selectedEvidence?.type === 'accident' && selectedEvidence.id === currentCase.accidentCard.id}
              onClick={() => handleEvidenceClick('accident', currentCase.accidentCard.id)}
            >
              <p className="font-medium mb-2 text-detective-accent">{currentCase.accidentCard.mainInfo}</p>
              <p className="text-slate-400">{currentCase.accidentCard.description}</p>
            </EvidencePanel>
          </div>

          <div className="space-y-6">
            <div className="file-folder">
              <h3 className="text-lg font-bold mb-4 text-detective-accent flex items-center gap-2">
                <Shield className="w-5 h-5" />
                保单条款
                {selectedClauseId && (
                  <span className="text-xs px-2 py-1 rounded bg-detective-accent/20 text-detective-accent ml-2">
                    已选中条款，点击标记进行匹配
                  </span>
                )}
              </h3>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
                {currentCase.policyClauses.map((clause, index) => (
                  <EvidencePanel
                    key={clause.id}
                    type="clause"
                    title={clause.clauseNo}
                    icon={Shield}
                    evidenceId={clause.id}
                    hasMark={hasMark('clause', clause.id)}
                    hasContradiction={false}
                    isUpdated={false}
                    isSelected={selectedClauseId === clause.id}
                    onClick={() => handleEvidenceClick('clause', clause.id)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        clause.isExemption 
                          ? 'bg-red-500/20 text-red-400' 
                          : clause.type === 'coverage' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {clause.isExemption ? '免责条款' : clause.type === 'coverage' ? '保障范围' : '定义条款'}
                      </span>
                    </div>
                    <p className={clause.isExemption ? 'text-red-300' : 'text-slate-300'}>
                      {clause.content}
                    </p>
                  </EvidencePanel>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="file-folder">
              <h3 className="text-lg font-bold mb-4 text-detective-accent flex items-center gap-2">
                <Image className="w-5 h-5" />
                照片证据
              </h3>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
                {currentCase.photoEvidence.map((photo, index) => (
                  <EvidencePanel
                    key={photo.id}
                    type="photo"
                    title={photo.description.substring(0, 30) + (photo.description.length > 30 ? '...' : '')}
                    icon={Image}
                    evidenceId={photo.id}
                    hasMark={hasMark('photo', photo.id)}
                    hasContradiction={photo.contradictions.length > 0}
                    isUpdated={photo.isUpdate}
                    updateNote={photo.updateNote}
                    isSelected={selectedEvidence?.type === 'photo' && selectedEvidence.id === photo.id}
                    onClick={() => handleEvidenceClick('photo', photo.id)}
                  >
                    <div className="mb-3">
                      <img
                        src={photo.imageUrl}
                        alt={photo.description}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    </div>
                    <p className="text-slate-300 mb-2">{photo.description}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{photo.shootingTime}</span>
                      <span>{photo.shootingLocation}</span>
                    </div>
                    {photo.contradictions.length > 0 && (
                      <div className="mt-2 p-2 rounded bg-detective-danger/10 border border-detective-danger/30">
                        <p className="text-xs text-detective-danger font-medium">⚠️ 存在矛盾点</p>
                        {photo.contradictions.map((c, i) => (
                          <p key={i} className="text-xs text-slate-400 mt-1">{c}</p>
                        ))}
                      </div>
                    )}
                    {photo.isNewDamage === false && (
                      <div className="mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/30">
                        <p className="text-xs text-orange-400">🔍 疑似旧损</p>
                      </div>
                    )}
                  </EvidencePanel>
                ))}
              </div>
            </div>

            <RiskAssessmentPanel />
          </div>
        </div>
      </div>

      {isPlaybackMode && <PlaybackTimeline />}
      {!isPlaybackMode && <MarkToolbar onMark={handleMark} />}
      <MaterialUpdateModal />
    </div>
  );
};

export default CaseDetail;
