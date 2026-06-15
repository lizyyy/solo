import React, { useRef, useEffect } from 'react';
import { Steps, Alert, message } from 'antd';
import { BucketImportPanel, type BucketImportPanelRef } from './components/BucketImportPanel';
import { NegativeSamplePanel, type NegativeSamplePanelRef } from './components/NegativeSamplePanel';
import { MergeRecordPanel } from './components/MergeRecordPanel';
import { useAppStore } from './store';
import type { WorkflowStep } from './types';

const steps: { key: WorkflowStep; title: string; description: string }[] = [
  { key: 'import_bucket', title: '第一步：导入线上实验桶', description: '导入并选择要处理的线上实验桶' },
  { key: 'review_negative', title: '第二步：补看负样本列表', description: '林姐复核负样本，特别关注特征缺失使用默认分的情况' },
  { key: 'update_summary', title: '第三步：更新可解释摘要', description: '确认摘要信息，特征缺失的留给推荐负责人复核' },
  { key: 'completed', title: '完成', description: '所有步骤已完成' },
];

const stepOrder: WorkflowStep[] = ['import_bucket', 'review_negative', 'update_summary', 'completed'];

function App() {
  const {
    currentStep,
    setCurrentStep,
    mergeRecords,
    scrollTarget,
    setScrollTarget,
    highlightBucketId,
    highlightSampleIds,
  } = useAppStore();

  const bucketPanelRef = useRef<BucketImportPanelRef>(null);
  const negativePanelRef = useRef<NegativeSamplePanelRef>(null);
  const mergePanelRef = useRef<HTMLDivElement>(null);

  const currentStepIndex = stepOrder.indexOf(currentStep);

  useEffect(() => {
    if (scrollTarget) {
      if (scrollTarget === 'bucket' && highlightBucketId) {
        setTimeout(() => {
          const row = document.querySelector(`[data-bucket-id="${highlightBucketId}"]`);
          if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setScrollTarget(null);
          } else {
            bucketPanelRef.current?.scrollToBucket(highlightBucketId);
            setScrollTarget(null);
          }
        }, 200);
      } else if (scrollTarget === 'negative') {
        setTimeout(() => {
          if (highlightSampleIds.length > 0 && highlightSampleIds[0]) {
            negativePanelRef.current?.scrollToSample(highlightSampleIds[0]);
            setScrollTarget(null);
          } else {
            const panel = document.getElementById('negative-sample-panel');
            if (panel) {
              panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setScrollTarget(null);
          }
        }, 200);
      } else if (scrollTarget === 'merge') {
        const panel = document.getElementById('merge-record-panel');
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setScrollTarget(null);
      }
    }
  }, [scrollTarget, highlightBucketId, highlightSampleIds, setScrollTarget]);

  const handleStepChange = (index: number) => {
    const targetStep = stepOrder[index];
    if (targetStep === 'review_negative' && mergeRecords.length === 0) {
      message.warning('请先生成实体合并记录');
      return;
    }
    setCurrentStep(targetStep);
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <div className="page-title">图神经网络实体合并</div>
        <div className="page-subtitle">
          支持线上实验桶导入去重、负样本复核、可解释摘要生成、3D/图表可视化
        </div>
      </div>

      <div className="workflow-steps">
        <Steps
          current={currentStepIndex}
          onChange={handleStepChange}
          items={steps.map(s => ({ title: s.title, description: s.description }))}
        />
      </div>

      {mergeRecords.some(r => r.featureMissing && r.isDefaultScore) && (
        <Alert
          message="注意：存在线上特征缺失使用默认分的记录，已自动标记为'复核中'状态，请推荐负责人复核后再确认，别急着归正常"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div ref={mergePanelRef}>
        <MergeRecordPanel />
      </div>

      <div id="bucket-panel">
        <BucketImportPanel ref={bucketPanelRef} />
      </div>

      <div id="negative-sample-panel">
        <NegativeSamplePanel ref={negativePanelRef} />
      </div>
    </div>
  );
}

export default App;
