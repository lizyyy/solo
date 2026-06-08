import { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './store/AppContext';
import { ParameterTable } from './components/ParameterTable/ParameterTable';
import { ComparisonList } from './components/ComparisonList/ComparisonList';
import { GraphVisualization } from './components/Visualization/GraphVisualization';
import { HistoryDiffModal } from './components/HistoryDiff/HistoryDiffModal';
import { WorkflowProgress } from './components/Workflow/WorkflowProgress';
import { ReviewPanel } from './components/Review/ReviewPanel';
import { ReportGenerator } from './components/Report/ReportGenerator';
import {
  Route, MapPin, List, FileText, GitCompare,
  Play, FastForward, CheckCircle2, X as XIcon, AlertTriangle, Info, Check,
} from 'lucide-react';
import type { DisplayMode } from './types';
import { buildRecordsFromRawData } from './utils/dataUtils';
import type { RawImportItem } from './utils/dataUtils';

type TabType = 'parameters' | 'comparison' | 'visualization' | 'report';

const FLOW_SAMPLE: RawImportItem[] = [
  { sourceNode: 'A', targetNode: 'H', numerator: 25, denominator: 20, edgeWeight: 1.25, remark: '经E到H的主路径' },
  { sourceNode: 'A', targetNode: 'F', numerator: 18, denominator: 15, edgeWeight: 1.20, remark: '常规通勤路线' },
  { sourceNode: 'B', targetNode: 'G', numerator: 30, denominator: 0, edgeWeight: 0, remark: '早高峰时段临时封路' },
  { sourceNode: 'C', targetNode: 'D', numerator: 12, denominator: 10, edgeWeight: 1.20, remark: '跨区绕行方案' },
  { sourceNode: 'D', targetNode: 'F', numerator: 22, denominator: 18, edgeWeight: 1.22, remark: '避开拥堵路段' },
  { sourceNode: 'E', targetNode: 'A', numerator: 15, denominator: 12, edgeWeight: 1.25, remark: '返程路线对比' },
  { sourceNode: 'F', targetNode: 'D', numerator: 28, denominator: 0, edgeWeight: 0, remark: '晚高峰流量异常' },
  { sourceNode: 'G', targetNode: 'B', numerator: 35, denominator: 25, edgeWeight: 1.40, remark: '周末绕行方案' },
  { sourceNode: 'H', targetNode: 'A', numerator: 40, denominator: 30, edgeWeight: 1.33, remark: '夜间备选路线' },
  { sourceNode: 'B', targetNode: 'F', numerator: 20, denominator: 16, edgeWeight: 1.25, remark: '物流配送优化路线' },
];

function AppContent() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabType>('parameters');
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecordId, setHistoryRecordId] = useState<string | null>(null);
  const [historyFromVersion, setHistoryFromVersion] = useState<number>(1);
  const [historyToVersion, setHistoryToVersion] = useState<number>(1);
  const [flowRunning, setFlowRunning] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  const [hideMsg, setHideMsg] = useState<number | null>(null);

  const flowSteps = [
    { name: '① 首次导入（10条样例）', fn: runFlowStep1 },
    { name: '② 运行绕行比较', fn: runFlowStep2 },
    { name: '③ 重复导入同一批（验证去重不翻倍）', fn: runFlowStep3 },
    { name: '④ 阿岚补看手算反例（F→D分母为0）', fn: runFlowStep4 },
    { name: '⑤ 阿岚修改备注（B→G更新说明）', fn: runFlowStep5 },
    { name: '⑥ 数据复核人审批', fn: runFlowStep6 },
    { name: '⑦ 课堂演示结果更新（生成说明）', fn: runFlowStep7 },
  ];

  function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function runFlowStep1() {
    dispatch({ type: 'RESET_ALL_DATA' });
    await sleep(150);
    const records = buildRecordsFromRawData(FLOW_SAMPLE, 'flow-demo-batch');
    dispatch({ type: 'IMPORT_PARAMETER_RECORDS', payload: records });
    dispatch({ type: 'SET_WORKFLOW_STAGE', payload: 'initial_import' });
    dispatch({ type: 'SET_FLOW_MESSAGE', payload: { text: '【①/⑦ 首次导入】已导入10条记录，其中2条分母为0（B→G、F→D）。注意：分母为0显示为空字符串，留给数据复核人', type: 'success' } });
    setActiveTab('parameters');
  }

  async function runFlowStep2() {
    dispatch({ type: 'RUN_COMPARISON' });
    dispatch({ type: 'ADVANCE_WORKFLOW_STAGE' });
    dispatch({ type: 'SET_FLOW_MESSAGE', payload: { text: '【②/⑦ 运行比较】Dijkstra最短路计算完成，绕行比较结果已生成。可切换到「绕行比较结果」查看为什么留下、缺什么材料、下一步找谁', type: 'success' } });
    await sleep(200);
    dispatch({ type: 'RECALCULATE_EXPLANATIONS' });
    setActiveTab('comparison');
  }

  async function runFlowStep3() {
    const dupRecords = buildRecordsFromRawData(FLOW_SAMPLE, 'flow-demo-batch');
    dispatch({ type: 'IMPORT_PARAMETER_RECORDS', payload: dupRecords });
    await sleep(200);
    dispatch({ type: 'SET_FLOW_MESSAGE', payload: { text: '【③/⑦ 重复导入】同一批数据再次导入：基于importHash去重生效，重复10条全部被哈希匹配过滤，数量不会翻倍 ✓（查看上方导入统计卡确认）', type: 'success' } });
    setActiveTab('parameters');
  }

  async function runFlowStep4() {
    dispatch({ type: 'FLOW_STEP4_ADD_COUNTEREXAMPLE' });
    dispatch({ type: 'SET_FLOW_MESSAGE', payload: { text: '【④/⑦ 补反例】运营规划阿岚已为分母为0的记录补充手算反例，版本号已+1。右侧复核面板可查看手算反例内容', type: 'info' } });
    dispatch({ type: 'ADVANCE_WORKFLOW_STAGE' });
    setActiveTab('parameters');
  }

  async function runFlowStep5() {
    dispatch({ type: 'FLOW_STEP5_UPDATE_REMARK' });
    dispatch({ type: 'SET_FLOW_MESSAGE', payload: { text: '【⑤/⑦ 改备注】阿岚更新B→G备注：历史版本号已+1。点击该行左侧「历史」按钮可查看改前原备注、改后备注、处理原因、更新时间四项', type: 'info' } });
    setActiveTab('parameters');
  }

  async function runFlowStep6() {
    dispatch({ type: 'FLOW_STEP6_APPROVE_ALL' });
    dispatch({ type: 'RECALCULATE_EXPLANATIONS' });
    dispatch({ type: 'SET_FLOW_MESSAGE', payload: { text: '【⑥/⑦ 复核审批】数据复核人已批量审批：非分母0的标记为演示就绪；分母为0的保持异常状态留给复核（不会自动归为正常）', type: 'success' } });
  }

  async function runFlowStep7() {
    dispatch({ type: 'ADVANCE_WORKFLOW_STAGE' });
    dispatch({ type: 'FLOW_STEP7_SYNC_NOTES' });
    dispatch({ type: 'SET_FLOW_MESSAGE', payload: { text: '【⑦/⑦ 演示更新】课堂演示说明已生成并同步：包含为什么被留下、还缺什么材料、下一步找数据复核人还是找阿岚', type: 'success' } });
    setActiveTab('report');
  }

  const runFullFlow = async () => {
    if (flowRunning) return;
    setFlowRunning(true);
    for (let i = 0; i < flowSteps.length; i++) {
      setFlowStep(i + 1);
      try {
        await flowSteps[i].fn();
      } catch (e) { console.error(e); }
      await sleep(900);
    }
    setFlowRunning(false);
    setFlowStep(flowSteps.length);
    setTimeout(() => setFlowStep(0), 4000);
  };

  const handleSelectRecord = (recordId: string) => {
    dispatch({ type: 'SELECT_RECORD', payload: recordId });
  };

  const handleSelectResult = (resultId: string) => {
    dispatch({ type: 'SELECT_RESULT', payload: resultId });
  };

  const handleJumpToRecord = (recordId: string) => {
    setActiveTab('parameters');
    dispatch({ type: 'SELECT_RECORD', payload: recordId });
    dispatch({ type: 'SET_FLOW_MESSAGE', payload: { text: '已跳转回参数调试表并定位该记录，右侧复核面板可查看/补充手算反例', type: 'info' } });
  };

  const handleShowHistory = (recordId: string, fromVersion: number, toVersion: number) => {
    setHistoryRecordId(recordId);
    setHistoryFromVersion(fromVersion);
    setHistoryToVersion(toVersion);
    setShowHistory(true);
  };

  const handleCloseHistory = () => {
    setShowHistory(false);
    setHistoryRecordId(null);
    dispatch({ type: 'HIDE_HISTORY_DIFF' });
  };

  const handleModeChange = (mode: DisplayMode) => {
    dispatch({ type: 'SET_DISPLAY_MODE', payload: mode });
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'parameters', label: '参数调试表', icon: <List className="w-4 h-4" /> },
    { id: 'comparison', label: '绕行比较结果', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'visualization', label: '可视化展示', icon: <MapPin className="w-4 h-4" /> },
    { id: 'report', label: '人性化报告', icon: <FileText className="w-4 h-4" /> },
  ];

  const flowMsg = state.flowMessage;

  useEffect(() => {
    if (flowMsg && hideMsg !== flowMsg.timestamp) {
      setHideMsg(flowMsg.timestamp);
      const t = setTimeout(() => dispatch({ type: 'SET_FLOW_MESSAGE', payload: null }), 8000);
      return () => clearTimeout(t);
    }
  }, [flowMsg?.timestamp]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Route className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  图最短路绕行比较
                </h1>
                <p className="text-xs text-gray-500">
                  可解释的路径分析与复核系统 · 分母为0空字符串处理 · 三步工作流
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={runFullFlow}
                disabled={flowRunning}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  flowRunning
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:shadow-lg hover:scale-105'
                }`}
                title="一键走完整流程：首次导入→重复导入→补反例→改备注→复核→演示"
              >
                {flowRunning ? (
                  <>
                    <Play className="w-4 h-4 animate-pulse" />
                    流程演示中 {flowStep}/{flowSteps.length}
                  </>
                ) : (
                  <>
                    <FastForward className="w-4 h-4" />
                    一键走完整流程
                  </>
                )}
              </button>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {flowRunning && (
            <div className="mt-3 space-y-1">
              {flowSteps.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs ${i + 1 < flowStep ? 'text-green-600' : i + 1 === flowStep ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
                  {i + 1 < flowStep ? <CheckCircle2 className="w-3 h-3" /> : i + 1 === flowStep ? <Play className="w-3 h-3" /> : <span className="w-3 h-3 inline-block rounded-full bg-gray-300" />}
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {flowMsg && (
        <div className={`sticky top-[88px] z-30 max-w-[1600px] mx-auto px-6 mt-3`}>
          <div className={`rounded-xl shadow-md border flex items-start justify-between px-5 py-3 ${
            flowMsg.type === 'success' ? 'bg-green-50 border-green-200'
            : flowMsg.type === 'warning' ? 'bg-amber-50 border-amber-200'
            : flowMsg.type === 'error' ? 'bg-red-50 border-red-200'
            : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              {flowMsg.type === 'success' ? <Check className="w-5 h-5 text-green-600 mt-0.5" />
              : flowMsg.type === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              : flowMsg.type === 'error' ? <XIcon className="w-5 h-5 text-red-600 mt-0.5" />
              : <Info className="w-5 h-5 text-blue-600 mt-0.5" />}
              <p className={`text-sm leading-relaxed ${
                flowMsg.type === 'success' ? 'text-green-800'
                : flowMsg.type === 'warning' ? 'text-amber-800'
                : flowMsg.type === 'error' ? 'text-red-800'
                : 'text-blue-800'
              }`}>{flowMsg.text}</p>
            </div>
            <button
              onClick={() => dispatch({ type: 'SET_FLOW_MESSAGE', payload: null })}
              className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto p-6">
        <div className="mb-6">
          <WorkflowProgress />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'parameters' && (
              <ParameterTable
                onSelectRecord={handleSelectRecord}
                selectedRecordId={state.selectedRecordId}
                onShowHistory={handleShowHistory}
              />
            )}
            {activeTab === 'comparison' && (
              <ComparisonList
                onSelectResult={handleSelectResult}
                selectedResultId={state.selectedResultId}
                onJumpToRecord={handleJumpToRecord}
              />
            )}
            {activeTab === 'visualization' && (
              <GraphVisualization
                displayMode={state.displayMode}
                onModeChange={handleModeChange}
                selectedResultId={state.selectedResultId}
                onJumpToRecord={handleJumpToRecord}
              />
            )}
            {activeTab === 'report' && <ReportGenerator />}
          </div>

          <div className="space-y-6">
            <ReviewPanel selectedRecordId={state.selectedRecordId} />

            {state.parameterVersions.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-800">
                  <h2 className="text-lg font-bold text-white">参数版本历史</h2>
                  <p className="text-slate-300 text-sm mt-1">
                    专业计算的取舍依据
                  </p>
                </div>
                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  {[...state.parameterVersions].reverse().map(version => (
                    <div
                      key={version.version}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        state.currentParameterVersion === version.version
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() =>
                        dispatch({
                          type: 'SET_CURRENT_PARAMETER_VERSION',
                          payload: version.version,
                        })
                      }
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-mono text-sm font-bold ${
                            state.currentParameterVersion === version.version
                              ? 'text-indigo-700'
                              : 'text-gray-700'
                          }`}
                        >
                          {version.version}
                        </span>
                        {state.currentParameterVersion === version.version && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            当前使用
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        {version.reasoning}
                      </p>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>
                          <span className="font-mono bg-gray-100 px-1 rounded">
                            {version.parameters.edgeWeightFormula}
                          </span>
                        </p>
                        <p>
                          绕行阈值：{version.parameters.detourThreshold} 倍
                        </p>
                        <p>
                          流量考虑：{version.parameters.considerTraffic ? '是' : '否'}
                        </p>
                        <p>
                          创建于：{new Date(version.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showHistory && historyRecordId && (
        <HistoryDiffModal
          recordId={historyRecordId}
          fromVersion={historyFromVersion}
          toVersion={historyToVersion}
          onClose={handleCloseHistory}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
