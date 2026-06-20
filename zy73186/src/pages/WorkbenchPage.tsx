import React, { useState, useEffect } from 'react';
import { Play, FileText, AlertTriangle } from 'lucide-react';
import { ProgressBar } from '@/components/workbench/ProgressBar';
import { MaterialUploader } from '@/components/workbench/MaterialUploader';
import { ComputationTimeline } from '@/components/workbench/ComputationTimeline';
import { ParameterCompare } from '@/components/workbench/ParameterCompare';
import { Button } from '@/components/common/Button';
import { useSessionStore } from '@/stores/useSessionStore';
import { useMaterialStore } from '@/stores/useMaterialStore';
import { useComputationStore } from '@/stores/useComputationStore';
import { useAuditStore } from '@/stores/useAuditStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import type { Material, ComputationStep, MaterialType } from '@/types';

const WorkbenchPage: React.FC = () => {
  const {
    currentSession,
    createSession,
    updateSessionStatus,
    setCurrentStep,
    updateProgress,
  } = useSessionStore();
  const { materials, addMaterial } = useMaterialStore();
  const { steps, expandedSteps, toggleStep, updateStepResult, computeErrorPropagation } = useComputationStore();
  const { createSuspendedTask } = useAuditStore();
  const [showCompareMode, setShowCompareMode] = useState(false);
  const [compareSteps, setCompareSteps] = useState<{
    left: ComputationStep[] | null;
    right: ComputationStep[] | null;
  }>({ left: null, right: null });

  const { lastSaveTime, isSaving, triggerSave } = useAutoSave(currentSession?.id || null);

  const sessionMaterials = currentSession
    ? materials.filter((m) => m.sessionId === currentSession.id)
    : [];

  const sessionSteps = currentSession
    ? steps.filter((s) => s.sessionId === currentSession.id)
    : [];

  const sessionExpandedSteps = currentSession
    ? expandedSteps.filter((id) => {
        const step = steps.find((s) => s.id === id);
        return step?.sessionId === currentSession.id;
      })
    : [];

  useEffect(() => {
    if (!currentSession) {
      createSession();
    }
  }, [currentSession, createSession]);

  useEffect(() => {
    if (currentSession && sessionSteps.length > 0) {
      const totalSteps = sessionSteps.length;
      const maxStepOrder = Math.max(...sessionSteps.map((s) => s.stepOrder));
      setCurrentStep(maxStepOrder);
      updateProgress({
        totalSteps,
        currentStep: maxStepOrder,
        completionPercentage: ((maxStepOrder + 1) / totalSteps) * 100,
      });
    }
  }, [sessionSteps, currentSession, setCurrentStep, updateProgress]);

  const handleUploadMaterial = async (
    type: MaterialType,
    content: string,
    name: string
  ) => {
    if (!currentSession) throw new Error('No active session');

    const result = await addMaterial(currentSession.id, type, content, name);

    if (result.duplicateCheck.isDuplicate && type === 'boundary_sample') {
      await updateSessionStatus('suspended');
    }

    return result;
  };

  const handleCompute = async (
    formula: string,
    variables: any[],
    resultUnit: string,
    description: string
  ) => {
    if (!currentSession) return;
    await computeErrorPropagation(currentSession.id, formula, variables, resultUnit, description);
  };

  const handleSetCompareMode = () => {
    if (sessionSteps.length >= 2) {
      const mid = Math.floor(sessionSteps.length / 2);
      setCompareSteps({
        left: sessionSteps.slice(0, mid),
        right: sessionSteps.slice(mid),
      });
      setShowCompareMode(true);
    }
  };

  const handleManualSave = () => {
    triggerSave();
  };

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-[#718096] font-mono">初始化会话中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <ProgressBar
        session={currentSession}
        lastSaveTime={lastSaveTime}
        isSaving={isSaving}
        totalSteps={currentSession.progress.totalSteps || Math.max(sessionSteps.length, 1)}
        currentStep={currentSession.currentStep}
        onSave={handleManualSave}
      />

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center py-8 border-b border-[#4a5568]">
            <h1 className="font-mono text-2xl text-[#e2e8f0] tracking-wide mb-2">
              误差传播边界复核
            </h1>
            <p className="text-sm text-[#718096]">
              上传材料 → 执行计算 → 生成报告 · 支持断点续传和人工修改审计
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <MaterialUploader
                sessionId={currentSession.id}
                materials={sessionMaterials}
                onUpload={handleUploadMaterial}
                onCreateSuspendedTask={createSuspendedTask}
                disabled={currentSession.status === 'suspended' || currentSession.status === 'completed'}
              />
            </div>

            <div>
              <ComputationTimeline
                steps={sessionSteps}
                expandedSteps={sessionExpandedSteps}
                onToggleStep={toggleStep}
                onUpdateStepResult={async (stepId, newResult, reason) => {
                  await updateStepResult(stepId, newResult, reason);
                }}
                onSetCompareMode={handleSetCompareMode}
                sessionId={currentSession.id}
                disabled={currentSession.status === 'suspended' || currentSession.status === 'completed'}
              />
            </div>
          </div>

          <div className="flex justify-center gap-4 pt-4">
            <Button
              variant="primary"
              size="lg"
              icon={<FileText className="w-4 h-4" />}
              onClick={() => {
                window.location.href = `/reports?sessionId=${currentSession.id}`;
              }}
              disabled={sessionSteps.length === 0}
            >
              生成报告
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Play className="w-4 h-4" />}
              onClick={() => {
                window.location.href = '/history';
              }}
            >
              查看历史
            </Button>
          </div>

          {currentSession.status === 'suspended' && (
            <div className="p-4 bg-[#dd6b20]/10 border border-[#dd6b20]/50 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#dd6b20] flex-shrink-0" />
              <div>
                <p className="font-mono text-sm text-[#e2e8f0]">会话已挂起</p>
                <p className="text-xs text-[#a0aec0]">
                  检测到重复样本或口径变更，需前往挂起队列处理后才能继续
                </p>
              </div>
              <Button
                variant="warning"
                size="sm"
                className="ml-auto"
                onClick={() => (window.location.href = '/pending')}
              >
                处理挂起
              </Button>
            </div>
          )}
        </div>
      </main>

      {showCompareMode && compareSteps.left && compareSteps.right && (
        <ParameterCompare
          leftSteps={compareSteps.left}
          rightSteps={compareSteps.right}
          onClose={() => {
            setShowCompareMode(false);
            setCompareSteps({ left: null, right: null });
          }}
        />
      )}
    </div>
  );
};

export default WorkbenchPage;
