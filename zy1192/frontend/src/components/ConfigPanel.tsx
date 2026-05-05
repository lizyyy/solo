import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  SimulationConfig,
  PrimitiveType,
  OperationStep,
  ABAStep,
} from '../types';

interface ConfigPanelProps {
  onRunSimulation: () => void;
  onRunABADemo: (mode: 'cas' | 'queue' | 'version-tagged') => void;
}

const primitiveOptions: { type: PrimitiveType; name: string; description: string }[] = [
  { type: 'mutex', name: '互斥锁 (Mutex)', description: '最基本的线程同步原语' },
  { type: 'rwlock', name: '读写锁 (RWLock)', description: '允许多个读者，单个写者' },
  { type: 'spinlock', name: '自旋锁 (SpinLock)', description: '忙等待而不是阻塞' },
  { type: 'cas', name: '比较并交换 (CAS)', description: '无锁编程的基础原语' },
  { type: 'lock-free-queue', name: '无锁队列', description: '基于 CAS 的无锁数据结构' },
  { type: 'aba', name: 'ABA 问题', description: '演示和解决 ABA 问题' },
];

const contentionOptions = [
  { value: 'low', label: '低竞争' },
  { value: 'medium', label: '中竞争' },
  { value: 'high', label: '高竞争' },
];

const operationTypes = [
  { value: 'lock', label: '加锁' },
  { value: 'unlock', label: '解锁' },
  { value: 'read', label: '读取' },
  { value: 'write', label: '写入' },
  { value: 'cas', label: 'CAS 操作' },
  { value: 'enqueue', label: '入队' },
  { value: 'dequeue', label: '出队' },
];

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ onRunSimulation, onRunABADemo }) => {
  const { config, setConfig, selectedPrimitive, setSelectedPrimitive, examples, isLoading } = useAppStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCustomOperations, setShowCustomOperations] = useState(false);
  const [showABASteps, setShowABASteps] = useState(false);

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (config.threadCount < 1 || config.threadCount > 10) {
      newErrors.threadCount = '线程数必须在 1-10 之间';
    }

    if (config.duration < 1 || config.duration > 100) {
      newErrors.duration = '模拟时长必须在 1-100 之间';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePrimitiveSelect = (type: PrimitiveType) => {
    setSelectedPrimitive(type);
  };

  const handleThreadCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 2;
    setConfig({ threadCount: value });
    if (errors.threadCount) {
      setErrors((prev) => ({ ...prev, threadCount: '' }));
    }
  };

  const handleContentionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig({ contentionLevel: e.target.value as 'low' | 'medium' | 'high' });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 10;
    setConfig({ duration: value });
    if (errors.duration) {
      setErrors((prev) => ({ ...prev, duration: '' }));
    }
  };

  const handleExampleSelect = (example: typeof examples[0]) => {
    setConfig(example.config);
    const lockTypeToPrimitive: Record<string, PrimitiveType> = {
      mutex: 'mutex',
      rwlock: 'rwlock',
      spinlock: 'spinlock',
      cas: 'cas',
      'lock-free-queue': 'lock-free-queue',
    };
    const primitive = lockTypeToPrimitive[example.config.lockType] || 'mutex';
    setSelectedPrimitive(example.config.enableABAReproduction ? 'aba' : primitive);
  };

  const addOperation = () => {
    const threadId = `t${Math.min(config.threadCount, 1)}`;
    const newOperation: OperationStep = {
      threadId,
      operation: 'lock',
      delay: 1,
    };
    setConfig({
      operationSequence: [...config.operationSequence, newOperation],
    });
  };

  const updateOperation = (index: number, field: keyof OperationStep, value: string | number) => {
    const newSequence = [...config.operationSequence];
    newSequence[index] = { ...newSequence[index], [field]: value };
    setConfig({ operationSequence: newSequence });
  };

  const removeOperation = (index: number) => {
    const newSequence = config.operationSequence.filter((_, i) => i !== index);
    setConfig({ operationSequence: newSequence });
  };

  const addABAStep = () => {
    const threadId = `t${Math.min(config.threadCount, 1)}`;
    const newStep: ABAStep = {
      threadId,
      action: 'read',
      description: '',
      delay: 1,
    };
    setConfig({
      abaSteps: [...(config.abaSteps || []), newStep],
    });
  };

  const updateABAStep = (index: number, field: keyof ABAStep, value: string | number) => {
    const newSteps = [...(config.abaSteps || [])];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setConfig({ abaSteps: newSteps });
  };

  const removeABAStep = (index: number) => {
    const newSteps = (config.abaSteps || []).filter((_, i) => i !== index);
    setConfig({ abaSteps: newSteps });
  };

  const handleRun = () => {
    if (validateConfig()) {
      onRunSimulation();
    }
  };

  const threadOptions = Array.from({ length: config.threadCount }, (_, i) => ({
    value: `t${i + 1}`,
    label: `Thread ${i + 1}`,
  }));

  return (
    <div className="config-panel">
      <section className="form-group">
        <h2 className="section-title">选择并发原语</h2>
        <div className="primitive-selector">
          {primitiveOptions.map((option) => (
            <div
              key={option.type}
              className={`primitive-card ${selectedPrimitive === option.type ? 'selected' : ''}`}
              onClick={() => handlePrimitiveSelect(option.type)}
            >
              <div className="primitive-name">{option.name}</div>
              <div className="primitive-desc">{option.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="form-group">
        <h2 className="section-title">基本配置</h2>
        
        <div className="form-group">
          <label className="form-label">线程数量 (1-10)</label>
          <input
            type="number"
            className={`form-input ${errors.threadCount ? 'error' : ''}`}
            value={config.threadCount}
            onChange={handleThreadCountChange}
            min={1}
            max={10}
          />
          {errors.threadCount && (
            <div className="input-error">{errors.threadCount}</div>
          )}
          <div className="input-helper">设置参与竞争的线程数量</div>
        </div>

        <div className="form-group">
          <label className="form-label">竞争强度</label>
          <select
            className="form-select"
            value={config.contentionLevel}
            onChange={handleContentionChange}
          >
            {contentionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="input-helper">
            高竞争 = 更短的操作间隔，更容易观察到同步原语的行为
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">模拟时长 (1-100)</label>
          <input
            type="number"
            className={`form-input ${errors.duration ? 'error' : ''}`}
            value={config.duration}
            onChange={handleDurationChange}
            min={1}
            max={100}
          />
          {errors.duration && (
            <div className="input-error">{errors.duration}</div>
          )}
          <div className="input-helper">每个线程执行的操作轮数</div>
        </div>
      </section>

      {selectedPrimitive !== 'aba' && (
        <section className="form-group">
          <button
            className="btn btn-secondary"
            onClick={() => setShowCustomOperations(!showCustomOperations)}
            style={{ marginBottom: 16 }}
          >
            {showCustomOperations ? '隐藏' : '显示'}自定义操作序列
          </button>

          {showCustomOperations && (
            <div className="custom-operations">
              <div className="button-group" style={{ marginBottom: 16 }}>
                <button className="btn btn-secondary" onClick={addOperation}>
                  + 添加操作
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfig({ operationSequence: [] })}
                >
                  清空
                </button>
              </div>

              {config.operationSequence.map((op, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    marginBottom: 12,
                    padding: 12,
                    backgroundColor: '#f8f9fa',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, minWidth: 30 }}>#{index + 1}</span>
                  
                  <select
                    className="form-select"
                    style={{ flex: 1 }}
                    value={op.threadId}
                    onChange={(e) => updateOperation(index, 'threadId', e.target.value)}
                  >
                    {threadOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ flex: 1 }}
                    value={op.operation}
                    onChange={(e) =>
                      updateOperation(index, 'operation', e.target.value as OperationStep['operation'])
                    }
                  >
                    {operationTypes.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {(op.operation === 'cas' || op.operation === 'enqueue') && (
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 100 }}
                      placeholder="值"
                      value={op.value ?? ''}
                      onChange={(e) => updateOperation(index, 'value', parseInt(e.target.value) || 0)}
                    />
                  )}

                  {op.operation === 'cas' && (
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 100 }}
                      placeholder="期望值"
                      value={op.expectedValue ?? ''}
                      onChange={(e) => updateOperation(index, 'expectedValue', parseInt(e.target.value) || 0)}
                    />
                  )}

                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 80 }}
                    placeholder="延迟"
                    value={op.delay}
                    onChange={(e) => updateOperation(index, 'delay', parseInt(e.target.value) || 0)}
                  />

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px' }}
                    onClick={() => removeOperation(index)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {config.operationSequence.length === 0 && (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <p>使用默认操作序列，或点击"添加操作"自定义</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {selectedPrimitive === 'aba' && (
        <section className="aba-demo-section">
          <h3>ABA 问题演示</h3>
          <p style={{ marginBottom: 16, color: '#666' }}>
            ABA 问题是指：一个值从 A 变成 B，又变回 A，此时 CAS 操作会误以为值没有变化而成功。
            点击下方按钮运行预设的 ABA 问题演示。
          </p>

          <div className="aba-demo-buttons">
            <button
              className="btn btn-warning"
              onClick={() => onRunABADemo('cas')}
              disabled={isLoading}
            >
              CAS 场景 ABA 演示
            </button>
            <button
              className="btn btn-warning"
              onClick={() => onRunABADemo('queue')}
              disabled={isLoading}
            >
              无锁队列 ABA 演示
            </button>
            <button
              className="btn btn-success"
              onClick={() => onRunABADemo('version-tagged')}
              disabled={isLoading}
            >
              版本戳解决方案
            </button>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowABASteps(!showABASteps)}
              style={{ marginBottom: 16 }}
            >
              {showABASteps ? '隐藏' : '显示'}自定义 ABA 步骤
            </button>

            {showABASteps && (
              <div className="custom-aba-steps">
                <div className="button-group" style={{ marginBottom: 16 }}>
                  <button className="btn btn-secondary" onClick={addABAStep}>
                    + 添加步骤
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setConfig({ abaSteps: [] })}
                  >
                    清空
                  </button>
                </div>

                {(config.abaSteps || []).map((step, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      marginBottom: 12,
                      padding: 12,
                      backgroundColor: 'rgba(245, 87, 108, 0.1)',
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: 30, color: '#f5576c' }}>
                      #{index + 1}
                    </span>

                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={step.threadId}
                      onChange={(e) => updateABAStep(index, 'threadId', e.target.value)}
                    >
                      {threadOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={step.action}
                      onChange={(e) =>
                        updateABAStep(index, 'action', e.target.value as ABAStep['action'])
                      }
                    >
                      <option value="read">读取 (Read)</option>
                      <option value="modify">修改 (Modify)</option>
                      <option value="restore">恢复 (Restore)</option>
                    </select>

                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 2 }}
                      placeholder="步骤描述"
                      value={step.description}
                      onChange={(e) => updateABAStep(index, 'description', e.target.value)}
                    />

                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 80 }}
                      placeholder="延迟"
                      value={step.delay}
                      onChange={(e) => updateABAStep(index, 'delay', parseInt(e.target.value) || 0)}
                    />

                    <button
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px' }}
                      onClick={() => removeABAStep(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="form-group" style={{ marginTop: 32 }}>
        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={isLoading || selectedPrimitive === 'aba'}
          >
            {isLoading ? '运行中...' : '运行模拟'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              useAppStore.getState().resetConfig();
            }}
          >
            重置配置
          </button>
        </div>
      </section>

      {examples.length > 0 && (
        <section className="examples-section">
          <h2 className="section-title">内置示例</h2>
          <div className="examples-grid">
            {examples.map((example) => (
              <div
                key={example.id}
                className="example-card"
                onClick={() => handleExampleSelect(example)}
              >
                <div className="example-name">{example.name}</div>
                <div className="example-description">{example.description}</div>
                <div className="example-outcome">预期结果: {example.expectedOutcome}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
