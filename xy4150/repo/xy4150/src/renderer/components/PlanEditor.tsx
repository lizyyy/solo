import React, { useState, useEffect } from 'react';
import { TrainingPlan, TrainingStep, HandActionType } from '../../shared/types';
import { useAppContext } from '../App';
import { HAND_ACTIONS, MIN_BPM, MAX_BPM, MIN_BEATS_PER_MEASURE, MAX_BEATS_PER_MEASURE, DEFAULT_BPM, DEFAULT_BEATS_PER_MEASURE, ACTION_TYPE_TO_LABEL } from '../../shared/constants';
import { generateId, clamp } from '../../shared/utils';

const PlanEditor: React.FC = () => {
  const { currentPlan, storage, setCurrentView, refreshPlans } = useAppContext();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(DEFAULT_BEATS_PER_MEASURE);
  const [steps, setSteps] = useState<TrainingStep[]>([]);

  useEffect(() => {
    if (currentPlan) {
      setName(currentPlan.name);
      setDescription(currentPlan.description);
      setBpm(currentPlan.bpm);
      setBeatsPerMeasure(currentPlan.beatsPerMeasure);
      setSteps([...currentPlan.steps]);
    }
  }, [currentPlan]);

  const handleSave = () => {
    if (!name.trim()) {
      alert('请输入方案名称');
      return;
    }
    if (steps.length === 0) {
      alert('请至少添加一个训练步骤');
      return;
    }

    const updatedPlan: TrainingPlan = {
      id: currentPlan?.id || generateId(),
      name: name.trim(),
      description: description.trim(),
      bpm,
      beatsPerMeasure,
      steps,
      repeatCount: currentPlan?.repeatCount || 3,
      createdAt: currentPlan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.savePlan(updatedPlan);
    refreshPlans();
    setCurrentView('plans');
  };

  const handleCancel = () => {
    setCurrentView('plans');
  };

  const handleAddStep = () => {
    const newStep: TrainingStep = {
      id: generateId(),
      actionId: HAND_ACTIONS[0].id,
      beatCount: 4,
      holdBeats: 0,
    };
    setSteps([...steps, newStep]);
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
  };

  const handleUpdateStep = (stepId: string, updates: Partial<TrainingStep>) => {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
  };

  const handleBpmChange = (value: number) => {
    setBpm(clamp(value, MIN_BPM, MAX_BPM));
  };

  const handleBeatsPerMeasureChange = (value: number) => {
    setBeatsPerMeasure(clamp(value, MIN_BEATS_PER_MEASURE, MAX_BEATS_PER_MEASURE));
  };

  const getActionEmoji = (actionType: HandActionType): string => {
    switch (actionType) {
      case 'fist': return '✊';
      case 'palm': return '🖐️';
      case 'pinch': return '🤏';
      default: return '❓';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          {currentPlan ? '编辑训练方案' : '新建训练方案'}
        </h2>
        <div style={styles.headerActions}>
          <button style={styles.cancelButton} onClick={handleCancel}>
            取消
          </button>
          <button style={styles.saveButton} onClick={handleSave}>
            💾 保存方案
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>基本信息</h3>
          
          <div style={styles.formRow}>
            <label style={styles.label}>方案名称</label>
            <input
              type="text"
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入方案名称"
            />
          </div>

          <div style={styles.formRow}>
            <label style={styles.label}>方案描述</label>
            <textarea
              style={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入方案描述"
              rows={3}
            />
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>节拍设置</h3>
          
          <div style={styles.beatSettings}>
            <div style={styles.settingItem}>
              <label style={styles.settingLabel}>节拍速度 (BPM)</label>
              <div style={styles.settingControls}>
                <button
                  style={styles.miniButton}
                  onClick={() => handleBpmChange(bpm - 5)}
                >
                  -
                </button>
                <input
                  type="number"
                  style={styles.numberInput}
                  value={bpm}
                  onChange={(e) => handleBpmChange(Number(e.target.value))}
                  min={MIN_BPM}
                  max={MAX_BPM}
                />
                <button
                  style={styles.miniButton}
                  onClick={() => handleBpmChange(bpm + 5)}
                >
                  +
                </button>
              </div>
              <span style={styles.settingHint}>
                范围: {MIN_BPM} - {MAX_BPM}
              </span>
            </div>

            <div style={styles.settingItem}>
              <label style={styles.settingLabel}>每小节节拍数</label>
              <div style={styles.settingControls}>
                <button
                  style={styles.miniButton}
                  onClick={() => handleBeatsPerMeasureChange(beatsPerMeasure - 1)}
                >
                  -
                </button>
                <input
                  type="number"
                  style={styles.numberInput}
                  value={beatsPerMeasure}
                  onChange={(e) => handleBeatsPerMeasureChange(Number(e.target.value))}
                  min={MIN_BEATS_PER_MEASURE}
                  max={MAX_BEATS_PER_MEASURE}
                />
                <button
                  style={styles.miniButton}
                  onClick={() => handleBeatsPerMeasureChange(beatsPerMeasure + 1)}
                >
                  +
                </button>
              </div>
              <span style={styles.settingHint}>
                范围: {MIN_BEATS_PER_MEASURE} - {MAX_BEATS_PER_MEASURE}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>训练步骤</h3>
            <button style={styles.addButton} onClick={handleAddStep}>
              ➕ 添加步骤
            </button>
          </div>

          {steps.length === 0 ? (
            <div style={styles.emptySteps}>
              <p>暂无步骤，点击上方按钮添加</p>
            </div>
          ) : (
            <div style={styles.stepsList}>
              {steps.map((step, index) => {
                const action = HAND_ACTIONS.find((a) => a.id === step.actionId);
                return (
                  <div key={step.id} style={styles.stepCard}>
                    <div style={styles.stepHeader}>
                      <span style={styles.stepNumber}>步骤 {index + 1}</span>
                      <div style={styles.stepActions}>
                        {index > 0 && (
                          <button
                            style={styles.iconButton}
                            onClick={() => handleMoveStep(index, 'up')}
                            title="上移"
                          >
                            ↑
                          </button>
                        )}
                        {index < steps.length - 1 && (
                          <button
                            style={styles.iconButton}
                            onClick={() => handleMoveStep(index, 'down')}
                            title="下移"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          style={styles.deleteStepButton}
                          onClick={() => handleRemoveStep(step.id)}
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div style={styles.stepContent}>
                      <div style={styles.stepField}>
                        <label style={styles.stepLabel}>动作类型</label>
                        <select
                          style={styles.select}
                          value={step.actionId}
                          onChange={(e) => handleUpdateStep(step.id, { actionId: e.target.value })}
                        >
                          {HAND_ACTIONS.map((a) => (
                            <option key={a.id} value={a.id}>
                              {getActionEmoji(a.type)} {a.label} - {a.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={styles.stepField}>
                        <label style={styles.stepLabel}>持续节拍数</label>
                        <div style={styles.stepControls}>
                          <button
                            style={styles.miniButton}
                            onClick={() => handleUpdateStep(step.id, { beatCount: Math.max(1, step.beatCount - 1) })}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            style={styles.smallNumberInput}
                            value={step.beatCount}
                            onChange={(e) => handleUpdateStep(step.id, { beatCount: Math.max(1, Number(e.target.value)) })}
                            min={1}
                          />
                          <button
                            style={styles.miniButton}
                            onClick={() => handleUpdateStep(step.id, { beatCount: step.beatCount + 1 })}
                          >
                            +
                          </button>
                          <span style={styles.unitLabel}>拍</span>
                        </div>
                      </div>

                      <div style={styles.stepField}>
                        <label style={styles.stepLabel}>保持节拍数</label>
                        <div style={styles.stepControls}>
                          <button
                            style={styles.miniButton}
                            onClick={() => handleUpdateStep(step.id, { holdBeats: Math.max(0, (step.holdBeats || 0) - 1) })}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            style={styles.smallNumberInput}
                            value={step.holdBeats || 0}
                            onChange={(e) => handleUpdateStep(step.id, { holdBeats: Math.max(0, Number(e.target.value)) })}
                            min={0}
                            max={step.beatCount - 1}
                          />
                          <button
                            style={styles.miniButton}
                            onClick={() => handleUpdateStep(step.id, { holdBeats: Math.min(step.beatCount - 1, (step.holdBeats || 0) + 1) })}
                          >
                            +
                          </button>
                          <span style={styles.unitLabel}>拍</span>
                        </div>
                        <span style={styles.hintText}>
                          设置后，仅在开头几拍检测动作，后续保持姿势
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
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
  headerActions: {
    display: 'flex',
    gap: '12px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f5f7fa',
    color: '#606266',
    borderRadius: '8px',
    fontSize: '14px',
    border: '1px solid #dcdfe6',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#409eff',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
  },
  formRow: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    color: '#606266',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #dcdfe6',
    borderRadius: '8px',
    transition: 'border-color 0.2s',
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #dcdfe6',
    borderRadius: '8px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  beatSettings: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
  },
  settingItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  settingLabel: {
    fontSize: '14px',
    color: '#606266',
  },
  settingControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  miniButton: {
    width: '32px',
    height: '32px',
    backgroundColor: '#f5f7fa',
    border: '1px solid #dcdfe6',
    borderRadius: '6px',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInput: {
    width: '80px',
    padding: '8px 12px',
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center',
    border: '1px solid #dcdfe6',
    borderRadius: '6px',
  },
  settingHint: {
    fontSize: '12px',
    color: '#909399',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#ecf5ff',
    color: '#409eff',
    borderRadius: '6px',
    fontSize: '14px',
  },
  emptySteps: {
    padding: '40px',
    textAlign: 'center',
    color: '#909399',
    backgroundColor: '#f5f7fa',
    borderRadius: '8px',
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  stepCard: {
    backgroundColor: '#f5f7fa',
    borderRadius: '8px',
    padding: '16px',
  },
  stepHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  stepNumber: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#409eff',
  },
  stepActions: {
    display: 'flex',
    gap: '8px',
  },
  iconButton: {
    width: '28px',
    height: '28px',
    backgroundColor: '#fff',
    border: '1px solid #dcdfe6',
    borderRadius: '4px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteStepButton: {
    width: '28px',
    height: '28px',
    backgroundColor: '#fef0f0',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  stepField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  stepLabel: {
    fontSize: '13px',
    color: '#606266',
  },
  select: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #dcdfe6',
    borderRadius: '6px',
    backgroundColor: '#fff',
  },
  stepControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  smallNumberInput: {
    width: '60px',
    padding: '8px 8px',
    fontSize: '14px',
    textAlign: 'center',
    border: '1px solid #dcdfe6',
    borderRadius: '6px',
  },
  unitLabel: {
    fontSize: '13px',
    color: '#909399',
  },
  hintText: {
    fontSize: '12px',
    color: '#909399',
  },
};

export default PlanEditor;
