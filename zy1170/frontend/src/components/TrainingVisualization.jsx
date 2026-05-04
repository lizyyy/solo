import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TrainingVisualization = ({ trainingResult, isTraining, stepResult }) => {
  const [activeTab, setActiveTab] = useState('loss');
  const [selectedLayer, setSelectedLayer] = useState(0);

  const formatChartData = (history) => {
    if (!history || !history.epoch || !history.loss) return [];
    return history.epoch.map((epoch, i) => ({
      epoch: epoch + 1,
      loss: history.loss[i]
    }));
  };

  const lossData = trainingResult ? formatChartData(trainingResult.training_history) : [];

  const renderMatrix = (matrix, title) => {
    if (!matrix || matrix.length === 0) return null;
    
    return (
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#555' }}>
          {title}
        </h4>
        <div className="matrix-display">
          {matrix.map((row, i) => (
            <div key={i} className="matrix-row">
              {row.map((cell, j) => (
                <div
                  key={j}
                  className={`matrix-cell ${cell > 0 ? 'positive' : cell < 0 ? 'negative' : ''}`}
                >
                  {typeof cell === 'number' ? cell.toFixed(4) : cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStepByStep = () => {
    if (!stepResult) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          点击"单步训练"查看详细的前向传播、反向传播和梯度下降过程
        </div>
      );
    }

    const { layer_outputs, gradients, updates } = stepResult;

    return (
      <div className="scrollable">
        <div className="step-by-step-panel">
          <h3 className="step-title">📊 当前步骤 Loss: {stepResult.loss?.toFixed(6)}</h3>
        </div>

        <div className="tabs">
          <div
            className={`tab ${activeTab === 'forward' ? 'active' : ''}`}
            onClick={() => setActiveTab('forward')}
          >
            前向传播
          </div>
          <div
            className={`tab ${activeTab === 'backward' ? 'active' : ''}`}
            onClick={() => setActiveTab('backward')}
          >
            反向传播
          </div>
          <div
            className={`tab ${activeTab === 'update' ? 'active' : ''}`}
            onClick={() => setActiveTab('update')}
          >
            权重更新
          </div>
        </div>

        {activeTab === 'forward' && layer_outputs && (
          <div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
              <strong>前向传播公式:</strong> z = W·X + b, a = σ(z)
            </p>
            
            {layer_outputs.map((layer, index) => (
              <div key={index} style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '4px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
                  层 {index + 1} ({layer.type === 'output' ? '输出层' : '隐藏层'}) - 激活函数: {layer.activation}
                </h4>
                
                <div className="code-block">
{`// 加权和计算 (z = W·X + b)
z = dot(input, weights) + biases

// 激活函数应用
a = ${layer.activation}(z)

// 当前层输出形状: [${layer.output.length}, ${layer.output[0]?.length || 1}]`}
                </div>
                
                <div style={{ marginTop: '10px' }}>
                  {renderMatrix(layer.output.slice(0, 5), `输出 (前5个样本)`)}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'backward' && gradients && (
          <div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
              <strong>反向传播公式 (链式法则):</strong><br/>
              δ^L = ∂L/∂a^L ⊙ σ'(z^L) &nbsp;&nbsp; (输出层误差)<br/>
              δ^l = (W^(l+1))ᵀ·δ^(l+1) ⊙ σ'(z^l) &nbsp;&nbsp; (隐藏层误差)<br/>
              ∂L/∂W^l = (a^(l-1))ᵀ·δ^l / m &nbsp;&nbsp; (权重梯度)
            </p>
            
            {gradients.map((grad, index) => (
              <div key={index} style={{ marginBottom: '20px', padding: '15px', background: '#fffaf0', borderRadius: '4px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#c05621' }}>
                  层 {index + 1} - 权重梯度 ∂L/∂W
                </h4>
                
                <div className="code-block">
{`// 梯度计算
dW = dot(prev_activation.T, delta) / m

// 梯度矩阵形状: [${grad.length}, ${grad[0]?.length || 1}]
// 这表示每个权重对Loss的贡献程度`}
                </div>
                
                <div style={{ marginTop: '10px' }}>
                  {renderMatrix(grad, `梯度矩阵`)}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'update' && updates && (
          <div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
              <strong>梯度下降公式:</strong><br/>
              W^l = W^l - α·∂L/∂W^l &nbsp;&nbsp; (α = 学习率)<br/>
              b^l = b^l - α·∂L/∂b^l
            </p>
            
            {updates.updates?.map((update, index) => (
              <div key={index} style={{ marginBottom: '20px', padding: '15px', background: '#f0fff4', borderRadius: '4px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#276749' }}>
                  层 {index + 1} - 权重更新
                </h4>
                
                <div className="code-block">
{`// 梯度下降更新
new_W = old_W - learning_rate * gradient

// 学习率: ${updates.learning_rate}
// 这表示向梯度的反方向移动一小步以减小Loss`}
                </div>
                
                <div style={{ marginTop: '10px' }}>
                  {renderMatrix(update.old_weights, `更新前的权重 W_old`)}
                  {renderMatrix(update.gradient, `梯度 dW`)}
                  {renderMatrix(update.weights_change, `权重变化 ΔW = -α·dW`)}
                  {renderMatrix(update.new_weights, `更新后的权重 W_new`)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderPredictions = () => {
    if (!trainingResult || !trainingResult.final_output) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          训练完成后查看预测结果
        </div>
      );
    }

    return (
      <div className="scrollable">
        <table className="data-table">
          <thead>
            <tr>
              <th>样本</th>
              <th>真实值</th>
              <th>预测值</th>
              <th>误差</th>
            </tr>
          </thead>
          <tbody>
            {trainingResult.final_output.slice(0, 20).map((pred, i) => {
              const trueVal = trainingResult.config?.y?.[i];
              const error = trueVal ? Math.abs(pred[0] - trueVal[0]) : null;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{trueVal ? trueVal.map(v => v.toFixed(4)).join(', ') : 'N/A'}</td>
                  <td>{pred.map(v => v.toFixed(4)).join(', ')}</td>
                  <td style={{ 
                    color: error > 0.5 ? '#e74c3c' : error > 0.2 ? '#f39c12' : '#27ae60' 
                  }}>
                    {error !== null ? error.toFixed(4) : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {trainingResult.final_output.length > 20 && (
          <p style={{ textAlign: 'center', color: '#999', marginTop: '10px', fontSize: '13px' }}>
            显示前20个样本，共 {trainingResult.final_output.length} 个
          </p>
        )}
      </div>
    );
  };

  const renderWeights = () => {
    const weights = trainingResult?.final_weights || stepResult?.updated_weights;
    
    if (!weights || weights.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          训练完成后查看权重矩阵
        </div>
      );
    }

    return (
      <div>
        <div style={{ marginBottom: '15px' }}>
          {weights.map((_, i) => (
            <button
              key={i}
              className={`btn ${selectedLayer === i ? 'btn-primary' : 'btn-secondary'}`}
              style={{ marginRight: '8px', marginBottom: '8px' }}
              onClick={() => setSelectedLayer(i)}
            >
              层 {i + 1} 权重
            </button>
          ))}
        </div>
        
        <div className="scrollable">
          {renderMatrix(weights[selectedLayer], `层 ${selectedLayer + 1} 权重矩阵 (${weights[selectedLayer].length} x ${weights[selectedLayer][0]?.length || 1})`)}
          
          <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '4px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>📚 权重解读</h4>
            <ul style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>正权重 (绿色):</strong> 表示该输入神经元激活时，会增加当前神经元的激活值</li>
              <li><strong>负权重 (红色):</strong> 表示该输入神经元激活时，会减少当前神经元的激活值</li>
              <li><strong>接近零的权重:</strong> 表示该输入对当前神经元影响很小</li>
              <li><strong>较大的权重绝对值:</strong> 表示该输入对当前神经元影响较大</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <h2 className="card-title">📈 训练可视化</h2>
      
      {isTraining && (
        <div style={{ marginBottom: '15px' }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '50%' }}></div>
          </div>
          <div className="loading">
            <div className="spinner"></div>
            <span style={{ marginLeft: '10px', color: '#666' }}>训练中...</span>
          </div>
        </div>
      )}

      <div className="tabs">
        <div
          className={`tab ${activeTab === 'loss' ? 'active' : ''}`}
          onClick={() => setActiveTab('loss')}
        >
          Loss 曲线
        </div>
        <div
          className={`tab ${activeTab === 'step' ? 'active' : ''}`}
          onClick={() => setActiveTab('step')}
        >
          分步详解
        </div>
        <div
          className={`tab ${activeTab === 'predictions' ? 'active' : ''}`}
          onClick={() => setActiveTab('predictions')}
        >
          预测结果
        </div>
        <div
          className={`tab ${activeTab === 'weights' ? 'active' : ''}`}
          onClick={() => setActiveTab('weights')}
        >
          权重矩阵
        </div>
      </div>

      {activeTab === 'loss' && (
        <div>
          {lossData.length > 0 ? (
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lossData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="epoch" 
                    label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Loss', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value) => [value.toFixed(6), 'Loss']}
                    labelFormatter={(label) => `Epoch ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="loss" 
                    stroke="#667eea" 
                    strokeWidth={2}
                    dot={false}
                    name="Training Loss"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px', color: '#999' }}>
              开始训练后将显示 Loss 变化曲线
            </div>
          )}
          
          {trainingResult && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '4px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>📊 训练结果摘要</h4>
              <div className="two-column">
                <div>
                  <p style={{ fontSize: '13px', marginBottom: '5px' }}>
                    <strong>最终 Loss:</strong> <span style={{ color: '#667eea' }}>{trainingResult.final_loss?.toFixed(6)}</span>
                  </p>
                  <p style={{ fontSize: '13px', marginBottom: '5px' }}>
                    <strong>训练轮次:</strong> {trainingResult.training_history?.epoch?.length || 0}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '13px', marginBottom: '5px' }}>
                    <strong>初始 Loss:</strong> {trainingResult.training_history?.loss?.[0]?.toFixed(6) || 'N/A'}
                  </p>
                  <p style={{ fontSize: '13px', marginBottom: '5px' }}>
                    <strong>Loss 下降:</strong> {trainingResult.training_history?.loss?.length > 1 
                      ? ((trainingResult.training_history.loss[0] - trainingResult.final_loss) / trainingResult.training_history.loss[0] * 100).toFixed(2)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'step' && renderStepByStep()}
      {activeTab === 'predictions' && renderPredictions()}
      {activeTab === 'weights' && renderWeights()}
    </div>
  );
};

export default TrainingVisualization;
