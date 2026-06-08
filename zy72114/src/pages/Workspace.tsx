import { useState } from 'react';
import { Play, Database, RefreshCw, Download, Save, FileText, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { allSamples } from '../data/samples';
import Navbar from '../components/Navbar';
import EngCard from '../components/EngCard';
import SectionHeader from '../components/SectionHeader';
import SensorTable from '../components/SensorTable';
import DeviceParamForm from '../components/DeviceParamForm';
import FieldNotes from '../components/FieldNotes';
import ValidationPanel from '../components/ValidationPanel';
import ConflictPanel from '../components/ConflictPanel';
import ResultPanel from '../components/ResultPanel';

export default function Workspace() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'data' | 'analysis' | 'result'>('data');

  const {
    currentProject,
    sensorRecords,
    deviceParams,
    fieldNotes,
    validationIssues,
    dataConflicts,
    calculationResult,
    isCalculating,
    isDirty,
    loadSampleData,
    addSensorRecord,
    updateSensorRecord,
    removeSensorRecord,
    addDeviceParam,
    updateDeviceParam,
    removeDeviceParam,
    addFieldNote,
    updateFieldNote,
    removeFieldNote,
    resolveConflict,
    runFullAnalysis,
    runCalculation,
    createVersion,
  } = useProjectStore();

  const handleLoadSample = (type: 'normal' | 'dirty' | 'conflict') => {
    loadSampleData(type);
    setActiveTab('data');
  };

  const handleAddRecord = () => {
    addSensorRecord({
      timestamp: new Date().toISOString(),
      angle: null,
      angleUnit: 'deg',
      velocity: null,
      velocityUnit: 'm/s',
      acceleration: null,
      accelerationUnit: 'm/s²',
      direction: '',
      timeInterval: null,
      timeIntervalUnit: 's',
      source: 'manual',
    });
  };

  const handleAddParam = () => {
    addDeviceParam({
      paramName: '新参数',
      value: null,
      unit: 'm',
      description: '',
      category: 'structure',
    });
  };

  const handleAddNote = () => {
    addFieldNote({
      content: '',
      recordedAt: new Date().toISOString(),
      recorder: '训练教练老唐',
      isOriginal: fieldNotes.length === 0,
      isSupplementary: fieldNotes.length > 0,
    });
  };

  const handleSaveVersion = () => {
    const desc = window.prompt('请输入版本描述：', isDirty ? '手动修改了数据' : '保存当前状态');
    if (desc) {
      createVersion(desc, '训练教练老唐');
      alert('版本已保存！可以在历史对比中查看。');
    }
  };

  const handleGenerateReport = () => {
    if (calculationResult) {
      navigate('/report/current');
    } else {
      alert('请先执行计算再生成报告！');
    }
  };

  const hasIssues = validationIssues.length > 0 || dataConflicts.length > 0;
  const unresolvedConflicts = dataConflicts.filter((c) => !c.userDecision).length;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 md:p-6 stagger-fade">
        {!currentProject ? (
          <div className="max-w-3xl mx-auto mt-4">
            <EngCard className="p-6">
              <div className="text-center mb-4">
                <h1 className="text-2xl font-bold text-ink-800 mb-2">校园投石机安全试算</h1>
                <p className="text-ink-600">选择样例数据开始体验，或手动创建新项目</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-ink-700 mb-3">快速加载样例数据：</h3>
                {allSamples.map((sample) => (
                  <button
                    key={sample.type}
                    onClick={() => handleLoadSample(sample.type as 'normal' | 'dirty' | 'conflict')}
                    className="w-full eng-btn text-left flex items-center gap-4 p-4"
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        sample.type === 'normal'
                          ? 'bg-safe-500'
                          : sample.type === 'dirty'
                          ? 'bg-warning-500'
                          : 'bg-danger-500'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{sample.name}</div>
                      <div className="text-sm text-ink-500">{sample.description}</div>
                    </div>
                    <span
                      className={`eng-badge ${
                        sample.type === 'normal'
                          ? 'eng-badge-safe'
                          : sample.type === 'dirty'
                          ? 'eng-badge-warning'
                          : 'eng-badge-danger'
                      }`}
                    >
                      {sample.type === 'normal' ? '干净数据' : sample.type === 'dirty' ? '脏数据' : '有冲突'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="engineering-divider" />

              <div className="text-sm text-ink-500 space-y-2">
                <p>📋 <strong>功能介绍：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>传感器数据导入与设备参数录入</li>
                  <li>自动校验方向符号、单位、时间间隔</li>
                  <li>物理近似计算 + 单位自动换算</li>
                  <li>现场照片与导入数据冲突检测</li>
                  <li>安全阈值提醒 + 业务化处理建议</li>
                  <li>历史版本并排对比 + 差异高亮</li>
                  <li>标准化报告生成</li>
                </ul>
              </div>
            </EngCard>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-ink-800">{currentProject.name}</h2>
                <span className="text-sm text-ink-500 font-mono">{currentProject.batchNumber}</span>
                {isDirty && <span className="eng-badge eng-badge-warning">有未保存变更</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleSaveVersion} className="eng-btn eng-btn-sm flex items-center gap-1">
                  <Save size={16} /> 保存版本
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="eng-btn eng-btn-sm flex items-center gap-1"
                >
                  <History size={16} /> 历史对比
                </button>
                <button
                  onClick={handleGenerateReport}
                  className="eng-btn eng-btn-primary eng-btn-sm flex items-center gap-1"
                  disabled={!calculationResult}
                >
                  <FileText size={16} /> 生成报告
                </button>
              </div>
            </div>

            <div className="flex gap-1 mb-4 border-b border-ink-200 pb-1">
              {[
                { key: 'data', label: '📊 数据录入', icon: Database },
                { key: 'analysis', label: '🔍 校验分析', icon: RefreshCw },
                { key: 'result', label: '📈 计算结果', icon: Play },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-4 py-2 font-medium text-sm transition-all ${
                    activeTab === tab.key
                      ? 'bg-blueprint-600 text-white'
                      : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <tab.icon size={16} />
                    {tab.label}
                    {tab.key === 'analysis' && hasIssues && (
                      <span className="bg-danger-500 text-white text-xs px-1.5 rounded-full">
                        {validationIssues.length + unresolvedConflicts}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {activeTab === 'data' && (
              <div className="space-y-6">
                <EngCard>
                  <div className="p-4">
                    <SectionHeader
                      title="传感器记录"
                      action={
                        <button onClick={handleAddRecord} className="eng-btn eng-btn-sm">
                          + 添加记录
                        </button>
                      }
                    />
                    <SensorTable
                      records={sensorRecords}
                      onEdit={updateSensorRecord}
                      onDelete={removeSensorRecord}
                      highlightIds={validationIssues
                        .filter((i) => i.recordId)
                        .map((i) => i.recordId!)}
                    />
                  </div>
                </EngCard>

                <EngCard>
                  <div className="p-4">
                    <SectionHeader
                      title="设备参数"
                      action={
                        <button onClick={handleAddParam} className="eng-btn eng-btn-sm">
                          + 添加参数
                        </button>
                      }
                    />
                    <DeviceParamForm
                      params={deviceParams}
                      onUpdate={updateDeviceParam}
                      onAdd={handleAddParam}
                      onRemove={removeDeviceParam}
                    />
                  </div>
                </EngCard>

                <EngCard>
                  <div className="p-4">
                    <SectionHeader
                      title="现场备注"
                      action={
                        <button onClick={handleAddNote} className="eng-btn eng-btn-sm">
                          + 补充备注
                        </button>
                      }
                    />
                    <p className="text-sm text-ink-500 mb-4">
                      💡 原始备注原样保留，不会为了整齐清洗掉任何内容
                    </p>
                    <FieldNotes
                      notes={fieldNotes}
                      onUpdate={updateFieldNote}
                      onAdd={handleAddNote}
                      onRemove={removeFieldNote}
                    />
                  </div>
                </EngCard>

                <div className="flex justify-center gap-4 pb-8">
                  <button
                    onClick={() => {
                      setActiveTab('analysis');
                      runFullAnalysis();
                    }}
                    className="eng-btn eng-btn-primary text-lg px-8 py-3 flex items-center gap-2"
                  >
                    <Play size={20} /> 开始安全试算分析
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="grid md:grid-cols-2 gap-6">
                <EngCard>
                  <div className="p-4">
                    <SectionHeader title="数据校验" />
                    <ValidationPanel issues={validationIssues} />
                  </div>
                </EngCard>

                <EngCard>
                  <div className="p-4">
                    <SectionHeader title="冲突检测" />
                    <ConflictPanel conflicts={dataConflicts} onResolve={resolveConflict} />
                  </div>
                </EngCard>

                <div className="md:col-span-2 flex justify-center gap-4 pb-8">
                  <button
                    onClick={() => setActiveTab('data')}
                    className="eng-btn text-lg px-6 py-3"
                  >
                    ← 返回修改数据
                  </button>
                  <button
                    onClick={() => {
                      runCalculation();
                      setActiveTab('result');
                    }}
                    className="eng-btn eng-btn-primary text-lg px-8 py-3 flex items-center gap-2"
                    disabled={isCalculating}
                  >
                    {isCalculating ? (
                      <>
                        <RefreshCw size={20} className="animate-spin" /> 计算中...
                      </>
                    ) : (
                      <>
                        <Play size={20} /> 执行物理计算
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'result' && (
              <div className="space-y-6">
                <ResultPanel result={calculationResult} isCalculating={isCalculating} />

                {calculationResult && (
                  <EngCard>
                    <div className="p-4">
                      <SectionHeader title="单位换算对照表" />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-ink-200">
                              <th className="text-left py-2 px-3 font-semibold">物理量</th>
                              <th className="text-left py-2 px-3 font-semibold">公制 (SI)</th>
                              <th className="text-left py-2 px-3 font-semibold">英制</th>
                              <th className="text-left py-2 px-3 font-semibold">其他单位</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono">
                            <tr className="border-b border-ink-100">
                              <td className="py-2 px-3 font-medium">射程</td>
                              <td className="py-2 px-3">{calculationResult.range.toFixed(2)} m</td>
                              <td className="py-2 px-3">
                                {(calculationResult.range * 3.2808).toFixed(2)} ft
                              </td>
                              <td className="py-2 px-3">
                                {(calculationResult.range * 100).toFixed(0)} cm
                              </td>
                            </tr>
                            <tr className="border-b border-ink-100">
                              <td className="py-2 px-3 font-medium">最大高度</td>
                              <td className="py-2 px-3">{calculationResult.maxHeight.toFixed(2)} m</td>
                              <td className="py-2 px-3">
                                {(calculationResult.maxHeight * 3.2808).toFixed(2)} ft
                              </td>
                              <td className="py-2 px-3">-</td>
                            </tr>
                            <tr className="border-b border-ink-100">
                              <td className="py-2 px-3 font-medium">冲击能量</td>
                              <td className="py-2 px-3">{calculationResult.impactEnergy.toFixed(2)} J</td>
                              <td className="py-2 px-3">-</td>
                              <td className="py-2 px-3">
                                {(calculationResult.impactEnergy * 0.239).toFixed(2)} cal
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-medium">飞行时间</td>
                              <td className="py-2 px-3">{calculationResult.flightTime.toFixed(3)} s</td>
                              <td className="py-2 px-3">-</td>
                              <td className="py-2 px-3">
                                {(calculationResult.flightTime * 1000).toFixed(0)} ms
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </EngCard>
                )}

                <div className="flex justify-center gap-4 pb-8 flex-wrap">
                  <button onClick={() => setActiveTab('analysis')} className="eng-btn text-lg px-6 py-3">
                    ← 返回分析
                  </button>
                  <button onClick={handleSaveVersion} className="eng-btn eng-btn-sm flex items-center gap-1">
                    <Save size={16} /> 保存此版本
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    className="eng-btn eng-btn-primary text-lg px-8 py-3 flex items-center gap-2"
                  >
                    <Download size={20} /> 生成安全报告
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
