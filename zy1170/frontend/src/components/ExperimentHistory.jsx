import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const ExperimentHistory = ({ onLoadExperiment }) => {
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiments, setSelectedExperiments] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  useEffect(() => {
    loadExperiments();
  }, []);

  const loadExperiments = async () => {
    try {
      const result = await api.listExperiments();
      setExperiments(result.experiments);
    } catch (error) {
      console.error('Failed to load experiments:', error);
    }
  };

  const toggleExperimentSelection = (expId) => {
    if (selectedExperiments.includes(expId)) {
      setSelectedExperiments(selectedExperiments.filter(id => id !== expId));
    } else {
      setSelectedExperiments([...selectedExperiments, expId]);
    }
  };

  const compareExperiments = async () => {
    if (selectedExperiments.length < 2) {
      alert('请至少选择2个实验进行对比');
      return;
    }

    setLoading(true);
    try {
      const result = await api.compareExperiments(selectedExperiments);
      setComparisonData(result);
      setActiveTab('compare');
    } catch (error) {
      console.error('Failed to compare experiments:', error);
      alert('对比失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteExperiment = async (expId) => {
    if (!confirm('确定要删除这个实验吗？')) return;
    
    try {
      await api.deleteExperiment(expId);
      loadExperiments();
      setSelectedExperiments(selectedExperiments.filter(id => id !== expId));
    } catch (error) {
      console.error('Failed to delete experiment:', error);
    }
  };

  const formatComparisonChartData = () => {
    if (!comparisonData || !comparisonData.loss_curves) return [];

    const allData = {};
    
    comparisonData.loss_curves.forEach(curve => {
      curve.epochs.forEach((epoch, i) => {
        const key = epoch + 1;
        if (!allData[key]) {
          allData[key] = { epoch: key };
        }
        allData[key][curve.experiment_id] = curve.loss[i];
      });
    });

    return Object.values(allData).sort((a, b) => a.epoch - b.epoch);
  };

  const chartData = formatComparisonChartData();
  const colors = ['#667eea', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];

  return (
    <div className="card">
      <h2 className="card-title">📚 实验历史与对比</h2>

      <div className="tabs">
        <div
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          实验列表
        </div>
        <div
          className={`tab ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          实验对比
        </div>
      </div>

      {activeTab === 'list' && (
        <div>
          <div style={{ marginBottom: '15px' }} className="btn-group">
            <button
              className="btn btn-secondary"
              onClick={loadExperiments}
            >
              🔄 刷新列表
            </button>
            {selectedExperiments.length >= 2 && (
              <button
                className="btn btn-primary"
                onClick={compareExperiments}
                disabled={loading}
              >
                {loading ? '对比中...' : `📊 对比选中的 ${selectedExperiments.length} 个实验`}
              </button>
            )}
          </div>

          {experiments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              暂无保存的实验，开始训练后会自动保存
            </div>
          ) : (
            <div className="scrollable">
              {experiments.map((exp) => (
                <div
                  key={exp.id}
                  className={`experiment-item ${selectedExperiments.includes(exp.id) ? 'selected' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <input
                          type="checkbox"
                          checked={selectedExperiments.includes(exp.id)}
                          onChange={() => toggleExperimentSelection(exp.id)}
                          style={{ marginRight: '10px' }}
                        />
                        <span className="experiment-id">{exp.id}</span>
                        <span className={`badge badge-${exp.status === 'completed' ? 'success' : 'info'}`}>
                          {exp.status}
                        </span>
                      </div>
                      <div className="experiment-info">
                        <strong>创建时间:</strong> {new Date(exp.created_at).toLocaleString('zh-CN')}
                      </div>
                      <div className="experiment-info">
                        <strong>配置:</strong> 
                        隐藏层: {JSON.stringify(exp.config?.hidden_layers || [])} | 
                        学习率: {exp.config?.learning_rate} | 
                        Epochs: {exp.config?.epochs}
                      </div>
                      {exp.data?.training_result?.final_loss !== undefined && (
                        <div className="experiment-info">
                          <strong>最终 Loss:</strong> {exp.data.training_result.final_loss.toFixed(6)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => onLoadExperiment(exp)}
                      >
                        加载
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => deleteExperiment(exp.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'compare' && (
        <div>
          {!comparisonData ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              请从"实验列表"中选择至少2个实验，然后点击"对比"
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#2c3e50' }}>
                📊 Loss 曲线对比
              </h3>
              
              <div style={{ height: '350px', marginBottom: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis 
                      dataKey="epoch" 
                      label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      label={{ value: 'Loss', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      formatter={(value, name) => [value?.toFixed(6), name]}
                      labelFormatter={(label) => `Epoch ${label}`}
                    />
                    <Legend />
                    {comparisonData.loss_curves.map((curve, i) => (
                      <Line
                        key={curve.experiment_id}
                        type="monotone"
                        dataKey={curve.experiment_id}
                        stroke={colors[i % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        name={curve.experiment_id}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#2c3e50' }}>
                📋 指标对比
              </h3>
              
              <table className="data-table">
                <thead>
                  <tr>
                    <th>实验ID</th>
                    <th>最终 Loss</th>
                    <th>学习率</th>
                    <th>隐藏层</th>
                    <th>激活函数</th>
                    <th>Epochs</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.experiments.map((exp, i) => (
                    <tr key={exp.id}>
                      <td style={{ color: colors[i % colors.length], fontWeight: '600' }}>
                        {exp.id}
                      </td>
                      <td>
                        {exp.data?.training_result?.final_loss?.toFixed(6) || 'N/A'}
                      </td>
                      <td>{exp.config?.learning_rate}</td>
                      <td>{JSON.stringify(exp.config?.hidden_layers || [])}</td>
                      <td>{exp.config?.activation}</td>
                      <td>{exp.config?.epochs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '4px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>💡 对比分析提示</h4>
                <ul style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li><strong>曲线下降速度:</strong> 反映学习率和初始化方式的影响</li>
                  <li><strong>最终 Loss 值:</strong> 反映网络容量和训练充分程度</li>
                  <li><strong>曲线震荡:</strong> 可能表示学习率过大或数据有噪声</li>
                  <li><strong>不同隐藏层:</strong> 观察网络深度对学习能力的影响</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExperimentHistory;
