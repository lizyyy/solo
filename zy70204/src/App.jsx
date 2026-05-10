import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FIRING_TEMPERATURE_RANGES, FIRING_ATMOSPHERE } from './data/models';
import { DEMO_MATERIALS, createDemoRecipe, DEMO_ERROR_RECIPES, createTestPiece } from './data/demoData';
import {
  validateRecipe,
  calculateCost,
  calculateColorDifference,
} from './utils/calculator';

function App() {
  const [materials, setMaterials] = useState(DEMO_MATERIALS);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [testPieces, setTestPieces] = useState([]);
  const [history, setHistory] = useState([]);
  const [batchSize, setBatchSize] = useState(100);
  const [activeTab, setActiveTab] = useState('recipe');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');

  const [testPieceForm, setTestPieceForm] = useState({
    actualTemperature: '',
    actualAtmosphere: FIRING_ATMOSPHERE.OXIDATION,
    observedColor: '#000000',
    notes: '',
  });

  useEffect(() => {
    const demoRecipe = createDemoRecipe();
    setCurrentRecipe(demoRecipe);
    addHistoryRecord('recipe', demoRecipe.id, 'create', null, demoRecipe, '创建青瓷基础配方');
  }, []);

  const addHistoryRecord = (entityType, entityId, action, beforeState, afterState, description) => {
    const record = {
      id: uuidv4(),
      entityType,
      entityId,
      action,
      beforeState: beforeState ? JSON.parse(JSON.stringify(beforeState)) : null,
      afterState: afterState ? JSON.parse(JSON.stringify(afterState)) : null,
      description,
      timestamp: new Date().toISOString(),
    };
    setHistory(prev => [record, ...prev]);
  };

  const validation = useMemo(() => {
    if (!currentRecipe) return { isValid: true, errors: [], warnings: [] };
    return validateRecipe(currentRecipe, materials, batchSize);
  }, [currentRecipe, materials, batchSize]);

  const costCalculation = useMemo(() => {
    if (!currentRecipe || !currentRecipe.ingredients.length) return null;
    return calculateCost(currentRecipe.ingredients, materials, batchSize);
  }, [currentRecipe, materials, batchSize]);

  const totalRatio = useMemo(() => {
    if (!currentRecipe) return 0;
    return currentRecipe.ingredients.reduce((sum, ing) => sum + (ing.ratio || 0), 0);
  }, [currentRecipe]);

  const updateRecipeName = (name) => {
    const before = { ...currentRecipe };
    setCurrentRecipe(prev => ({ ...prev, name }));
    addHistoryRecord('recipe', currentRecipe.id, 'update', before, { ...currentRecipe, name }, `配方名称修改为: ${name}`);
  };

  const updateRecipeField = (field, value) => {
    const before = { ...currentRecipe };
    const updated = { ...currentRecipe, [field]: value, updatedAt: new Date().toISOString() };
    setCurrentRecipe(updated);
    addHistoryRecord('recipe', currentRecipe.id, 'update', before, updated, `修改配方 ${field}`);
  };

  const addIngredient = () => {
    if (!selectedMaterialId) return;
    
    const material = materials.find(m => m.id === selectedMaterialId);
    if (!material) return;

    const exists = currentRecipe.ingredients.some(i => i.materialId === selectedMaterialId);
    if (exists) {
      alert('该成分已在配方中');
      return;
    }

    const newIngredient = {
      materialId: material.id,
      materialName: material.name,
      ratio: 0,
    };

    const before = { ...currentRecipe };
    const updated = {
      ...currentRecipe,
      ingredients: [...currentRecipe.ingredients, newIngredient],
      updatedAt: new Date().toISOString(),
    };
    setCurrentRecipe(updated);
    addHistoryRecord('recipe', currentRecipe.id, 'update', before, updated, `添加成分: ${material.name}`);
    setSelectedMaterialId('');
  };

  const updateIngredientRatio = (materialId, newRatio) => {
    const ratio = parseFloat(newRatio) || 0;
    const before = { ...currentRecipe };
    const updated = {
      ...currentRecipe,
      ingredients: currentRecipe.ingredients.map(ing =>
        ing.materialId === materialId ? { ...ing, ratio } : ing
      ),
      updatedAt: new Date().toISOString(),
    };
    setCurrentRecipe(updated);
    const ingredient = currentRecipe.ingredients.find(i => i.materialId === materialId);
    addHistoryRecord(
      'recipe',
      currentRecipe.id,
      'update',
      before,
      updated,
      `调整 ${ingredient?.materialName} 比例: ${ingredient?.ratio} → ${ratio}`
    );
  };

  const removeIngredient = (materialId) => {
    const ingredient = currentRecipe.ingredients.find(i => i.materialId === materialId);
    const before = { ...currentRecipe };
    const updated = {
      ...currentRecipe,
      ingredients: currentRecipe.ingredients.filter(i => i.materialId !== materialId),
      updatedAt: new Date().toISOString(),
    };
    setCurrentRecipe(updated);
    addHistoryRecord('recipe', currentRecipe.id, 'update', before, updated, `移除成分: ${ingredient?.materialName}`);
  };

  const loadDemoRecipe = (recipeKey) => {
    const demoRecipe = recipeKey === 'normal' 
      ? createDemoRecipe() 
      : DEMO_ERROR_RECIPES[recipeKey];
    
    const recipeWithId = {
      ...demoRecipe,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setCurrentRecipe(recipeWithId);
    addHistoryRecord('recipe', recipeWithId.id, 'create', null, recipeWithId, `加载演示配方: ${recipeWithId.name}`);
    setActiveTab('recipe');
  };

  const resetRecipe = () => {
    const newRecipe = {
      id: uuidv4(),
      name: '新配方',
      ingredients: [],
      targetTemperature: 1200,
      firingAtmosphere: FIRING_ATMOSPHERE.OXIDATION,
      targetColor: '#FFFFFF',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrentRecipe(newRecipe);
    addHistoryRecord('recipe', newRecipe.id, 'create', null, newRecipe, '创建空白配方');
  };

  const createTestPiece = () => {
    if (!currentRecipe) return;

    const piece = {
      id: uuidv4(),
      recipeId: currentRecipe.id,
      recipeSnapshot: JSON.parse(JSON.stringify(currentRecipe)),
      actualTemperature: parseInt(testPieceForm.actualTemperature) || currentRecipe.targetTemperature,
      actualAtmosphere: testPieceForm.actualAtmosphere,
      observedColor: testPieceForm.observedColor,
      notes: testPieceForm.notes,
      createdAt: new Date().toISOString(),
    };

    const colorDiff = calculateColorDifference(currentRecipe.targetColor, testPieceForm.observedColor);
    const costResult = calculateCost(currentRecipe.ingredients, materials, batchSize);

    const pieceWithResults = {
      ...piece,
      colorDifference: colorDiff,
      costResult,
    };

    setTestPieces(prev => [pieceWithResults, ...prev]);
    addHistoryRecord('testPiece', piece.id, 'create', null, pieceWithResults, `记录试片烧成结果，色差: ${colorDiff.level}`);

    setTestPieceForm({
      actualTemperature: currentRecipe.targetTemperature,
      actualAtmosphere: FIRING_ATMOSPHERE.OXIDATION,
      observedColor: '#000000',
      notes: '',
    });
  };

  const deleteTestPiece = (pieceId) => {
    const piece = testPieces.find(p => p.id === pieceId);
    setTestPieces(prev => prev.filter(p => p.id !== pieceId));
    addHistoryRecord('testPiece', pieceId, 'delete', piece, null, '删除试片记录');
  };

  const availableMaterials = useMemo(() => {
    if (!currentRecipe) return materials;
    const usedIds = currentRecipe.ingredients.map(i => i.materialId);
    return materials.filter(m => !usedIds.includes(m.id));
  }, [materials, currentRecipe]);

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('zh-CN');
  };

  const getDiffLevelClass = (percentage) => {
    if (percentage > 30) return 'diff-level-high';
    if (percentage > 15) return 'diff-level-medium';
    if (percentage > 5) return 'diff-level-low';
    return 'diff-level-none';
  };

  const getTempRangeClass = (range) => {
    if (range === 'LOW') return 'temp-low';
    if (range === 'MID') return 'temp-mid';
    if (range === 'HIGH') return 'temp-high';
    return '';
  };

  const renderHistoryDiff = (record) => {
    if (record.action === 'create') {
      return <div className="history-diff">创建新记录</div>;
    }
    if (record.action === 'delete') {
      return <div className="history-diff"><span className="diff-before">记录已删除</span></div>;
    }

    const diffs = [];
    const before = record.beforeState;
    const after = record.afterState;

    if (before && after) {
      if (before.name !== after.name) {
        diffs.push(
          <div key="name">
            <span className="diff-before">名称: {before.name}</span>
            <span className="diff-after">名称: {after.name}</span>
          </div>
        );
      }
      if (before.targetTemperature !== after.targetTemperature) {
        diffs.push(
          <div key="temp">
            <span className="diff-before">温度: {before.targetTemperature}℃</span>
            <span className="diff-after">温度: {after.targetTemperature}℃</span>
          </div>
        );
      }
      if (JSON.stringify(before.ingredients) !== JSON.stringify(after.ingredients)) {
        diffs.push(
          <div key="ingredients">
            <span className="diff-before">成分: {JSON.stringify(before.ingredients.map(i => `${i.materialName}:${i.ratio}`))}</span>
            <span className="diff-after">成分: {JSON.stringify(after.ingredients.map(i => `${i.materialName}:${i.ratio}`))}</span>
          </div>
        );
      }
    }

    return diffs.length > 0 ? (
      <div className="history-diff">{diffs}</div>
    ) : (
      <div className="history-diff">{record.description}</div>
    );
  };

  if (!currentRecipe) {
    return (
      <div className="container">
        <div className="card text-center">
          <div className="empty-state">
            <div className="empty-state-icon">🏺</div>
            <h2>陶瓷釉色配方试算器</h2>
            <p className="mt-4">点击下方按钮开始创建配方</p>
            <button className="btn btn-primary mt-4" onClick={resetRecipe}>
              创建新配方
            </button>
            <button className="btn btn-secondary mt-4" onClick={() => loadDemoRecipe('normal')}>
              加载演示配方
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🏺 陶瓷釉色配方试算器</h1>
        <p>调整釉料比例，对比烧成温度、成本和色差试片</p>
      </header>

      <div className="card">
        <div className="demo-section">
          <div className="card-header">
            <h3>🎬 快速演示</h3>
          </div>
          <div className="demo-buttons">
            <button className="btn btn-primary btn-sm" onClick={() => loadDemoRecipe('normal')}>
              ✅ 正常路径: 青瓷配方
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => loadDemoRecipe('invalidRatioSum')}>
              ❌ 异常: 比例总和≠100%
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => loadDemoRecipe('incompatibleMaterials')}>
              ❌ 异常: 成分冲突
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => loadDemoRecipe('inventoryInsufficient')}>
              ❌ 异常: 库存不足
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => loadDemoRecipe('temperatureIncompatible')}>
              ❌ 异常: 温度不兼容
            </button>
            <button className="btn btn-danger btn-sm" onClick={resetRecipe}>
              🆕 新建空白配方
            </button>
          </div>
        </div>
      </div>

      <div className="main-grid">
        <div className="card">
          <div className="card-header">
            <h2>📝 配方编辑</h2>
            <div className="batch-size-input">
              <label>批次量(g):</label>
              <input
                type="number"
                className="form-input"
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, parseFloat(e.target.value) || 1))}
                min="1"
              />
            </div>
          </div>

          <div className="form-group">
            <label>配方名称</label>
            <input
              type="text"
              className="form-input"
              value={currentRecipe.name}
              onChange={(e) => updateRecipeName(e.target.value)}
            />
          </div>

          <div className="flex-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>目标烧成温度 (℃)</label>
              <input
                type="number"
                className="form-input"
                value={currentRecipe.targetTemperature}
                onChange={(e) => updateRecipeField('targetTemperature', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>烧成气氛</label>
              <select
                className="form-select"
                value={currentRecipe.firingAtmosphere}
                onChange={(e) => updateRecipeField('firingAtmosphere', e.target.value)}
              >
                <option value={FIRING_ATMOSPHERE.OXIDATION}>{FIRING_ATMOSPHERE.OXIDATION}</option>
                <option value={FIRING_ATMOSPHERE.REDUCTION}>{FIRING_ATMOSPHERE.REDUCTION}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>目标颜色</label>
            <div className="color-input-group">
              <input
                type="color"
                value={currentRecipe.targetColor}
                onChange={(e) => updateRecipeField('targetColor', e.target.value)}
                style={{ width: 60, height: 40, cursor: 'pointer' }}
              />
              <input
                type="text"
                className="form-input"
                value={currentRecipe.targetColor}
                onChange={(e) => updateRecipeField('targetColor', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>添加釉料成分</label>
            <div className="ingredient-selector">
              <select
                className="form-select"
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
              >
                <option value="">选择成分...</option>
                {availableMaterials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} (库存: {m.currentStock}g, ¥{m.costPerGram}/g)
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={addIngredient}
                disabled={!selectedMaterialId}
              >
                + 添加
              </button>
            </div>
          </div>

          {currentRecipe.ingredients.length > 0 ? (
            <table className="ingredients-table">
              <thead>
                <tr>
                  <th>成分</th>
                  <th>比例 (%)</th>
                  <th>用量 (g)</th>
                  <th>成本 (¥)</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {currentRecipe.ingredients.map(ing => {
                  const material = materials.find(m => m.id === ing.materialId);
                  const amount = (ing.ratio / 100) * batchSize;
                  const cost = amount * (material?.costPerGram || 0);
                  const needsMore = amount > (material?.currentStock || 0);
                  
                  return (
                    <tr key={ing.materialId}>
                      <td>
                        <div className="flex-col">
                          <span className="font-semibold">{ing.materialName}</span>
                          {material && (
                            <span className={`text-sm ${needsMore ? 'inventory-error' : 'text-gray-500'}`}>
                              库存: {material.currentStock}g | 
                              建议: {material.minRatio}-{material.maxRatio}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="ratio-input"
                          value={ing.ratio}
                          onChange={(e) => updateIngredientRatio(ing.materialId, e.target.value)}
                          step="0.1"
                          min="0"
                        />
                      </td>
                      <td>{amount.toFixed(2)}</td>
                      <td>¥{cost.toFixed(2)}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => removeIngredient(ing.materialId)}
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td>总计</td>
                  <td className={Math.abs(totalRatio - 100) < 0.01 ? 'ratio-valid' : 'ratio-invalid'}>
                    {totalRatio.toFixed(2)}%
                  </td>
                  <td>{batchSize}g</td>
                  <td>¥{costCalculation?.totalCost.toFixed(2) || '0.00'}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p>暂无成分，请添加釉料成分</p>
            </div>
          )}

          {validation.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="font-bold text-sm mb-2">❌ 错误:</h4>
              {validation.errors.map((err, idx) => (
                <div key={idx} className="alert alert-error">
                  <span className="alert-icon">⚠️</span>
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="mt-4">
              <h4 className="font-bold text-sm mb-2">⚠️ 警告:</h4>
              {validation.warnings.map((warn, idx) => (
                <div key={idx} className="alert alert-warning">
                  <span className="alert-icon">⚡</span>
                  <span>{warn.message}</span>
                </div>
              ))}
            </div>
          )}

          {validation.isValid && currentRecipe.ingredients.length > 0 && (
            <div className="mt-4">
              <div className="alert alert-success">
                <span className="alert-icon">✅</span>
                <span>配方验证通过，可以进行试烧</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'cost' ? 'active' : ''}`}
                onClick={() => setActiveTab('cost')}
              >
                💰 成本计算
              </button>
              <button 
                className={`tab ${activeTab === 'test' ? 'active' : ''}`}
                onClick={() => setActiveTab('test')}
              >
                🧪 试片记录
              </button>
              <button 
                className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                📜 历史记录
              </button>
            </div>

            {activeTab === 'cost' && costCalculation && (
              <div className="cost-breakdown">
                <div className="cost-summary">
                  <div className="cost-item">
                    <label>总成本</label>
                    <value>¥{costCalculation.totalCost.toFixed(2)}</value>
                  </div>
                  <div className="cost-item">
                    <label>每克成本</label>
                    <value>¥{costCalculation.costPerGram.toFixed(4)}</value>
                  </div>
                </div>
                <h4 className="font-bold mb-2">成本明细:</h4>
                <div className="cost-breakdown-list">
                  {costCalculation.breakdown.map((item, idx) => (
                    <div key={idx} className="cost-breakdown-item">
                      <span>
                        {item.materialName}: {item.ratio}% = {item.amount.toFixed(2)}g 
                        (¥{item.costPerGram}/g)
                      </span>
                      <span className="font-semibold">¥{item.cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'cost' && !costCalculation && (
              <div className="empty-state">
                <div className="empty-state-icon">💰</div>
                <p>添加配方成分后显示成本计算</p>
              </div>
            )}

            {activeTab === 'test' && (
              <div>
                <div className="test-piece-form">
                  <h4 className="font-bold mb-4">记录试片烧成果</h4>
                  <div className="form-group">
                    <label>实际烧成温度 (℃)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={testPieceForm.actualTemperature}
                      placeholder={currentRecipe.targetTemperature}
                      onChange={(e) => setTestPieceForm(prev => ({
                        ...prev,
                        actualTemperature: e.target.value
                      }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>实际烧成气氛</label>
                    <select
                      className="form-select"
                      value={testPieceForm.actualAtmosphere}
                      onChange={(e) => setTestPieceForm(prev => ({
                        ...prev,
                        actualAtmosphere: e.target.value
                      }))}
                    >
                      <option value={FIRING_ATMOSPHERE.OXIDATION}>{FIRING_ATMOSPHERE.OXIDATION}</option>
                      <option value={FIRING_ATMOSPHERE.REDUCTION}>{FIRING_ATMOSPHERE.REDUCTION}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>实际观察颜色</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={testPieceForm.observedColor}
                        onChange={(e) => setTestPieceForm(prev => ({
                          ...prev,
                          observedColor: e.target.value
                        }))}
                        style={{ width: 60, height: 40, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={testPieceForm.observedColor}
                        onChange={(e) => setTestPieceForm(prev => ({
                          ...prev,
                          observedColor: e.target.value
                        }))}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>备注</label>
                    <textarea
                      className="form-input"
                      rows="2"
                      value={testPieceForm.notes}
                      onChange={(e) => setTestPieceForm(prev => ({
                        ...prev,
                        notes: e.target.value
                      }))}
                      placeholder="记录烧成过程中的特殊情况..."
                    />
                  </div>
                  <button
                    className="btn btn-primary w-full"
                    onClick={createTestPiece}
                    disabled={!validation.isValid}
                  >
                    {validation.isValid ? '📝 记录试片结果' : '请先修正配方错误'}
                  </button>
                </div>

                {testPieces.length > 0 ? (
                  <div className="test-piece-list mt-4">
                    <h4 className="font-bold mb-2">已记录的试片 ({testPieces.length}个)</h4>
                    <div className="scrollable">
                      {testPieces.map(piece => (
                        <div key={piece.id} className="test-piece-item">
                          <div className="test-piece-header">
                            <div>
                              <span className="font-semibold">试片 #{testPieces.length - testPieces.indexOf(piece)}</span>
                              <span className="test-piece-date ml-2">
                                {formatDate(piece.createdAt)}
                              </span>
                            </div>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => deleteTestPiece(piece.id)}
                            >
                              删除
                            </button>
                          </div>
                          <div className="test-piece-colors">
                            <div className="color-comparison">
                              <span className="text-sm">目标:</span>
                              <div 
                                className="color-preview" 
                                style={{ backgroundColor: piece.recipeSnapshot.targetColor }}
                              />
                              <span className="text-sm">{piece.recipeSnapshot.targetColor}</span>
                            </div>
                            <div className="color-comparison">
                              <span className="text-sm">实际:</span>
                              <div 
                                className="color-preview" 
                                style={{ backgroundColor: piece.observedColor }}
                              />
                              <span className="text-sm">{piece.observedColor}</span>
                            </div>
                          </div>
                          {piece.colorDifference && (
                            <div className="color-difference">
                              <div className="flex-row">
                                <span>色差程度:</span>
                                <span className={`font-bold ${getDiffLevelClass(piece.colorDifference.differencePercentage)}`}>
                                  {piece.colorDifference.level}
                                </span>
                                <span className="text-sm">
                                  (差异: {piece.colorDifference.differencePercentage.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="difference-metrics">
                                <div className="difference-metric">
                                  <label>R通道</label>
                                  <value>{piece.colorDifference.rDifference > 0 ? '+' : ''}{piece.colorDifference.rDifference}</value>
                                </div>
                                <div className="difference-metric">
                                  <label>G通道</label>
                                  <value>{piece.colorDifference.gDifference > 0 ? '+' : ''}{piece.colorDifference.gDifference}</value>
                                </div>
                                <div className="difference-metric">
                                  <label>B通道</label>
                                  <value>{piece.colorDifference.bDifference > 0 ? '+' : ''}{piece.colorDifference.bDifference}</value>
                                </div>
                              </div>
                            </div>
                          )}
                          {piece.notes && (
                            <p className="text-sm text-gray-500 mt-2">📝 {piece.notes}</p>
                          )}
                          <div className="text-sm text-gray-500 mt-2">
                            温度: {piece.actualTemperature}℃ | 气氛: {piece.actualAtmosphere}
                            {piece.costResult && ` | 成本: ¥${piece.costResult.totalCost.toFixed(2)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🧪</div>
                    <p>暂无试片记录</p>
                    <p className="text-sm">记录试烧结果，比较色差变化</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="history-section">
                {history.length > 0 ? (
                  history.map(record => (
                    <div key={record.id} className="history-item">
                      <div className="history-header">
                        <div>
                          <span className={`history-action action-${record.action}`}>
                            {record.action === 'create' ? '创建' : record.action === 'update' ? '修改' : '删除'}
                          </span>
                          <span className="ml-2 text-sm">
                            {record.entityType === 'recipe' ? '配方' : '试片'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDate(record.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold mb-2">{record.description}</p>
                      {renderHistoryDiff(record)}
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">📜</div>
                    <p>暂无历史记录</p>
                    <p className="text-sm">修改配方或记录试片后会显示历史</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {testPieces.length > 1 && activeTab === 'test' && (
            <div className="card mt-4">
              <div className="card-header">
                <h3>📊 试片对比</h3>
              </div>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>试片</th>
                    <th>温度</th>
                    <th>目标色</th>
                    <th>实际色</th>
                    <th>色差</th>
                    <th>成本</th>
                  </tr>
                </thead>
                <tbody>
                  {testPieces.map((piece, idx) => (
                    <tr key={piece.id}>
                      <td className="font-semibold">#{testPieces.length - idx}</td>
                      <td>{piece.actualTemperature}℃</td>
                      <td>
                        <div 
                          className="color-preview" 
                          style={{ 
                            backgroundColor: piece.recipeSnapshot.targetColor,
                            width: 30,
                            height: 30,
                            margin: '0 auto'
                          }}
                        />
                      </td>
                      <td>
                        <div 
                          className="color-preview" 
                          style={{ 
                            backgroundColor: piece.observedColor,
                            width: 30,
                            height: 30,
                            margin: '0 auto'
                          }}
                        />
                      </td>
                      <td className={getDiffLevelClass(piece.colorDifference?.differencePercentage || 0)}>
                        {piece.colorDifference?.level || '-'}
                        <div className="text-sm">
                          {piece.colorDifference?.differencePercentage.toFixed(1) || 0}%
                        </div>
                      </td>
                      <td>¥{piece.costResult?.totalCost.toFixed(2) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>📖 使用说明</h3>
        </div>
        <div style={{ lineHeight: 1.8 }}>
          <h4 className="font-bold mb-2">🚀 最短演示路径:</h4>
          <ol style={{ paddingLeft: 24 }}>
            <li>点击顶部「正常路径: 青瓷配方」按钮加载演示配方</li>
            <li>查看配方成分比例（总和 100%）、烧成温度（1200℃）</li>
            <li>切换到「成本计算」标签查看总成本和明细</li>
            <li>切换到「试片记录」标签，输入实际观察颜色后点击记录</li>
            <li>在「历史记录」标签查看所有操作变化</li>
          </ol>
          
          <h4 className="font-bold mt-4 mb-2">❌ 异常触发路径:</h4>
          <ol style={{ paddingLeft: 24 }}>
            <li>点击「异常: 比例总和≠100%」— 查看比例验证错误</li>
            <li>点击「异常: 成分冲突」— 查看铜氧化物与钴氧化物冲突</li>
            <li>点击「异常: 库存不足」— 查看钴氧化物库存不足警告</li>
            <li>点击「异常: 温度不兼容」— 查看低温成分用在高温的警告</li>
            <li>手动调整比例为负数或超过 100% — 查看实时错误提示</li>
          </ol>

          <h4 className="font-bold mt-4 mb-2">💡 功能要点:</h4>
          <ul style={{ paddingLeft: 24 }}>
            <li><strong>釉料比例</strong>: 实时验证总和必须为 100%，单种成分有建议范围</li>
            <li><strong>烧成温度</strong>: 检查成分与目标温度的兼容性</li>
            <li><strong>成本计算</strong>: 按批次量自动计算各成分成本和总成本</li>
            <li><strong>色差记录</strong>: RGB 颜色空间计算目标与实际的差异程度</li>
            <li><strong>历史记录</strong>: 记录所有修改，显示前后变化对比</li>
            <li><strong>约束冲突</strong>: 成分冲突、库存不足等都会明确提示，不会静默失败</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
