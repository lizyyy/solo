import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ConfigPanel = ({ onConfigChange, config, onLoadDataset, onLoadBadSample }) => {
  const [datasets, setDatasets] = useState([]);
  const [badSamples, setBadSamples] = useState([]);
  const [validation, setValidation] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [selectedBadSample, setSelectedBadSample] = useState('');

  useEffect(() => {
    loadDatasets();
    loadBadSamples();
  }, []);

  useEffect(() => {
    validateConfig();
  }, [config]);

  const loadDatasets = async () => {
    try {
      const result = await api.getDatasets();
      setDatasets(result.datasets);
    } catch (error) {
      console.error('Failed to load datasets:', error);
    }
  };

  const loadBadSamples = async () => {
    try {
      const result = await api.getBadSamples();
      setBadSamples(result.bad_samples);
    } catch (error) {
      console.error('Failed to load bad samples:', error);
    }
  };

  const validateConfig = async () => {
    try {
      const result = await api.validateParameters(config);
      setValidation(result);
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const handleInputChange = (field, value) => {
    onConfigChange({ ...config, [field]: value });
  };

  const handleHiddenLayerChange = (index, value) => {
    const newHiddenLayers = [...config.hidden_layers];
    newHiddenLayers[index] = parseInt(value) || 0;
    onConfigChange({ ...config, hidden_layers: newHiddenLayers });
  };

  const addHiddenLayer = () => {
    const newHiddenLayers = [...config.hidden_layers, 4];
    onConfigChange({ ...config, hidden_layers: newHiddenLayers });
  };

  const removeHiddenLayer = (index) => {
    if (config.hidden_layers.length > 0) {
      const newHiddenLayers = config.hidden_layers.filter((_, i) => i !== index);
      onConfigChange({ ...config, hidden_layers: newHiddenLayers });
    }
  };

  const handleDatasetSelect = async (datasetId) => {
    setSelectedDataset(datasetId);
    if (datasetId) {
      try {
        const dataset = await api.getDataset(datasetId);
        onLoadDataset(dataset);
      } catch (error) {
        console.error('Failed to load dataset:', error);
      }
    }
  };

  const handleBadSampleSelect = async (sampleId) => {
    setSelectedBadSample(sampleId);
    if (sampleId) {
      try {
        const sample = await api.getBadSample(sampleId);
        onLoadBadSample(sample);
      } catch (error) {
        console.error('Failed to load bad sample:', error);
      }
    }
  };

  const parseMatrixInput = (input) => {
    try {
      return JSON.parse(input);
    } catch {
      const lines = input.trim().split('\n');
      return lines.map(line => 
        line.split(/[,\s]+/).filter(Boolean).map(parseFloat)
      );
    }
  };

  const handleDataInputChange = (field, value) => {
    try {
      const parsed = parseMatrixInput(value);
      onConfigChange({ ...config, [field]: parsed, [field + '_raw']: value });
    } catch {
      onConfigChange({ ...config, [field + '_raw']: value });
    }
  };

  const formatMatrixForDisplay = (matrix) => {
    if (!matrix || matrix.length === 0) return '';
    return matrix.map(row => row.join(', ')).join('\n');
  };

  const activations = [
    { value: 'sigmoid', label: 'Sigmoid (0-1)' },
    { value: 'relu', label: 'ReLU (max(0,x))' },
    { value: 'tanh', label: 'Tanh (-1-1)' },
    { value: 'leaky_relu', label: 'Leaky ReLU' },
    { value: 'linear', label: 'Linear (无激活)' }
  ];

  const outputActivations = [
    { value: 'sigmoid', label: 'Sigmoid (二分类)' },
    { value: 'softmax', label: 'Softmax (多分类)' },
    { value: 'linear', label: 'Linear (回归)' }
  ];

  const lossFunctions = [
    { value: 'binary_cross_entropy', label: '二元交叉熵 (二分类)' },
    { value: 'categorical_cross_entropy', label: '多分类交叉熵' },
    { value: 'mean_squared_error', label: '均方误差 (回归)' }
  ];

  const initializations = [
    { value: 'xavier', label: 'Xavier (推荐)' },
    { value: 'he', label: 'He (适合ReLU)' },
    { value: 'random', label: '随机正态分布' },
    { value: 'zeros', label: '全零 (教学示例)' },
    { value: 'ones', label: '全一 (教学示例)' }
  ];

  return (
    <div className="card">
      <h2 className="card-title">⚙️ 网络配置</h2>

      {validation && validation.errors.length > 0 && (
        <div className="alert alert-error">
          <strong>❌ 参数错误:</strong>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            {validation.errors.map((error, i) => (
              <li key={i}>{error.field}: {error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {validation && validation.warnings.length > 0 && (
        <div className="alert alert-warning">
          <strong>⚠️ 参数警告:</strong>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            {validation.warnings.map((warning, i) => (
              <li key={i}>{warning.field}: {warning.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">📦 预置数据集</label>
        <select
          className="form-select"
          value={selectedDataset}
          onChange={(e) => handleDatasetSelect(e.target.value)}
        >
          <option value="">-- 选择数据集 --</option>
          {datasets.map(dataset => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">🎯 教学坏样例 (观察问题)</label>
        <select
          className="form-select"
          value={selectedBadSample}
          onChange={(e) => handleBadSampleSelect(e.target.value)}
        >
          <option value="">-- 选择坏样例 --</option>
          {badSamples.map(sample => (
            <option key={sample.id} value={sample.id}>
              {sample.name}
            </option>
          ))}
        </select>
      </div>

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <div className="form-group">
        <label className="form-label">📊 输入样本 X (每行一个样本，逗号分隔)</label>
        <textarea
          className="form-input"
          rows={6}
          placeholder="例如:\n0, 0\n0, 1\n1, 0\n1, 1"
          value={config.X_raw || formatMatrixForDisplay(config.X)}
          onChange={(e) => handleDataInputChange('X', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">🎯 目标输出 y (每行一个标签)</label>
        <textarea
          className="form-input"
          rows={4}
          placeholder="例如:\n0\n1\n1\n0"
          value={config.y_raw || formatMatrixForDisplay(config.y)}
          onChange={(e) => handleDataInputChange('y', e.target.value)}
        />
      </div>

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <div className="two-column">
        <div className="form-group">
          <label className="form-label">🔍 隐藏层激活函数</label>
          <select
            className="form-select"
            value={config.activation}
            onChange={(e) => handleInputChange('activation', e.target.value)}
          >
            {activations.map(act => (
              <option key={act.value} value={act.value}>{act.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">📤 输出层激活函数</label>
          <select
            className="form-select"
            value={config.output_activation}
            onChange={(e) => handleInputChange('output_activation', e.target.value)}
          >
            {outputActivations.map(act => (
              <option key={act.value} value={act.value}>{act.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">📉 损失函数</label>
        <select
          className="form-select"
          value={config.loss_function}
          onChange={(e) => handleInputChange('loss_function', e.target.value)}
        >
          {lossFunctions.map(loss => (
            <option key={loss.value} value={loss.value}>{loss.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">🧠 隐藏层结构</label>
        {config.hidden_layers.map((size, index) => (
          <div key={index} className="hidden-layer-config">
            <span style={{ fontSize: '13px', color: '#666' }}>层 {index + 1}:</span>
            <input
              type="number"
              className="form-input"
              style={{ width: '80px' }}
              value={size}
              onChange={(e) => handleHiddenLayerChange(index, e.target.value)}
              min="1"
            />
            <span style={{ fontSize: '13px', color: '#666' }}>神经元</span>
            {config.hidden_layers.length > 0 && (
              <button
                className="btn btn-danger"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => removeHiddenLayer(index)}
              >
                删除
              </button>
            )}
          </div>
        ))}
        <button className="add-layer-btn" onClick={addHiddenLayer}>
          + 添加隐藏层
        </button>
      </div>

      <div className="two-column">
        <div className="form-group">
          <label className="form-label">📈 学习率 (learning_rate)</label>
          <input
            type="number"
            className="form-input"
            step="0.001"
            value={config.learning_rate}
            onChange={(e) => handleInputChange('learning_rate', parseFloat(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">🔄 训练轮次 (epochs)</label>
          <input
            type="number"
            className="form-input"
            value={config.epochs}
            onChange={(e) => handleInputChange('epochs', parseInt(e.target.value))}
            min="1"
          />
        </div>
      </div>

      <div className="two-column">
        <div className="form-group">
          <label className="form-label">🎲 权重初始化方式</label>
          <select
            className="form-select"
            value={config.initialization}
            onChange={(e) => handleInputChange('initialization', e.target.value)}
          >
            {initializations.map(init => (
              <option key={init.value} value={init.value}>{init.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">🌱 随机种子 (seed)</label>
          <input
            type="number"
            className="form-input"
            placeholder="留空则随机"
            value={config.seed || ''}
            onChange={(e) => handleInputChange('seed', e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">📐 网络结构预览</label>
        <div className="layer-visualization">
          <div className="neuron-layer">
            {Array(Math.min(config.X?.[0]?.length || 2, 8)).fill(0).map((_, i) => (
              <div key={i} className="neuron input">
                x{i + 1}
              </div>
            ))}
            <span style={{ fontSize: '11px', color: '#666', textAlign: 'center', marginTop: '5px' }}>
              输入层
            </span>
          </div>
          
          {config.hidden_layers.map((size, layerIndex) => (
            <React.Fragment key={layerIndex}>
              <div style={{ color: '#999', fontSize: '20px' }}>→</div>
              <div className="neuron-layer">
                {Array(Math.min(size, 8)).fill(0).map((_, i) => (
                  <div key={i} className="neuron hidden">
                    h{i + 1}
                  </div>
                ))}
                <span style={{ fontSize: '11px', color: '#666', textAlign: 'center', marginTop: '5px' }}>
                  隐藏层 {layerIndex + 1}
                </span>
              </div>
            </React.Fragment>
          ))}
          
          <div style={{ color: '#999', fontSize: '20px' }}>→</div>
          <div className="neuron-layer">
            {Array(Math.min(config.y?.[0]?.length || 1, 4)).fill(0).map((_, i) => (
              <div key={i} className="neuron output">
                o{i + 1}
              </div>
            ))}
            <span style={{ fontSize: '11px', color: '#666', textAlign: 'center', marginTop: '5px' }}>
              输出层
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
