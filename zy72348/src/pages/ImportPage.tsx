import { useState } from 'react';
import { Upload, CheckCircle2, XCircle, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createBatch, createMedianAlert } from '@/utils/factories';
import { runAllSelfChecks } from '@/utils/selfCheck';
import { detectConflicts } from '@/utils/conflictDetector';
import { computeMediansFromAnnotations } from '@/utils/robustMedian';
import {
  generateNormalAnnotations,
  generateWrongCaliberAnnotations,
  generateSupplementAnnotations,
  generateDenominatorZeroAnnotations,
  generateSampleRecords,
} from '@/utils/mockData';
import type { MaterialType, SelfCheckResult } from '@/types';

type TabKey = 'normal' | 'wrong_caliber' | 'supplement' | 'denominator_zero';

const TABS: { key: TabKey; label: string; materialType: MaterialType }[] = [
  { key: 'normal', label: '正常材料', materialType: 'normal' },
  { key: 'wrong_caliber', label: '错口径材料', materialType: 'wrong_caliber' },
  { key: 'supplement', label: '补录材料', materialType: 'supplement' },
  { key: 'denominator_zero', label: '含分母为0空字符串', materialType: 'normal' },
];

const CHECK_LABELS: Record<string, string> = {
  duplicate_import: '重复导入',
  denominator_zero_empty: '分母为0空字符串',
  recalc_after_supplement: '补录后重算',
  export_consistency: '导出一致',
};

const PASS_COLOR = '#16c784';
const FAIL_COLOR = '#e94560';
const REVIEW_COLOR = '#8b5cf6';
const CARD_BG = '#1a1a2e';
const CARD_BORDER = '#2a2a4a';

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('normal');
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [lastChecks, setLastChecks] = useState<SelfCheckResult[]>([]);

  const {
    addBatch,
    addAnnotations,
    addSamples,
    addConflicts,
    addSelfChecks,
    addAlerts,
    setCurrentBatch,
    updateBatchStatus,
    initWorkflow,
    logAction,
    currentBatchId,
    getBatchById,
    getWorkflowByBatch,
    getChecksByBatch,
    annotations,
  } = useAppStore();

  const currentBatch = currentBatchId ? getBatchById(currentBatchId) : null;
  const workflowSteps = currentBatchId ? getWorkflowByBatch(currentBatchId) : [];
  const batchChecks = currentBatchId ? getChecksByBatch(currentBatchId) : [];
  const displayChecks = lastChecks.length > 0 ? lastChecks : batchChecks;

  const toggleCheck = (checkId: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) next.delete(checkId);
      else next.add(checkId);
      return next;
    });
  };

  const handleImport = () => {
    setImporting(true);
    const tab = TABS.find((t) => t.key === activeTab)!;
    const batch = createBatch('小祁', tab.materialType);

    addBatch(batch);
    setCurrentBatch(batch.id);

    let newAnnotations;
    switch (activeTab) {
      case 'normal':
        newAnnotations = generateNormalAnnotations(batch.id);
        break;
      case 'wrong_caliber':
        newAnnotations = generateWrongCaliberAnnotations(batch.id);
        break;
      case 'supplement':
        newAnnotations = generateSupplementAnnotations(batch.id);
        break;
      case 'denominator_zero':
        newAnnotations = generateDenominatorZeroAnnotations(batch.id);
        break;
    }

    addAnnotations(newAnnotations);

    const samples = generateSampleRecords(batch.id);
    addSamples(samples);

    updateBatchStatus(batch.id, 'checking');

    const currentMedians = computeMediansFromAnnotations([...annotations, ...newAnnotations]);
    const previousMedians = computeMediansFromAnnotations(annotations);

    const supplementAnns = activeTab === 'supplement' ? newAnnotations : [];

    const displayData = currentMedians.map((m) => ({
      subject: m.subject,
      median: m.value,
      alert: Math.abs(m.value - 0.9) > 0.9 * 0.15,
    }));
    const exportData = [...displayData];

    const checks = runAllSelfChecks(
      batch,
      newAnnotations,
      annotations,
      currentMedians,
      previousMedians,
      supplementAnns,
      displayData,
      exportData,
    );
    addSelfChecks(checks);
    setLastChecks(checks);

    const { conflicts, evidences } = detectConflicts(newAnnotations, samples);
    addConflicts(conflicts, evidences);

    const alerts = currentMedians.map((m) =>
      createMedianAlert(batch.id, m.subject, m.value, 0.9),
    );
    addAlerts(alerts);

    initWorkflow(batch.id, '小祁');

    const allPassed = checks.every((c) => c.passed);
    const hasConflicts = conflicts.length > 0;

    if (hasConflicts) {
      updateBatchStatus(batch.id, 'conflicted');
    } else if (allPassed) {
      updateBatchStatus(batch.id, 'checked');
    } else {
      updateBatchStatus(batch.id, 'conflicted');
    }

    logAction(batch.id, 'import', '小祁', `导入${tab.label}，共${newAnnotations.length}条批注，自检${allPassed ? '全部通过' : '存在异常'}`);

    setImporting(false);
  };

  const stepStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return PASS_COLOR;
      case 'in_progress': return REVIEW_COLOR;
      case 'blocked': return FAIL_COLOR;
      default: return '#555';
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, color: '#e0e0e0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>数据导入与自检</h1>

      {currentBatch && (
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <span style={{ color: '#888', fontSize: 13 }}>当前批次</span>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                {currentBatch.id}
                <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px', borderRadius: 4, background: CARD_BORDER, color: '#ccc' }}>
                  {currentBatch.status}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#888', fontSize: 13 }}>操作人</span>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{currentBatch.operator}</div>
            </div>
          </div>

          {workflowSteps.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {workflowSteps.map((step) => (
                <div
                  key={step.id}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: CARD_BORDER,
                    borderLeft: `3px solid ${stepStatusColor(step.status)}`,
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, color: stepStatusColor(step.status) }}>
                    Step {step.stepIndex}
                  </div>
                  <div style={{ color: '#aaa', marginTop: 2 }}>{step.stepName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 700 : 400,
              background: activeTab === tab.key ? REVIEW_COLOR : CARD_BORDER,
              color: activeTab === tab.key ? '#fff' : '#aaa',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleImport}
        disabled={importing}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 28px',
          borderRadius: 8,
          border: 'none',
          cursor: importing ? 'not-allowed' : 'pointer',
          background: importing ? '#333' : REVIEW_COLOR,
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 24,
          transition: 'all 0.2s',
        }}
      >
        <Upload size={18} />
        {importing ? '导入中…' : '导入并自检'}
      </button>

      {displayChecks.length > 0 && (
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${CARD_BORDER}`, fontWeight: 700, fontSize: 15 }}>
            自检结果
          </div>
          {displayChecks.map((check) => {
            const expanded = expandedChecks.has(check.id);
            const iconColor = check.passed ? PASS_COLOR : FAIL_COLOR;
            const Icon = check.passed ? CheckCircle2 : check.checkType === 'denominator_zero_empty' ? AlertTriangle : XCircle;
            return (
              <div key={check.id} style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                <div
                  onClick={() => toggleCheck(check.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 18px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <Icon size={18} color={iconColor} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
                    {CHECK_LABELS[check.checkType] ?? check.checkType}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      padding: '2px 10px',
                      borderRadius: 4,
                      background: check.passed ? 'rgba(22,199,132,0.15)' : 'rgba(233,69,96,0.15)',
                      color: iconColor,
                      fontWeight: 600,
                    }}
                  >
                    {check.passed ? '通过' : '未通过'}
                  </span>
                  {expanded ? <ChevronDown size={16} color="#888" /> : <ChevronRight size={16} color="#888" />}
                </div>
                {expanded && (
                  <div style={{ padding: '0 18px 14px 46px', fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
                    {check.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
