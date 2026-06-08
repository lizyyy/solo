import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Scatter,
  ComposedChart, Bar, Cell
} from 'recharts';
import { 
  AlertTriangle, CheckCircle, XCircle, Settings, 
  FileDown, Edit3, Save, ChevronDown, ChevronUp,
  Info, BarChart3, Table as TableIcon
} from 'lucide-react';
import { useAnalysisStore, calculateStatistics } from '../store/analysisStore';
import { calculateMovingAverage } from '../utils/anomalyDetection';
import { AnomalyMethod } from '../types';

const AnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, updateAnomalyConfig, addSupplementaryNote } = useAnalysisStore();
  const [showConfig, setShowConfig] = useState(true);
  const [showSupplementary, setShowSupplementary] = useState(false);
  const [supplementaryNote, setSupplementaryNote] = useState('');
  const [showDataTable, setShowDataTable] = useState(true);

  const dataPoints = session?.dataPoints ?? [];
  const stats = useMemo(() => calculateStatistics(dataPoints), [dataPoints]);
  const movingAvg = useMemo(() => calculateMovingAverage(dataPoints, 3), [dataPoints]);

  if (!session || session.dataPoints.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">暂无数据</h2>
        <p className="text-slate-600 mb-6">请先导入数据后再进行分析</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          返回导入页面
        </button>
      </div>
    );
  }

  const chartData = session.dataPoints.map((point, index) => ({
    ...point,
    movingAvg: movingAvg[index]?.value || 0,
    displayTime: point.timeLabel.split(' ').pop() || point.timeLabel
  }));

  const handleMethodChange = (method: AnomalyMethod) => {
    updateAnomalyConfig({ method });
  };

  const handleSaveSupplementary = () => {
    if (supplementaryNote.trim()) {
      addSupplementaryNote(supplementaryNote);
      setShowSupplementary(false);
    }
  };

  const formatDateTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">📊 {session.name}</h1>
          <p className="text-sm text-slate-500">
            数据来源：{session.metadata.source} | 
            处理人：{session.metadata.processor} | 
            处理时间：{formatDateTime(session.metadata.processedAt)}
            {session.hasSupplementaryNote && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">有补录备注</span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/export')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FileDown className="w-4 h-4" />
          导出报告
        </button>
      </div>

      {session.metadata.remarks && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>📝 备注：</strong>{session.metadata.remarks}
          </p>
        </div>
      )}

      {session.hasSupplementaryNote && session.metadata.supplementaryNote && (
        <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>📌 补录备注：</strong>{session.metadata.supplementaryNote}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">数据总数</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.totalCount}</p>
        </div>
        <div className={`bg-white rounded-xl p-4 border shadow-sm ${stats.anomalyCount > 0 ? 'border-red-300' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${stats.anomalyCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <span className="text-sm text-slate-500">异常数量</span>
          </div>
          <p className={`text-2xl font-bold ${stats.anomalyCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {stats.anomalyCount}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">最大值</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.maxValue.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">平均值</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.avgValue.toFixed(0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              离心力趋势图
              <span className="text-xs font-normal text-slate-500 ml-2">
                （红点为异常点，虚线为移动平均线）
              </span>
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="displayTime" 
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    label={{ value: '离心力 (N)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                            <p className="font-medium text-slate-800">{data.timeLabel}</p>
                            <p className={`text-sm ${data.isAnomaly ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                              离心力：{data.centrifugalForce} N
                            </p>
                            {data.isAnomaly && (
                              <p className="text-xs text-red-500 mt-1">{data.anomalyReason}</p>
                            )}
                            {data.remark && (
                              <p className="text-xs text-slate-500 mt-1">备注：{data.remark}</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="centrifugalForce" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    name="原始数据"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="movingAvg" 
                    stroke="#64748b" 
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    name="移动平均"
                  />
                  <Scatter dataKey="centrifugalForce" name="异常点">
                    {chartData.map((entry, index) => (
                      entry.isAnomaly ? (
                        <Cell key={index} fill="#ef4444" stroke="#ef4444" strokeWidth={2} r={6} />
                      ) : (
                        <Cell key={index} fill="transparent" />
                      )
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-800">
                <strong>⚠️ 重要说明：</strong>
                异常检测基于<strong>原始数据点</strong>进行，不做任何平均或平滑处理。
                移动平均线仅用于趋势参考，不影响异常判定结果。
                {stats.maxAnomalyValue && (
                  <span className="block mt-1">
                    最大异常值：<strong>{stats.maxAnomalyValue.toFixed(0)} N</strong>，
                    超出平均值 <strong>{((stats.maxAnomalyValue / stats.avgValue - 1) * 100).toFixed(0)}%</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setShowDataTable(!showDataTable)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-t-xl"
            >
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-blue-600" />
                数据明细
              </h2>
              {showDataTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showDataTable && (
              <div className="px-6 pb-6">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-600">时间</th>
                        <th className="px-3 py-2 text-left text-slate-600">离心力(N)</th>
                        <th className="px-3 py-2 text-left text-slate-600">方向</th>
                        <th className="px-3 py-2 text-left text-slate-600">状态</th>
                        <th className="px-3 py-2 text-left text-slate-600">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.dataPoints.map((point) => (
                        <tr 
                          key={point.id} 
                          className={`border-t border-slate-100 ${point.isAnomaly ? 'bg-red-50' : ''}`}
                        >
                          <td className="px-3 py-2 text-slate-700">{point.timeLabel}</td>
                          <td className={`px-3 py-2 font-medium ${point.isAnomaly ? 'text-red-600' : 'text-slate-800'}`}>
                            {point.centrifugalForce}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {point.direction === 'positive' ? '正' : point.direction === 'negative' ? '负' : '未知'}
                          </td>
                          <td className="px-3 py-2">
                            {point.isAnomaly ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">异常</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">正常</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{point.remark || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-t-xl"
            >
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                检测配置
              </h2>
              {showConfig ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showConfig && (
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">检测方法</label>
                  <div className="space-y-2">
                    {[
                      { value: 'iqr', label: 'IQR 四分位距法', desc: '适合大多数情况' },
                      { value: 'zscore', label: 'Z-Score 法', desc: '基于标准差' },
                      { value: 'threshold', label: '手动阈值', desc: '自定义范围' }
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                          session.anomalyConfig.method === opt.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="method"
                          value={opt.value}
                          checked={session.anomalyConfig.method === opt.value}
                          onChange={() => handleMethodChange(opt.value as AnomalyMethod)}
                          className="mr-3"
                        />
                        <div>
                          <p className="font-medium text-slate-800">{opt.label}</p>
                          <p className="text-xs text-slate-500">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {session.anomalyConfig.method === 'iqr' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      IQR 乘数: {session.anomalyConfig.iqrMultiplier}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={session.anomalyConfig.iqrMultiplier}
                      onChange={(e) => updateAnomalyConfig({ iqrMultiplier: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">值越大，检测越宽松</p>
                  </div>
                )}

                {session.anomalyConfig.method === 'zscore' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Z-Score 阈值: {session.anomalyConfig.zscoreThreshold}
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="5"
                      step="0.1"
                      value={session.anomalyConfig.zscoreThreshold}
                      onChange={(e) => updateAnomalyConfig({ zscoreThreshold: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">值越大，检测越宽松</p>
                  </div>
                )}

                {session.anomalyConfig.method === 'threshold' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">下限 (N)</label>
                      <input
                        type="number"
                        value={session.anomalyConfig.manualThreshold?.min || 0}
                        onChange={(e) => updateAnomalyConfig({
                          manualThreshold: {
                            min: parseFloat(e.target.value) || 0,
                            max: session.anomalyConfig.manualThreshold?.max || 5000
                          }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">上限 (N)</label>
                      <input
                        type="number"
                        value={session.anomalyConfig.manualThreshold?.max || 5000}
                        onChange={(e) => updateAnomalyConfig({
                          manualThreshold: {
                            min: session.anomalyConfig.manualThreshold?.min || 0,
                            max: parseFloat(e.target.value) || 5000
                          }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              {session.validation.isValid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              数据校验结果
            </h3>

            {session.validation.errors.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-red-700 mb-2">错误 ({session.validation.errors.length})</p>
                <div className="space-y-2">
                  {session.validation.errors.slice(0, 3).map((error, i) => (
                    <div key={i} className="p-2 bg-red-50 rounded text-xs">
                      <p className="text-red-700 font-medium">{error.message}</p>
                      <p className="text-red-500 mt-1">建议：{error.suggestion}</p>
                    </div>
                  ))}
                  {session.validation.errors.length > 3 && (
                    <p className="text-xs text-red-500">还有 {session.validation.errors.length - 3} 个错误...</p>
                  )}
                </div>
              </div>
            )}

            {session.validation.warnings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-700 mb-2">警告 ({session.validation.warnings.length})</p>
                <div className="space-y-2">
                  {session.validation.warnings.slice(0, 3).map((warning, i) => (
                    <div key={i} className="p-2 bg-amber-50 rounded text-xs">
                      <p className="text-amber-700">{warning.message}</p>
                    </div>
                  ))}
                  {session.validation.warnings.length > 3 && (
                    <p className="text-xs text-amber-500">还有 {session.validation.warnings.length - 3} 个警告...</p>
                  )}
                </div>
              </div>
            )}

            {session.validation.isValid && session.validation.warnings.length === 0 && (
              <p className="text-sm text-green-600">✓ 数据校验通过，未发现问题</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            {!session.hasSupplementaryNote ? (
              <>
                {!showSupplementary ? (
                  <button
                    onClick={() => setShowSupplementary(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    添加补录备注
                  </button>
                ) : (
                  <div className="space-y-3">
                    <h3 className="font-medium text-slate-800">补录备注</h3>
                    <textarea
                      value={supplementaryNote}
                      onChange={(e) => setSupplementaryNote(e.target.value)}
                      rows={3}
                      placeholder="记录临时发现的情况、补充说明等..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSupplementary}
                        disabled={!supplementaryNote.trim()}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setShowSupplementary(false);
                          setSupplementaryNote('');
                        }}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div>
                <h3 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  已添加补录备注
                </h3>
                <p className="text-sm text-slate-600 p-3 bg-amber-50 rounded-lg">
                  {session.metadata.supplementaryNote}
                </p>
                <button
                  onClick={() => {
                    setSupplementaryNote(session.metadata.supplementaryNote || '');
                    setShowSupplementary(true);
                  }}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  修改备注
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
