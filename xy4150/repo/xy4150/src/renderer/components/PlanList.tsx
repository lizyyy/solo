import React from 'react';
import { TrainingPlan } from '../../shared/types';
import { useAppContext } from '../App';
import { createDefaultPlan, generateId } from '../../shared/StorageManager';
import { formatTimestamp } from '../../shared/utils';
import { HAND_ACTIONS, ACTION_TYPE_TO_LABEL } from '../../shared/constants';

const PlanList: React.FC = () => {
  const { plans, storage, setCurrentPlan, setCurrentView, refreshPlans } = useAppContext();

  const handleCreatePlan = () => {
    const newPlan = createDefaultPlan();
    newPlan.name = `新训练方案 ${plans.length + 1}`;
    storage.savePlan(newPlan);
    setCurrentPlan(newPlan);
    setCurrentView('editor');
    refreshPlans();
  };

  const handleEditPlan = (plan: TrainingPlan) => {
    setCurrentPlan(plan);
    setCurrentView('editor');
  };

  const handleStartTraining = (plan: TrainingPlan) => {
    setCurrentPlan(plan);
    setCurrentView('training');
  };

  const handleDeletePlan = (planId: string) => {
    if (confirm('确定要删除这个训练方案吗？此操作不可恢复。')) {
      storage.deletePlan(planId);
      refreshPlans();
    }
  };

  const handleDuplicatePlan = (planId: string) => {
    const newPlan = storage.duplicatePlan(planId);
    if (newPlan) {
      refreshPlans();
    }
  };

  const getActionSummary = (plan: TrainingPlan): string => {
    const actionTypes = new Set<string>();
    plan.steps.forEach((step) => {
      const action = HAND_ACTIONS.find((a) => a.id === step.actionId);
      if (action) {
        actionTypes.add(ACTION_TYPE_TO_LABEL[action.type] || action.label);
      }
    });
    return Array.from(actionTypes).join('、');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>训练方案列表</h2>
        <button style={styles.createButton} onClick={handleCreatePlan}>
          ➕ 新建方案
        </button>
      </div>

      {plans.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📋</div>
          <p style={styles.emptyText}>暂无训练方案</p>
          <p style={styles.emptyHint}>点击上方按钮创建第一个训练方案</p>
        </div>
      ) : (
        <div style={styles.planGrid}>
          {plans.map((plan) => (
            <div key={plan.id} style={styles.planCard}>
              <div style={styles.planHeader}>
                <h3 style={styles.planName}>{plan.name}</h3>
                <span style={styles.planMeta}>{plan.bpm} BPM</span>
              </div>
              
              <p style={styles.planDescription}>{plan.description}</p>
              
              <div style={styles.planInfo}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>动作：</span>
                  <span style={styles.infoValue}>{getActionSummary(plan)}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>步骤数：</span>
                  <span style={styles.infoValue}>{plan.steps.length} 步</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>更新时间：</span>
                  <span style={styles.infoValue}>{formatTimestamp(new Date(plan.updatedAt).getTime())}</span>
                </div>
              </div>

              <div style={styles.planActions}>
                <button style={styles.startButton} onClick={() => handleStartTraining(plan)}>
                  ▶️ 开始训练
                </button>
                <button style={styles.editButton} onClick={() => handleEditPlan(plan)}>
                  ✏️ 编辑
                </button>
                <button style={styles.duplicateButton} onClick={() => handleDuplicatePlan(plan.id)}>
                  📋 复制
                </button>
                <button style={styles.deleteButton} onClick={() => handleDeletePlan(plan.id)}>
                  🗑️ 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#409eff',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    backgroundColor: '#fff',
    borderRadius: '12px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#606266',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#909399',
  },
  planGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '20px',
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    border: '1px solid #e4e7ed',
    transition: 'all 0.2s',
  },
  planHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  planName: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
  },
  planMeta: {
    fontSize: '14px',
    color: '#409eff',
    backgroundColor: '#ecf5ff',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  planDescription: {
    fontSize: '14px',
    color: '#606266',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  planInfo: {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#f5f7fa',
    borderRadius: '8px',
  },
  infoItem: {
    display: 'flex',
    marginBottom: '6px',
  },
  infoLabel: {
    fontSize: '13px',
    color: '#909399',
    minWidth: '70px',
  },
  infoValue: {
    fontSize: '13px',
    color: '#303133',
    fontWeight: 500,
  },
  planActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  startButton: {
    padding: '8px 16px',
    backgroundColor: '#67c23a',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
  },
  editButton: {
    padding: '8px 16px',
    backgroundColor: '#409eff',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
  },
  duplicateButton: {
    padding: '8px 16px',
    backgroundColor: '#e6a23c',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#f56c6c',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
  },
};

export default PlanList;
