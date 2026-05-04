import React, { useState, useEffect } from 'react';
import ConfigPanel from './components/ConfigPanel';
import TrainingVisualization from './components/TrainingVisualization';
import ExperimentHistory from './components/ExperimentHistory';
import ReportExport from './components/ReportExport';
import api from './services/api';

function App() {
  const [config, setConfig] = useState({
    X: [[0, 0], [0, 1], [1, 0], [1, 1]],
    y: [[0], [1], [1], [0]],
    X_raw: '0, 0\n0, 1\n1, 0\n1, 1',
    y_raw: '0\n1\n1\n0',
    input_size: 2,
    hidden_layers: [4],
    output_size: 1,
    activation: 'relu',
    output_activation: 'sigmoid',
    loss_function: 'binary_cross_entropy',
    learning_rate: 0.1,
    epochs: 500,
    initialization: 'xavier',
    seed: 42
  });

  const [trainingResult, setTrainingResult] = useState(null);
  const [stepResult, setStepResult] = useState(null);
  const [currentWeights, setCurrentWeights] = useState(null);
  const [currentBiases, setCurrentBiases] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [currentExperiment, setCurrentExperiment] = useState(null);
  const [activeMainTab, setActiveMainTab] = useState('train');
  const [messages, setMessages] = useState([]);

  const addMessage = (type, text) => {
    const id = Date.now();
    setMessages(prev => [...prev, { id, type, text }]);
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id));
    }, 5000);
  };

  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
  };

  const handleLoadDataset = (dataset) => {
    const X = dataset.X;
    const y = dataset.y;
    
    const input_size = X[0].length;
    const output_size = y[0].length;
    
    setConfig(prev => ({
      ...prev,
      X,
      y,
      X_raw: formatMatrixForDisplay(X),
      y_raw: formatMatrixForDisplay(y),
      input_size,
      output_size
    }));
    
    addMessage('success', `已加载数据集: ${dataset.name}`);
  };

  const handleLoadBadSample = (sample) => {
    const newConfig = {
      ...config,
      ...sample.config
    };
    
    setConfig(newConfig);
    addMessage('warning', `已加载坏样例: ${sample.name} - ${sample.expected_issue}`);
  };

  const formatMatrixForDisplay = (matrix) => {
    if (!matrix || matrix.length === 0) return '';
    return matrix.map(row => row.join(', ')).join('\n');
  };

  const handleLoadExperiment = (experiment) => {
    setCurrentExperiment(experiment);
    
    if (experiment.config) {
      setConfig({
        ...experiment.config,
        X_raw: experiment.config.X ? formatMatrixForDisplay(experiment.config.X) : '',
        y_raw: experiment.config.y ? formatMatrixForDisplay(experiment.config.y) : ''
      });
    }
    
    if (experiment.data?.training_result) {
      setTrainingResult(experiment.data.training_result);
    }
    
    if (experiment.data?.final_weights) {
      setCurrentWeights(experiment.data.final_weights);
    }
    
    if (experiment.data?.final_biases) {
      setCurrentBiases(experiment.data.final_biases);
    }
    
    addMessage('success', `已加载实验: ${experiment.id}`);
    setActiveMainTab('train');
  };

  const runFullTraining = async () => {
    setIsTraining(true);
    setStepResult(null);
    
    try {
      addMessage('info', '开始训练...');
      
      let experiment = currentExperiment;
      
      if (!experiment) {
        const createResult = await api.createExperiment(config);
        experiment = createResult.experiment;
        setCurrentExperiment(experiment);
        
        if (createResult.warnings && createResult.warnings.length > 0) {
          createResult.warnings.forEach(w => {
            addMessage('warning', `参数警告: ${w.field} - ${w.message}`);
          });
        }
      }
      
      const trainingConfig = {
        ...config,
        experiment_id: experiment.id
      };
      
      const result = await api.trainStepByStep(trainingConfig);
      setTrainingResult({
        ...result.result,
        config: config
      });
      setCurrentWeights(result.final_weights);
      setCurrentBiases(result.final_biases);
      
      addMessage('success', `训练完成! 最终 Loss: ${result.result.final_loss?.toFixed(6)}`);
      
    } catch (error) {
      console.error('Training error:', error);
      addMessage('error', `训练失败: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsTraining(false);
    }
  };

  const runSingleStep = async () => {
    try {
      const stepConfig = {
        ...config,
        weights: currentWeights,
        biases: currentBiases
      };
      
      const result = await api.trainSingleStep(stepConfig);
      setStepResult(result.step_result);
      setCurrentWeights(result.updated_weights);
      setCurrentBiases(result.updated_biases);
      
      addMessage('info', `单步训练完成. Loss: ${result.step_result.loss?.toFixed(6)}`);
      
    } catch (error) {
      console.error('Step training error:', error);
      addMessage('error', `单步训练失败: ${error.response?.data?.error || error.message}`);
    }
  };

  const resetTraining = () => {
    setTrainingResult(null);
    setStepResult(null);
    setCurrentWeights(null);
    setCurrentBiases(null);
    setCurrentExperiment(null);
    addMessage('info', '已重置训练状态');
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🧠 深度学习基础实验台</h1>
        <p>拆解神经网络训练过程 - 前向传播、反向传播、梯度下降可视化教学工具</p>
      </div>

      {messages.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {messages.map(msg => (
            <div key={msg.id} className={`alert alert-${msg.type}`}>
              {msg.text}
            </div>
          ))}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', padding: '0 10px' }}>
        <div
          className={`tab ${activeMainTab === 'train' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('train')}
        >
          🎯 训练面板
        </div>
        <div
          className={`tab ${activeMainTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('history')}
        >
          📚 实验历史
        </div>
        <div
          className={`tab ${activeMainTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('report')}
        >
          📄 报告导出
        </div>
      </div>

      {activeMainTab === 'train' && (
        <>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h2 className="card-title">🎮 训练控制</h2>
            <div className="btn-group">
              <button
                className="btn btn-primary"
                onClick={runFullTraining}
                disabled={isTraining}
                style={{ fontSize: '15px', padding: '12px 24px' }}
              >
                {isTraining ? '⏳ 训练中...' : '🚀 开始完整训练'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={runSingleStep}
                disabled={isTraining}
                style={{ fontSize: '15px', padding: '12px 24px' }}
              >
                👆 单步训练 (看细节)
              </button>
              <button
                className="btn btn-danger"
                onClick={resetTraining}
                style={{ fontSize: '15px', padding: '12px 24px' }}
              >
                🔄 重置
              </button>
            </div>
            
            <div style={{ marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
                <strong>💡 提示:</strong> 
                "完整训练"会执行所有 epochs；
                "单步训练"每次只执行一次前向传播 + 反向传播 + 权重更新，
                可以在"分步详解"标签中查看详细计算过程。
              </p>
            </div>
          </div>

          <div className="grid">
            <div>
              <ConfigPanel
                config={config}
                onConfigChange={handleConfigChange}
                onLoadDataset={handleLoadDataset}
                onLoadBadSample={handleLoadBadSample}
              />
            </div>
            <div>
              <TrainingVisualization
                trainingResult={trainingResult}
                isTraining={isTraining}
                stepResult={stepResult}
              />
            </div>
          </div>
        </>
      )}

      {activeMainTab === 'history' && (
        <ExperimentHistory
          onLoadExperiment={handleLoadExperiment}
        />
      )}

      {activeMainTab === 'report' && (
        <ReportExport
          currentExperiment={currentExperiment}
          trainingResult={trainingResult}
        />
      )}

      <div style={{ marginTop: '30px', padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#2c3e50' }}>
          📖 使用指南
        </h3>
        <div className="two-column">
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#667eea' }}>
              1️⃣ 快速开始
            </h4>
            <ol style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>从"预置数据集"中选择一个（如 XOR 问题）</li>
              <li>点击"开始完整训练"查看训练过程</li>
              <li>在右侧"Loss 曲线"中观察训练收敛情况</li>
            </ol>
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#e74c3c' }}>
              2️⃣ 深度学习原理
            </h4>
            <ol style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>点击"单步训练"执行一步训练</li>
              <li>在"分步详解"标签中查看前向/反向传播计算</li>
              <li>尝试"教学坏样例"观察常见问题（梯度消失、学习率过大等）</li>
            </ol>
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#27ae60' }}>
              3️⃣ 实验对比
            </h4>
            <ol style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>用不同参数训练多次（自动保存）</li>
              <li>在"实验历史"中选择多个实验</li>
              <li>点击"对比"查看不同参数的效果差异</li>
            </ol>
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#f39c12' }}>
              4️⃣ 报告导出
            </h4>
            <ol style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>训练完成后，在"报告导出"中生成报告</li>
              <li>Markdown 格式适合阅读和分享</li>
              <li>JSON 格式包含完整数据用于进一步分析</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
