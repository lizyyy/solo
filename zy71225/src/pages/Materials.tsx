import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Edit, Trash2, Copy, Download, Upload, 
  Play, GitCompare, Settings, TrendingUp, AlertCircle, Check, X 
} from 'lucide-react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { useGameStore } from '@/store/useGameStore';
import type { GameMaterials, Position, MarketEvent, ParameterDiff } from '@/types';
import { formatCurrency, formatNumber, getCategoryLabel, getCategoryColor, getRatingLabel, getPnLColor } from '@/utils/format';
import { generateId, cloneMaterials } from '@/data/defaultMaterials';

type TabType = 'list' | 'edit' | 'compare' | 'results';
type EditSection = 'basic' | 'positions' | 'market' | 'margin' | 'fees' | 'targets';

export const MaterialsPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    materials, currentMaterials, loadDefaultMaterials, setCurrentMaterials,
    saveMaterials, deleteMaterials, duplicateMaterials, exportMaterials, importMaterials,
    createComparison, versionComparison, comparisonResults, setComparisonResult, clearComparison
  } = useMaterialStore();
  const { savedGames, clearCurrentGame } = useGameStore();
  
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [editSection, setEditSection] = useState<EditSection>('basic');
  const [editingMaterials, setEditingMaterials] = useState<GameMaterials | null>(null);
  const [compareOldId, setCompareOldId] = useState<string>('');
  const [compareNewId, setCompareNewId] = useState<string>('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    loadDefaultMaterials();
  }, [loadDefaultMaterials]);

  const handleCreateNew = () => {
    const newMaterials: GameMaterials = {
      id: generateId(),
      name: '新训练材料',
      description: '请输入材料描述',
      createdAt: Date.now(),
      initialUnderlyingPrice: 100,
      initialCash: 1000000,
      initialPositions: [],
      marketEvents: [],
      marginConfig: {
        initialMarginRate: 0.15,
        maintenanceMarginRate: 0.10,
        marginCallThreshold: 0.80,
      },
      feeConfig: {
        optionTradingFee: 0.002,
        underlyingTradingFee: 0.001,
        exerciseFee: 0.5,
        slippage: 0.0005,
      },
      greekTargets: {
        delta: { min: -50, max: 50 },
        gamma: { min: -30, max: 30 },
        vega: { min: -200, max: 200 },
      },
    };
    setEditingMaterials(newMaterials);
    setActiveTab('edit');
  };

  const handleEdit = (material: GameMaterials) => {
    setEditingMaterials(cloneMaterials(material));
    setActiveTab('edit');
  };

  const handleSave = () => {
    if (editingMaterials) {
      saveMaterials(editingMaterials);
      setCurrentMaterials(editingMaterials);
      setActiveTab('list');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这份材料吗？此操作不可撤销。')) {
      deleteMaterials(id);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicateMaterials(id);
  };

  const handleExport = (id: string) => {
    const data = exportMaterials(id);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `训练材料-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const result = importMaterials(importText);
    if (result) {
      setShowImportModal(false);
      setImportText('');
      setImportError('');
    } else {
      setImportError('导入失败，请检查JSON格式是否正确');
    }
  };

  const handleStartGame = (materialId: string) => {
    clearCurrentGame();
    navigate(`/game/${materialId}`);
  };

  const handleCreateComparison = () => {
    if (compareOldId && compareNewId && compareOldId !== compareNewId) {
      createComparison(compareOldId, compareNewId);
    }
  };

  const handleRunComparison = (type: 'old' | 'new') => {
    if (!versionComparison) return;
    
    const material = type === 'old' ? versionComparison.oldMaterials : versionComparison.newMaterials;
    clearCurrentGame();
    
    navigate(`/game/${material.id}?compare=${type}`);
  };

  const renderDiffValue = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return formatNumber(value, 4);
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-bloomberg-border/30 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">材料管理</h1>
              <p className="text-sm text-bloomberg-muted">管理和编辑训练材料，对比不同参数的训练结果</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-bloomberg-border hover:bg-bloomberg-border/50 rounded-lg transition-colors"
            >
              <Upload size={16} />
              导入
            </button>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg transition-colors"
            >
              <Plus size={16} />
              新建材料
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-bloomberg-border">
          {[
            { id: 'list', label: '材料列表', icon: Settings },
            { id: 'edit', label: '编辑材料', icon: Edit },
            { id: 'compare', label: '参数对比', icon: GitCompare },
            { id: 'results', label: '结果对比', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 transition-colors
                ${activeTab === tab.id 
                  ? 'border-highlight-blue text-highlight-blue' 
                  : 'border-transparent text-bloomberg-muted hover:text-bloomberg-text'
                }
              `}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'list' && (
          <div className="space-y-4">
            {materials.length === 0 ? (
              <div className="text-center py-12 bg-bloomberg-panel rounded-xl border border-bloomberg-border">
                <Settings size={48} className="mx-auto text-bloomberg-muted mb-4" />
                <p className="text-bloomberg-muted mb-4">暂无训练材料</p>
                <button
                  onClick={handleCreateNew}
                  className="px-4 py-2 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg transition-colors"
                >
                  创建第一份材料
                </button>
              </div>
            ) : (
              materials.map(material => (
                <div 
                  key={material.id}
                  className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6 hover:border-bloomberg-muted/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{material.name}</h3>
                        <span className="px-2 py-0.5 bg-highlight-blue/20 text-highlight-blue text-xs rounded">
                          {material.marketEvents.length} 回合
                        </span>
                        <span className="px-2 py-0.5 bg-trader-green/20 text-trader-green text-xs rounded">
                          {material.initialPositions.filter(p => p.type !== 'underlying').length} 个头寸
                        </span>
                        {material.marketEvents.some(e => e.isShock) && (
                          <span className="px-2 py-0.5 bg-trader-red/20 text-trader-red text-xs rounded">
                            含突变行情
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-bloomberg-muted mb-3">{material.description}</p>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-bloomberg-muted">初始价格：</span>
                          <span className="font-mono">¥{formatNumber(material.initialUnderlyingPrice, 2)}</span>
                        </div>
                        <div>
                          <span className="text-bloomberg-muted">初始资金：</span>
                          <span className="font-mono">{formatCurrency(material.initialCash)}</span>
                        </div>
                        <div>
                          <span className="text-bloomberg-muted">保证金率：</span>
                          <span className="font-mono">{(material.marginConfig.initialMarginRate * 100).toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-bloomberg-muted">Gamma目标：</span>
                          <span className="font-mono">[{material.greekTargets.gamma.min}, {material.greekTargets.gamma.max}]</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartGame(material.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-trader-green hover:bg-trader-green/80 text-white rounded-lg transition-colors"
                      >
                        <Play size={16} />
                        开始训练
                      </button>
                      <button
                        onClick={() => handleEdit(material)}
                        className="p-2 hover:bg-bloomberg-border/30 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDuplicate(material.id)}
                        className="p-2 hover:bg-bloomberg-border/30 rounded-lg transition-colors"
                        title="复制"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => handleExport(material.id)}
                        className="p-2 hover:bg-bloomberg-border/30 rounded-lg transition-colors"
                        title="导出"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(material.id)}
                        className="p-2 hover:bg-trader-red/20 text-trader-red rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-bloomberg-bg/50 rounded-lg p-3">
                      <div className="text-xs text-bloomberg-muted mb-2">初始头寸</div>
                      <div className="space-y-1">
                        {material.initialPositions.slice(0, 3).map(pos => (
                          <div key={pos.id} className="flex justify-between text-sm">
                            <span>{pos.contractCode}</span>
                            <span className={pos.quantity < 0 ? 'text-trader-red' : 'text-trader-green'}>
                              {pos.quantity > 0 ? '+' : ''}{pos.quantity} 张
                            </span>
                          </div>
                        ))}
                        {material.initialPositions.length > 3 && (
                          <div className="text-xs text-bloomberg-muted">
                            还有 {material.initialPositions.length - 3} 个头寸...
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-bloomberg-bg/50 rounded-lg p-3">
                      <div className="text-xs text-bloomberg-muted mb-2">行情序列</div>
                      <div className="flex gap-1 flex-wrap">
                        {material.marketEvents.slice(0, 8).map(event => (
                          <span 
                            key={event.round}
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono
                              ${event.isShock ? 'bg-trader-red/30 text-trader-red' : 'bg-bloomberg-border/50'}
                            `}
                            title={event.description}
                          >
                            {event.round}
                          </span>
                        ))}
                        {material.marketEvents.length > 8 && (
                          <span className="text-xs text-bloomberg-muted">
                            +{material.marketEvents.length - 8}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-bloomberg-bg/50 rounded-lg p-3">
                      <div className="text-xs text-bloomberg-muted mb-2">希腊值目标区间</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Delta</span>
                          <span className="font-mono">[{material.greekTargets.delta.min}, {material.greekTargets.delta.max}]</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gamma</span>
                          <span className="font-mono">[{material.greekTargets.gamma.min}, {material.greekTargets.gamma.max}]</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Vega</span>
                          <span className="font-mono">[{material.greekTargets.vega.min}, {material.greekTargets.vega.max}]</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'edit' && editingMaterials && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3">
              <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-4 sticky top-6">
                <h3 className="font-bold mb-4">编辑区域</h3>
                <div className="space-y-1">
                  {[
                    { id: 'basic', label: '基本信息' },
                    { id: 'positions', label: '初始头寸' },
                    { id: 'market', label: '行情序列' },
                    { id: 'margin', label: '保证金配置' },
                    { id: 'fees', label: '费用配置' },
                    { id: 'targets', label: '希腊值目标' },
                  ].map(section => (
                    <button
                      key={section.id}
                      onClick={() => setEditSection(section.id as EditSection)}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg transition-colors
                        ${editSection === section.id 
                          ? 'bg-highlight-blue/20 text-highlight-blue' 
                          : 'hover:bg-bloomberg-border/30'
                        }
                      `}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-bloomberg-border space-y-2">
                  <button
                    onClick={handleSave}
                    className="w-full py-2 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg transition-colors"
                  >
                    保存材料
                  </button>
                  <button
                    onClick={() => setActiveTab('list')}
                    className="w-full py-2 bg-bloomberg-border hover:bg-bloomberg-border/50 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>

            <div className="col-span-9">
              <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
                {editSection === 'basic' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold">基本信息</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">材料名称</label>
                        <input
                          type="text"
                          value={editingMaterials.name}
                          onChange={e => setEditingMaterials({ ...editingMaterials, name: e.target.value })}
                          className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">初始标的价格</label>
                        <input
                          type="number"
                          value={editingMaterials.initialUnderlyingPrice}
                          onChange={e => setEditingMaterials({ ...editingMaterials, initialUnderlyingPrice: Number(e.target.value) })}
                          className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">初始资金</label>
                        <input
                          type="number"
                          value={editingMaterials.initialCash}
                          onChange={e => setEditingMaterials({ ...editingMaterials, initialCash: Number(e.target.value) })}
                          className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-bloomberg-muted mb-2">材料描述</label>
                      <textarea
                        value={editingMaterials.description}
                        onChange={e => setEditingMaterials({ ...editingMaterials, description: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {editSection === 'positions' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold">初始头寸</h3>
                      <button
                        onClick={() => {
                          const newPos: Position = {
                            id: generateId(),
                            contractCode: 'NEW-POS',
                            type: 'call',
                            strike: editingMaterials.initialUnderlyingPrice,
                            expiryDays: 30,
                            quantity: 0,
                            costPrice: 0,
                          };
                          setEditingMaterials({
                            ...editingMaterials,
                            initialPositions: [...editingMaterials.initialPositions, newPos]
                          });
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-highlight-blue hover:bg-highlight-blue/80 text-white text-sm rounded-lg transition-colors"
                      >
                        <Plus size={14} />
                        添加头寸
                      </button>
                    </div>

                    <div className="space-y-3">
                      {editingMaterials.initialPositions.map((pos, idx) => (
                        <div key={pos.id} className="bg-bloomberg-bg/50 rounded-lg p-4">
                          <div className="grid grid-cols-7 gap-4 items-end">
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">合约代码</label>
                              <input
                                type="text"
                                value={pos.contractCode}
                                onChange={e => {
                                  const newPositions = [...editingMaterials.initialPositions];
                                  newPositions[idx] = { ...pos, contractCode: e.target.value };
                                  setEditingMaterials({ ...editingMaterials, initialPositions: newPositions });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">类型</label>
                              <select
                                value={pos.type}
                                onChange={e => {
                                  const newPositions = [...editingMaterials.initialPositions];
                                  newPositions[idx] = { ...pos, type: e.target.value as Position['type'] };
                                  setEditingMaterials({ ...editingMaterials, initialPositions: newPositions });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              >
                                <option value="call">看涨期权</option>
                                <option value="put">看跌期权</option>
                                <option value="underlying">标的资产</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">行权价</label>
                              <input
                                type="number"
                                value={pos.strike}
                                onChange={e => {
                                  const newPositions = [...editingMaterials.initialPositions];
                                  newPositions[idx] = { ...pos, strike: Number(e.target.value) };
                                  setEditingMaterials({ ...editingMaterials, initialPositions: newPositions });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">到期天数</label>
                              <input
                                type="number"
                                value={pos.expiryDays}
                                onChange={e => {
                                  const newPositions = [...editingMaterials.initialPositions];
                                  newPositions[idx] = { ...pos, expiryDays: Number(e.target.value) };
                                  setEditingMaterials({ ...editingMaterials, initialPositions: newPositions });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">数量</label>
                              <input
                                type="number"
                                value={pos.quantity}
                                onChange={e => {
                                  const newPositions = [...editingMaterials.initialPositions];
                                  newPositions[idx] = { ...pos, quantity: Number(e.target.value) };
                                  setEditingMaterials({ ...editingMaterials, initialPositions: newPositions });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">成本价</label>
                              <input
                                type="number"
                                step="0.01"
                                value={pos.costPrice}
                                onChange={e => {
                                  const newPositions = [...editingMaterials.initialPositions];
                                  newPositions[idx] = { ...pos, costPrice: Number(e.target.value) };
                                  setEditingMaterials({ ...editingMaterials, initialPositions: newPositions });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div className="flex gap-1">
                              {editingMaterials.initialPositions.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newPositions = editingMaterials.initialPositions.filter((_, i) => i !== idx);
                                    setEditingMaterials({ ...editingMaterials, initialPositions: newPositions });
                                  }}
                                  className="p-1.5 hover:bg-trader-red/20 text-trader-red rounded transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editSection === 'market' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold">行情序列</h3>
                      <button
                        onClick={() => {
                          const lastEvent = editingMaterials.marketEvents[editingMaterials.marketEvents.length - 1];
                          const newEvent: MarketEvent = {
                            round: editingMaterials.marketEvents.length + 1,
                            underlyingPrice: lastEvent?.underlyingPrice || editingMaterials.initialUnderlyingPrice,
                            priceChange: 0,
                            volatility: lastEvent?.volatility || 20,
                            volatilityChange: 0,
                            daysPassed: (lastEvent?.daysPassed || 0) + 1,
                            isShock: false,
                            description: '新行情事件',
                          };
                          setEditingMaterials({
                            ...editingMaterials,
                            marketEvents: [...editingMaterials.marketEvents, newEvent]
                          });
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-highlight-blue hover:bg-highlight-blue/80 text-white text-sm rounded-lg transition-colors"
                      >
                        <Plus size={14} />
                        添加回合
                      </button>
                    </div>

                    <div className="space-y-3">
                      {editingMaterials.marketEvents.map((event, idx) => (
                        <div 
                          key={event.round} 
                          className={`bg-bloomberg-bg/50 rounded-lg p-4 ${event.isShock ? 'border-l-4 border-trader-red' : ''}`}
                        >
                          <div className="grid grid-cols-8 gap-4 items-end">
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">回合</label>
                              <input
                                type="number"
                                value={event.round}
                                onChange={e => {
                                  const newEvents = [...editingMaterials.marketEvents];
                                  newEvents[idx] = { ...event, round: Number(e.target.value) };
                                  setEditingMaterials({ ...editingMaterials, marketEvents: newEvents });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">标的价格</label>
                              <input
                                type="number"
                                step="0.01"
                                value={event.underlyingPrice}
                                onChange={e => {
                                  const newEvents = [...editingMaterials.marketEvents];
                                  newEvents[idx] = { ...event, underlyingPrice: Number(e.target.value) };
                                  setEditingMaterials({ ...editingMaterials, marketEvents: newEvents });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">波动率 %</label>
                              <input
                                type="number"
                                step="0.1"
                                value={event.volatility}
                                onChange={e => {
                                  const newEvents = [...editingMaterials.marketEvents];
                                  newEvents[idx] = { ...event, volatility: Number(e.target.value) };
                                  setEditingMaterials({ ...editingMaterials, marketEvents: newEvents });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-bloomberg-muted mb-1">过去天数</label>
                              <input
                                type="number"
                                value={event.daysPassed}
                                onChange={e => {
                                  const newEvents = [...editingMaterials.marketEvents];
                                  newEvents[idx] = { ...event, daysPassed: Number(e.target.value) };
                                  setEditingMaterials({ ...editingMaterials, marketEvents: newEvents });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-bloomberg-muted mb-1">描述</label>
                              <input
                                type="text"
                                value={event.description}
                                onChange={e => {
                                  const newEvents = [...editingMaterials.marketEvents];
                                  newEvents[idx] = { ...event, description: e.target.value };
                                  setEditingMaterials({ ...editingMaterials, marketEvents: newEvents });
                                }}
                                className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={event.isShock}
                                  onChange={e => {
                                    const newEvents = [...editingMaterials.marketEvents];
                                    newEvents[idx] = { ...event, isShock: e.target.checked };
                                    setEditingMaterials({ ...editingMaterials, marketEvents: newEvents });
                                  }}
                                  className="w-4 h-4 rounded border-bloomberg-border bg-bloomberg-bg"
                                />
                                <span className="text-sm">突变</span>
                              </label>
                            </div>
                            <div className="flex gap-1">
                              {editingMaterials.marketEvents.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newEvents = editingMaterials.marketEvents.filter((_, i) => i !== idx);
                                    const reindexed = newEvents.map((e, i) => ({ ...e, round: i + 1 }));
                                    setEditingMaterials({ ...editingMaterials, marketEvents: reindexed });
                                  }}
                                  className="p-1.5 hover:bg-trader-red/20 text-trader-red rounded transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="block text-xs text-bloomberg-muted mb-1">培训师批注</label>
                            <input
                              type="text"
                              value={event.handwrittenNote || ''}
                              onChange={e => {
                                const newEvents = [...editingMaterials.marketEvents];
                                newEvents[idx] = { ...event, handwrittenNote: e.target.value };
                                setEditingMaterials({ ...editingMaterials, marketEvents: newEvents });
                              }}
                              className="w-full px-3 py-1.5 bg-bloomberg-bg border border-bloomberg-border rounded text-sm font-handwritten"
                              placeholder="手写批注内容..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editSection === 'margin' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold">保证金配置</h3>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">初始保证金率</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={editingMaterials.marginConfig.initialMarginRate * 100}
                            onChange={e => setEditingMaterials({
                              ...editingMaterials,
                              marginConfig: {
                                ...editingMaterials.marginConfig,
                                initialMarginRate: Number(e.target.value) / 100
                              }
                            })}
                            className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bloomberg-muted">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">维持保证金率</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={editingMaterials.marginConfig.maintenanceMarginRate * 100}
                            onChange={e => setEditingMaterials({
                              ...editingMaterials,
                              marginConfig: {
                                ...editingMaterials.marginConfig,
                                maintenanceMarginRate: Number(e.target.value) / 100
                              }
                            })}
                            className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bloomberg-muted">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">追缴阈值</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={editingMaterials.marginConfig.marginCallThreshold * 100}
                            onChange={e => setEditingMaterials({
                              ...editingMaterials,
                              marginConfig: {
                                ...editingMaterials.marginConfig,
                                marginCallThreshold: Number(e.target.value) / 100
                              }
                            })}
                            className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bloomberg-muted">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {editSection === 'fees' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold">费用配置</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">期权交易费率</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.0001"
                            value={editingMaterials.feeConfig.optionTradingFee * 100}
                            onChange={e => setEditingMaterials({
                              ...editingMaterials,
                              feeConfig: {
                                ...editingMaterials.feeConfig,
                                optionTradingFee: Number(e.target.value) / 100
                              }
                            })}
                            className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bloomberg-muted">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">标的交易费率</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.0001"
                            value={editingMaterials.feeConfig.underlyingTradingFee * 100}
                            onChange={e => setEditingMaterials({
                              ...editingMaterials,
                              feeConfig: {
                                ...editingMaterials.feeConfig,
                                underlyingTradingFee: Number(e.target.value) / 100
                              }
                            })}
                            className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bloomberg-muted">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">行权费用 (元/张)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editingMaterials.feeConfig.exerciseFee}
                          onChange={e => setEditingMaterials({
                            ...editingMaterials,
                            feeConfig: {
                              ...editingMaterials.feeConfig,
                              exerciseFee: Number(e.target.value)
                            }
                          })}
                          className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-bloomberg-muted mb-2">滑点率</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.0001"
                            value={editingMaterials.feeConfig.slippage * 100}
                            onChange={e => setEditingMaterials({
                              ...editingMaterials,
                              feeConfig: {
                                ...editingMaterials.feeConfig,
                                slippage: Number(e.target.value) / 100
                              }
                            })}
                            className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bloomberg-muted">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {editSection === 'targets' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold">希腊值目标区间</h3>
                    <div className="space-y-6">
                      <div className="bg-bloomberg-bg/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold">Delta 目标区间</h4>
                          <span className="text-sm text-bloomberg-muted">控制方向性风险</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-bloomberg-muted mb-1">最小值</label>
                            <input
                              type="number"
                              value={editingMaterials.greekTargets.delta.min}
                              onChange={e => setEditingMaterials({
                                ...editingMaterials,
                                greekTargets: {
                                  ...editingMaterials.greekTargets,
                                  delta: { ...editingMaterials.greekTargets.delta, min: Number(e.target.value) }
                                }
                              })}
                              className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-bloomberg-muted mb-1">最大值</label>
                            <input
                              type="number"
                              value={editingMaterials.greekTargets.delta.max}
                              onChange={e => setEditingMaterials({
                                ...editingMaterials,
                                greekTargets: {
                                  ...editingMaterials.greekTargets,
                                  delta: { ...editingMaterials.greekTargets.delta, max: Number(e.target.value) }
                                }
                              })}
                              className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-bloomberg-bg/50 rounded-lg p-4 border-l-4 border-warning-orange">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold">Gamma 目标区间</h4>
                          <span className="text-sm text-warning-orange">重点监控！凸性风险</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-bloomberg-muted mb-1">最小值</label>
                            <input
                              type="number"
                              value={editingMaterials.greekTargets.gamma.min}
                              onChange={e => setEditingMaterials({
                                ...editingMaterials,
                                greekTargets: {
                                  ...editingMaterials.greekTargets,
                                  gamma: { ...editingMaterials.greekTargets.gamma, min: Number(e.target.value) }
                                }
                              })}
                              className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-bloomberg-muted mb-1">最大值</label>
                            <input
                              type="number"
                              value={editingMaterials.greekTargets.gamma.max}
                              onChange={e => setEditingMaterials({
                                ...editingMaterials,
                                greekTargets: {
                                  ...editingMaterials.greekTargets,
                                  gamma: { ...editingMaterials.greekTargets.gamma, max: Number(e.target.value) }
                                }
                              })}
                              className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-bloomberg-bg/50 rounded-lg p-4 border-l-4 border-highlight-blue">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold">Vega 目标区间</h4>
                          <span className="text-sm text-highlight-blue">波动率敏感度</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-bloomberg-muted mb-1">最小值</label>
                            <input
                              type="number"
                              value={editingMaterials.greekTargets.vega.min}
                              onChange={e => setEditingMaterials({
                                ...editingMaterials,
                                greekTargets: {
                                  ...editingMaterials.greekTargets,
                                  vega: { ...editingMaterials.greekTargets.vega, min: Number(e.target.value) }
                                }
                              })}
                              className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-bloomberg-muted mb-1">最大值</label>
                            <input
                              type="number"
                              value={editingMaterials.greekTargets.vega.max}
                              onChange={e => setEditingMaterials({
                                ...editingMaterials,
                                greekTargets: {
                                  ...editingMaterials.greekTargets,
                                  vega: { ...editingMaterials.greekTargets.vega, max: Number(e.target.value) }
                                }
                              })}
                              className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-6">
            <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
              <h3 className="text-xl font-bold mb-4">参数对比</h3>
              <p className="text-bloomberg-muted mb-6">选择两份材料进行参数差异对比</p>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm text-bloomberg-muted mb-2">原始材料 (旧)</label>
                  <select
                    value={compareOldId}
                    onChange={e => setCompareOldId(e.target.value)}
                    className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                  >
                    <option value="">请选择...</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-bloomberg-muted mb-2">修改后材料 (新)</label>
                  <select
                    value={compareNewId}
                    onChange={e => setCompareNewId(e.target.value)}
                    className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none"
                  >
                    <option value="">请选择...</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateComparison}
                disabled={!compareOldId || !compareNewId || compareOldId === compareNewId}
                className="flex items-center gap-2 px-6 py-2 bg-highlight-blue hover:bg-highlight-blue/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <GitCompare size={16} />
                生成对比报告
              </button>
            </div>

            {versionComparison && (
              <div className="space-y-6">
                <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold">参数差异</h3>
                      <p className="text-sm text-bloomberg-muted">
                        发现 {versionComparison.parameterDiffs.length} 处差异
                      </p>
                    </div>
                    <button
                      onClick={clearComparison}
                      className="text-sm text-bloomberg-muted hover:text-bloomberg-text"
                    >
                      清除对比
                    </button>
                  </div>

                  {versionComparison.parameterDiffs.length === 0 ? (
                    <div className="text-center py-8">
                      <Check size={48} className="mx-auto text-trader-green mb-4" />
                      <p className="text-bloomberg-text">两份材料参数完全相同</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {versionComparison.parameterDiffs.map((diff, idx) => (
                        <div 
                          key={idx}
                          className="bg-bloomberg-bg/50 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getCategoryColor(diff.category)}`}>
                                  {getCategoryLabel(diff.category)}
                                </span>
                                <span className="font-mono text-sm text-bloomberg-muted">{diff.path}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs text-bloomberg-muted mb-1">原值</div>
                                  <div className="font-mono text-trader-red line-through">
                                    {renderDiffValue(diff.oldValue)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-bloomberg-muted mb-1">新值</div>
                                  <div className="font-mono text-trader-green">
                                    {renderDiffValue(diff.newValue)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            {!versionComparison ? (
              <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-12 text-center">
                <GitCompare size={48} className="mx-auto text-bloomberg-muted mb-4" />
                <h3 className="text-xl font-bold mb-2">暂无对比数据</h3>
                <p className="text-bloomberg-muted mb-6">请先在"参数对比"标签页选择两份材料进行对比</p>
                <button
                  onClick={() => setActiveTab('compare')}
                  className="px-6 py-2 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg transition-colors"
                >
                  去创建对比
                </button>
              </div>
            ) : (
              <>
                <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
                  <h3 className="text-xl font-bold mb-6">训练结果对比</h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-bloomberg-bg/50 rounded-lg p-6 border-2 border-bloomberg-border">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-bold">原始材料</h4>
                          <p className="text-sm text-bloomberg-muted">{versionComparison.oldMaterials.name}</p>
                        </div>
                        <span className="px-2 py-1 bg-bloomberg-border rounded text-xs">旧版</span>
                      </div>
                      
                      {comparisonResults?.oldResult ? (
                        <div className="space-y-4">
                          <div className="text-center">
                            <div className="text-6xl font-bold text-trader-green mb-2">
                              {getRatingLabel(comparisonResults.oldResult.scores.overall)}
                            </div>
                            <div className="text-2xl font-mono">
                              {comparisonResults.oldResult.scores.overall} 分
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-xs text-bloomberg-muted">最终盈亏</div>
                              <div className={`font-mono font-bold ${getPnLColor(comparisonResults.oldResult.finalPnL)}`}>
                                {formatCurrency(comparisonResults.oldResult.finalPnL)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-bloomberg-muted">完成回合</div>
                              <div className="font-mono font-bold">
                                {comparisonResults.oldResult.playedRounds} / {comparisonResults.oldResult.totalRounds}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-bloomberg-muted">风险管理</div>
                              <div className="font-mono font-bold">
                                {comparisonResults.oldResult.scores.riskManagement}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-bloomberg-muted">错误数量</div>
                              <div className="font-mono font-bold text-trader-red">
                                {comparisonResults.oldResult.errors.length}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <AlertCircle size={32} className="mx-auto text-bloomberg-muted mb-3" />
                          <p className="text-bloomberg-muted mb-4">尚未运行训练</p>
                          <button
                            onClick={() => handleRunComparison('old')}
                            className="flex items-center gap-2 px-4 py-2 bg-trader-green hover:bg-trader-green/80 text-white rounded-lg transition-colors mx-auto"
                          >
                            <Play size={14} />
                            运行训练
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="bg-bloomberg-bg/50 rounded-lg p-6 border-2 border-highlight-blue">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-bold">修改后材料</h4>
                          <p className="text-sm text-bloomberg-muted">{versionComparison.newMaterials.name}</p>
                        </div>
                        <span className="px-2 py-1 bg-highlight-blue/20 text-highlight-blue rounded text-xs">新版</span>
                      </div>
                      
                      {comparisonResults?.newResult ? (
                        <div className="space-y-4">
                          <div className="text-center">
                            <div className="text-6xl font-bold text-trader-green mb-2">
                              {getRatingLabel(comparisonResults.newResult.scores.overall)}
                            </div>
                            <div className="text-2xl font-mono">
                              {comparisonResults.newResult.scores.overall} 分
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-xs text-bloomberg-muted">最终盈亏</div>
                              <div className={`font-mono font-bold ${getPnLColor(comparisonResults.newResult.finalPnL)}`}>
                                {formatCurrency(comparisonResults.newResult.finalPnL)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-bloomberg-muted">完成回合</div>
                              <div className="font-mono font-bold">
                                {comparisonResults.newResult.playedRounds} / {comparisonResults.newResult.totalRounds}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-bloomberg-muted">风险管理</div>
                              <div className="font-mono font-bold">
                                {comparisonResults.newResult.scores.riskManagement}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-bloomberg-muted">错误数量</div>
                              <div className="font-mono font-bold text-trader-red">
                                {comparisonResults.newResult.errors.length}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <AlertCircle size={32} className="mx-auto text-bloomberg-muted mb-3" />
                          <p className="text-bloomberg-muted mb-4">尚未运行训练</p>
                          <button
                            onClick={() => handleRunComparison('new')}
                            className="flex items-center gap-2 px-4 py-2 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg transition-colors mx-auto"
                          >
                            <Play size={14} />
                            运行训练
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {comparisonResults?.oldResult && comparisonResults?.newResult && (
                    <div className="mt-6 bg-bloomberg-bg/50 rounded-lg p-6">
                      <h4 className="font-bold mb-4">评分对比</h4>
                      <div className="space-y-3">
                        {[
                          { key: 'overall', label: '综合评分', old: comparisonResults.oldResult.scores.overall, new: comparisonResults.newResult.scores.overall },
                          { key: 'riskManagement', label: '风险管理', old: comparisonResults.oldResult.scores.riskManagement, new: comparisonResults.newResult.scores.riskManagement },
                          { key: 'costControl', label: '成本控制', old: comparisonResults.oldResult.scores.costControl, new: comparisonResults.newResult.scores.costControl },
                          { key: 'decisionTiming', label: '决策时效', old: comparisonResults.oldResult.scores.decisionTiming, new: comparisonResults.newResult.scores.decisionTiming },
                          { key: 'greekStability', label: '希腊稳定性', old: comparisonResults.oldResult.scores.greekStability, new: comparisonResults.newResult.scores.greekStability },
                        ].map(item => {
                          const diff = item.new - item.old;
                          return (
                            <div key={item.key} className="flex items-center gap-4">
                              <div className="w-24 text-sm">{item.label}</div>
                              <div className="flex-1">
                                <div className="h-6 bg-bloomberg-border/50 rounded overflow-hidden flex">
                                  <div 
                                    className="h-full bg-bloomberg-muted/30"
                                    style={{ width: `${item.old}%` }}
                                  />
                                </div>
                              </div>
                              <div className="w-16 text-right font-mono">{item.old}</div>
                              <div className="text-bloomberg-muted">→</div>
                              <div className="flex-1">
                                <div className="h-6 bg-bloomberg-border/50 rounded overflow-hidden flex">
                                  <div 
                                    className="h-full bg-highlight-blue"
                                    style={{ width: `${item.new}%` }}
                                  />
                                </div>
                              </div>
                              <div className="w-16 text-right font-mono">{item.new}</div>
                              <div className={`w-16 text-right font-mono font-bold ${diff > 0 ? 'text-trader-green' : diff < 0 ? 'text-trader-red' : 'text-bloomberg-muted'}`}>
                                {diff > 0 ? '+' : ''}{diff}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
                  <h3 className="text-xl font-bold mb-4">参数变化影响分析</h3>
                  <div className="space-y-4">
                    {versionComparison.parameterDiffs.map((diff, idx) => (
                      <div key={idx} className="bg-bloomberg-bg/50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${getCategoryColor(diff.category)}`}>
                            {getCategoryLabel(diff.category)}
                          </span>
                          <span className="font-mono text-sm">{diff.path}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-bloomberg-muted mb-1">原值</div>
                            <div className="font-mono">{renderDiffValue(diff.oldValue)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-bloomberg-muted mb-1">新值</div>
                            <div className="font-mono">{renderDiffValue(diff.newValue)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-bloomberg-muted mb-1">影响分析</div>
                            <div className="text-sm">
                              {diff.category === 'margin' && (
                                <span className="text-trader-red">保证金率变化会改变爆仓风险等级</span>
                              )}
                              {diff.category === 'fee' && (
                                <span className="text-highlight-blue">费用变化将影响成本控制评分</span>
                              )}
                              {diff.category === 'position' && (
                                <span className="text-trader-green">头寸调整会改变初始希腊值暴露</span>
                              )}
                              {diff.category === 'market' && (
                                <span className="text-warning-orange">行情变化是训练难度的核心变量</span>
                              )}
                              {diff.category === 'target' && (
                                <span className="text-highlight-yellow">
                                  {diff.path.includes('gamma') 
                                    ? 'Gamma目标区间变化将直接影响风险预警阈值，这是重点监控指标'
                                    : '目标区间变化直接影响评分标准'
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {showImportModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6 w-full max-w-2xl mx-4">
              <h3 className="text-xl font-bold mb-4">导入训练材料</h3>
              <p className="text-sm text-bloomberg-muted mb-4">
                粘贴之前导出的训练材料JSON内容
              </p>
              
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={12}
                className="w-full px-4 py-2 bg-bloomberg-bg border border-bloomberg-border rounded-lg focus:border-highlight-blue focus:outline-none font-mono text-sm mb-4"
                placeholder='{"id": "...", "name": "...", ...}'
              />

              {importError && (
                <div className="text-trader-red text-sm mb-4">{importError}</div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportText('');
                    setImportError('');
                  }}
                  className="px-4 py-2 bg-bloomberg-border hover:bg-bloomberg-border/50 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg transition-colors"
                >
                  确认导入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
