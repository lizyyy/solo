import React, { useState, useEffect, useCallback } from 'react';
import { Play, Upload, Download, RotateCcw, Plus, Trash2, FileJson, Database, Table, Search, Settings } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { indexApi } from '../services/api';
import { ExperimentConfig, TableSchema, IndexDefinition, QuerySample, QueryCondition } from '../types';

const ConfigPanel: React.FC = () => {
  const {
    currentExperiment,
    setCurrentExperiment,
    setIsLoading,
    setError,
    setActiveTab,
    setCurrentResult,
  } = useAppStore();

  const [config, setConfig] = useState<ExperimentConfig | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [activeSection, setActiveSection] = useState<'basic' | 'tables' | 'indexes' | 'queries'>('basic');

  useEffect(() => {
    if (currentExperiment) {
      setConfig({ ...currentExperiment });
    } else {
      loadDefaultTemplate();
    }
  }, []);

  const loadDefaultTemplate = async () => {
    try {
      setIsLoading(true);
      const template = await indexApi.getDefaultTemplate();
      setConfig(template);
      setCurrentExperiment(template);
    } catch (err) {
      setError('无法加载默认模板，请检查后端服务是否启动');
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = useCallback((updates: Partial<ExperimentConfig>) => {
    setConfig((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setConfig(parsed);
      setCurrentExperiment(parsed);
      setShowJsonEditor(false);
      setJsonInput('');
    } catch (err) {
      setError('JSON 格式错误，请检查输入');
    }
  };

  const handleExportJson = () => {
    if (!config) return;
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `experiment-config-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRunExperiment = async () => {
    if (!config) return;

    try {
      setIsLoading(true);
      setError(null);

      setConfig({ ...config, id: `exp_${Date.now()}` });
      const experimentId = `exp_${Date.now()}`;
      const updatedConfig = { ...config, id: experimentId };
      setConfig(updatedConfig);
      setCurrentExperiment(updatedConfig);

      const createResponse = await indexApi.createExperiment(updatedConfig);
      console.log('Experiment created:', createResponse);

      const result = await indexApi.runExperiment(experimentId);
      setCurrentResult(result);
      setActiveTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : '运行实验失败');
    } finally {
      setIsLoading(false);
    }
  };

  const addTable = () => {
    if (!config) return;
    const newTable: TableSchema = {
      name: `table_${config.tables.length + 1}`,
      columns: [
        { name: 'id', type: 'number', nullable: false },
        { name: 'name', type: 'string', nullable: true },
      ],
      primaryKey: 'id',
    };
    updateConfig({ tables: [...config.tables, newTable] });
  };

  const removeTable = (index: number) => {
    if (!config) return;
    const newTables = config.tables.filter((_, i) => i !== index);
    updateConfig({ tables: newTables });
  };

  const addQuery = () => {
    if (!config) return;
    const newQuery: QuerySample = {
      id: `q_${Date.now()}`,
      name: `新查询 ${config.queries.length + 1}`,
      type: 'equality',
      table: config.tables[0]?.name || '',
      conditions: [{ column: 'id', operator: '=', value: 1 }],
    };
    updateConfig({ queries: [...config.queries, newQuery] });
  };

  const removeQuery = (index: number) => {
    if (!config) return;
    const newQueries = config.queries.filter((_, i) => i !== index);
    updateConfig({ queries: newQueries });
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center animate-pulse">
            <Database className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'basic', label: '基本设置', icon: Settings },
    { id: 'tables', label: '表结构', icon: Table },
    { id: 'indexes', label: '索引定义', icon: Database },
    { id: 'queries', label: '查询样本', icon: Search },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">实验配置</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowJsonEditor(!showJsonEditor)}
                className="btn btn-secondary"
              >
                <FileJson className="w-4 h-4 mr-2" />
                {showJsonEditor ? '关闭 JSON' : 'JSON 编辑器'}
              </button>
              <button
                onClick={handleExportJson}
                className="btn btn-secondary"
              >
                <Download className="w-4 h-4 mr-2" />
                导出
              </button>
              <button
                onClick={loadDefaultTemplate}
                className="btn btn-secondary"
                title="重置为默认模板"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {showJsonEditor && (
          <div className="card-body border-b border-gray-100">
            <div className="space-y-3">
              <label className="label">导入配置 JSON</label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="粘贴 JSON 配置..."
                className="input font-mono text-xs h-40 resize-none"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setJsonInput(JSON.stringify(config, null, 2));
                  }}
                  className="btn btn-secondary"
                >
                  从当前配置填充
                </button>
                <button
                  onClick={handleImportJson}
                  className="btn btn-primary"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  导入
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b border-gray-200">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'text-primary-600 border-primary-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>

        <div className="card-body">
          {activeSection === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="label">实验名称</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => updateConfig({ name: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">随机种子</label>
                  <input
                    type="number"
                    value={config.seed}
                    onChange={(e) => updateConfig({ seed: parseInt(e.target.value) || 42 })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="label">数据规模（行数）</label>
                  <input
                    type="number"
                    value={config.dataSize}
                    onChange={(e) => updateConfig({ dataSize: parseInt(e.target.value) || 100 })}
                    className="input"
                    min="1"
                    max="10000"
                  />
                </div>
                <div>
                  <label className="label">B+ 树阶数</label>
                  <input
                    type="number"
                    value={config.bplusOrder}
                    onChange={(e) => updateConfig({ bplusOrder: parseInt(e.target.value) || 5 })}
                    className="input"
                    min="3"
                    max="10"
                  />
                </div>
                <div>
                  <label className="label">哈希初始桶数</label>
                  <input
                    type="number"
                    value={config.hashInitialBuckets}
                    onChange={(e) => updateConfig({ hashInitialBuckets: parseInt(e.target.value) || 16 })}
                    className="input"
                    min="4"
                    max="256"
                  />
                </div>
              </div>

              <div>
                <label className="label">哈希负载因子: {config.hashLoadFactor}</label>
                <input
                  type="range"
                  value={config.hashLoadFactor}
                  onChange={(e) => updateConfig({ hashLoadFactor: parseFloat(e.target.value) })}
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeSection === 'tables' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">定义实验使用的表结构</p>
                <button onClick={addTable} className="btn btn-secondary">
                  <Plus className="w-4 h-4 mr-2" />
                  添加表
                </button>
              </div>

              <div className="space-y-4">
                {config.tables.map((table, tableIndex) => (
                  <div key={tableIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <Table className="w-5 h-5 text-primary-500" />
                        <input
                          type="text"
                          value={table.name}
                          onChange={(e) => {
                            const newTables = [...config.tables];
                            newTables[tableIndex] = { ...table, name: e.target.value };
                            updateConfig({ tables: newTables });
                          }}
                          className="input !w-48"
                        />
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-500">主键:</label>
                          <select
                            value={table.primaryKey}
                            onChange={(e) => {
                              const newTables = [...config.tables];
                              newTables[tableIndex] = { ...table, primaryKey: e.target.value };
                              updateConfig({ tables: newTables });
                            }}
                            className="input !w-32"
                          >
                            {table.columns.map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => removeTable(tableIndex)}
                        className="text-red-400 hover:text-red-600"
                        disabled={config.tables.length <= 1}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left font-medium text-gray-600">列名</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600">类型</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600">可空</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {table.columns.map((col, colIndex) => (
                            <tr key={colIndex}>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={col.name}
                                  onChange={(e) => {
                                    const newTables = [...config.tables];
                                    const newColumns = [...table.columns];
                                    newColumns[colIndex] = { ...col, name: e.target.value };
                                    newTables[tableIndex] = { ...table, columns: newColumns };
                                    updateConfig({ tables: newTables });
                                  }}
                                  className="input !w-32 !py-1"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={col.type}
                                  onChange={(e) => {
                                    const newTables = [...config.tables];
                                    const newColumns = [...table.columns];
                                    newColumns[colIndex] = { ...col, type: e.target.value as any };
                                    newTables[tableIndex] = { ...table, columns: newColumns };
                                    updateConfig({ tables: newTables });
                                  }}
                                  className="input !w-24 !py-1"
                                >
                                  <option value="number">number</option>
                                  <option value="string">string</option>
                                  <option value="boolean">boolean</option>
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={col.nullable || false}
                                    onChange={(e) => {
                                      const newTables = [...config.tables];
                                      const newColumns = [...table.columns];
                                      newColumns[colIndex] = { ...col, nullable: e.target.checked };
                                      newTables[tableIndex] = { ...table, columns: newColumns };
                                      updateConfig({ tables: newTables });
                                    }}
                                    className="w-4 h-4 text-primary-600 rounded"
                                  />
                                </label>
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => {
                                    const newTables = [...config.tables];
                                    const newColumns = table.columns.filter((_, i) => i !== colIndex);
                                    newTables[tableIndex] = { ...table, columns: newColumns };
                                    updateConfig({ tables: newTables });
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                  disabled={table.columns.length <= 1}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={() => {
                        const newTables = [...config.tables];
                        const newColumns = [...table.columns, {
                          name: `column_${table.columns.length + 1}`,
                          type: 'string' as const,
                          nullable: true,
                        }];
                        newTables[tableIndex] = { ...table, columns: newColumns };
                        updateConfig({ tables: newTables });
                      }}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>添加列</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'indexes' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                实验将自动对比 B+ 树索引和哈希索引。此处定义用于索引的列（用于生成测试数据和查询）。
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">💡 说明</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>B+ 树索引</strong>：支持等值查询、范围查询、前缀查询</li>
                  <li>• <strong>哈希索引</strong>：仅支持等值查询，范围查询需要全表扫描</li>
                  <li>• 实验运行时，系统将在相同数据上同时创建两种索引进行对比</li>
                </ul>
              </div>

              {config.tables.map((table, tableIndex) => (
                <div key={tableIndex} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Table className="w-4 h-4 mr-2 text-primary-500" />
                    {table.name}
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">索引列（用于生成测试数据的主键）</label>
                      <select
                        value={config.indexes[0]?.columns[0] || table.primaryKey}
                        onChange={(e) => {
                          const newIndexes: IndexDefinition[] = [{
                            name: 'idx_main',
                            type: 'bplus',
                            table: table.name,
                            columns: [e.target.value],
                            isUnique: true,
                            order: 'asc',
                          }];
                          updateConfig({ indexes: newIndexes });
                        }}
                        className="input"
                      >
                        {table.columns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'queries' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">定义要对比的查询样本</p>
                <button onClick={addQuery} className="btn btn-secondary">
                  <Plus className="w-4 h-4 mr-2" />
                  添加查询
                </button>
              </div>

              <div className="space-y-4">
                {config.queries.map((query, queryIndex) => (
                  <div key={queryIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <input
                          type="text"
                          value={query.name}
                          onChange={(e) => {
                            const newQueries = [...config.queries];
                            newQueries[queryIndex] = { ...query, name: e.target.value };
                            updateConfig({ queries: newQueries });
                          }}
                          className="input !w-64"
                        />
                        <select
                          value={query.type}
                          onChange={(e) => {
                            const newQueries = [...config.queries];
                            newQueries[queryIndex] = { ...query, type: e.target.value as any };
                            updateConfig({ queries: newQueries });
                          }}
                          className="input !w-36"
                        >
                          <option value="equality">等值查询</option>
                          <option value="range">范围查询</option>
                          <option value="prefix">前缀查询</option>
                          <option value="insert">插入操作</option>
                          <option value="delete">删除操作</option>
                        </select>
                      </div>
                      <button
                        onClick={() => removeQuery(queryIndex)}
                        className="text-red-400 hover:text-red-600"
                        disabled={config.queries.length <= 1}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {query.type !== 'insert' && (
                        <>
                          <label className="label">查询条件</label>
                          {query.conditions.map((condition, condIndex) => (
                            <div key={condIndex} className="flex items-center space-x-3">
                              <select
                                value={condition.column}
                                onChange={(e) => {
                                  const newQueries = [...config.queries];
                                  const newConditions = [...query.conditions];
                                  newConditions[condIndex] = { ...condition, column: e.target.value };
                                  newQueries[queryIndex] = { ...query, conditions: newConditions };
                                  updateConfig({ queries: newQueries });
                                }}
                                className="input !w-32"
                              >
                                {config.tables[0]?.columns.map((col) => (
                                  <option key={col.name} value={col.name}>
                                    {col.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={condition.operator}
                                onChange={(e) => {
                                  const newQueries = [...config.queries];
                                  const newConditions = [...query.conditions];
                                  newConditions[condIndex] = { ...condition, operator: e.target.value as any };
                                  newQueries[queryIndex] = { ...query, conditions: newConditions };
                                  updateConfig({ queries: newQueries });
                                }}
                                className="input !w-24"
                              >
                                <option value="=">=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                                <option value="LIKE">LIKE</option>
                              </select>
                              <input
                                type="text"
                                value={String(condition.value)}
                                onChange={(e) => {
                                  const newQueries = [...config.queries];
                                  const newConditions = [...query.conditions];
                                  let val: any = e.target.value;
                                  if (!isNaN(Number(val))) val = Number(val);
                                  newConditions[condIndex] = { ...condition, value: val };
                                  newQueries[queryIndex] = { ...query, conditions: newConditions };
                                  updateConfig({ queries: newQueries });
                                }}
                                className="input !w-32"
                                placeholder="值"
                              />
                              {query.conditions.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newQueries = [...config.queries];
                                    const newConditions = query.conditions.filter((_, i) => i !== condIndex);
                                    newQueries[queryIndex] = { ...query, conditions: newConditions };
                                    updateConfig({ queries: newQueries });
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                          {query.type === 'range' && query.conditions.length < 2 && (
                            <button
                              onClick={() => {
                                const newQueries = [...config.queries];
                                const newConditions = [...query.conditions, {
                                  column: query.conditions[0]?.column || 'id',
                                  operator: '<=' as const,
                                  value: 100,
                                }];
                                newQueries[queryIndex] = { ...query, conditions: newConditions };
                                updateConfig({ queries: newQueries });
                              }}
                              className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                            >
                              <Plus className="w-4 h-4" />
                              <span>添加边界条件（范围查询建议 2 个条件）</span>
                            </button>
                          )}
                        </>
                      )}

                      {query.type === 'insert' && (
                        <div>
                          <label className="label">插入数据 (JSON)</label>
                          <textarea
                            value={JSON.stringify(query.values || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const newQueries = [...config.queries];
                                newQueries[queryIndex] = { ...query, values: JSON.parse(e.target.value) };
                                updateConfig({ queries: newQueries });
                              } catch {}
                            }}
                            className="input font-mono text-xs h-24 resize-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="label">描述</label>
                        <input
                          type="text"
                          value={query.description || ''}
                          onChange={(e) => {
                            const newQueries = [...config.queries];
                            newQueries[queryIndex] = { ...query, description: e.target.value };
                            updateConfig({ queries: newQueries });
                          }}
                          className="input"
                          placeholder="这个查询测试什么场景..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <span className="font-medium">{config.tables.length}</span> 个表 · 
            <span className="font-medium ml-2">{config.queries.length}</span> 个查询 · 
            <span className="font-medium ml-2">{config.dataSize}</span> 条数据
          </div>
          <button
            onClick={handleRunExperiment}
            className="btn btn-success text-base px-8 py-2.5"
          >
            <Play className="w-5 h-5 mr-2" />
            运行实验
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
