import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { getBatchTypeName } from "@/utils";
import { StepForward, Upload, FileText, AlertTriangle, FileCheck, ShieldCheck, ChevronRight, Database, Zap, Play } from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const navigate = useNavigate();
  const { 
    currentStep, 
    currentBatchType, 
    workPhotos, 
    inspectionNotes, 
    conflicts,
    reports,
    setCurrentStep,
    setCurrentBatchType,
    addMockData,
    runAllSelfChecks
  } = useAppStore();

  const steps = [
    { id: 1, title: "工况照片导入", desc: "上传工况照片，录入溶氧数据", icon: Upload, path: "/import" },
    { id: 2, title: "巡检备注补录", desc: "维修师傅老岑查看手写巡检备注", icon: FileText, path: "/inspection" },
    { id: 3, title: "交接报告更新", desc: "生成报告，训练教练复核混用情况", icon: FileCheck, path: "/report" },
  ];

  const pendingConflicts = conflicts.filter(c => c.status === 'pending').length;
  const totalPhotos = workPhotos.length;
  const totalNotes = inspectionNotes.length;

  useEffect(() => {
    if (workPhotos.length === 0) {
    }
  }, []);

  const handleLoadDemo = () => {
    addMockData();
    setTimeout(() => {
      runAllSelfChecks();
    }, 500);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">工作流程</h2>
            <p className="text-sm text-slate-500 mt-1">按顺序完成三步操作，证据链完整可追溯</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLoadDemo}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors"
            >
              <Database size={16} />
              加载演示数据
            </button>
            <button
              onClick={() => {
                runAllSelfChecks();
                navigate('/self-check');
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#0F4C81] text-white rounded hover:bg-[#0a3a65] transition-colors"
            >
              <Zap size={16} />
              运行自检
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            
            return (
              <div key={step.id} className="flex-1">
                <div className="flex items-center">
                  <div 
                    className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all cursor-pointer ${
                      isCompleted 
                        ? "bg-green-500 text-white" 
                        : isCurrent 
                          ? "bg-[#0F4C81] text-white ring-4 ring-[#0F4C81]/20" 
                          : "bg-slate-200 text-slate-500"
                    }`}
                    onClick={() => navigate(step.path)}
                  >
                    <Icon size={20} />
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 ${isCompleted ? "bg-green-500" : "bg-slate-200"}`} />
                  )}
                </div>
                <div className="mt-3">
                  <p className={`font-medium text-sm ${isCurrent || isCompleted ? "text-slate-800" : "text-slate-400"}`}>
                    第{step.id}步：{step.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-50 text-[#0F4C81]">
              <Database size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{totalPhotos}</p>
              <p className="text-sm text-slate-500">工况照片记录</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{totalNotes}</p>
              <p className="text-sm text-slate-500">巡检备注</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${pendingConflicts > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{pendingConflicts}</p>
              <p className="text-sm text-slate-500">待处理冲突</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">批次测试</h3>
          <p className="text-sm text-slate-500 mb-4">
            选择批次类型，分别跑正常材料、错口径材料、补录材料各一遍，对比交接报告结果
          </p>
          <div className="space-y-2 mb-4">
            {(['normal', 'wrong_caliber', 'supplementary'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setCurrentBatchType(type)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded text-sm transition-colors ${
                  currentBatchType === type
                    ? "bg-[#0F4C81] text-white"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{getBatchTypeName(type)}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/import')}
            className="w-full py-2.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
          >
            进入批次数据导入
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">核心规则</h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] mt-1.5 flex-shrink-0" />
              摄氏度和开尔文混用时，标记待复核，留给训练教练，不归正常
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] mt-1.5 flex-shrink-0" />
              工况照片与手写备注冲突时，列出证据，老岑选确认或驳回，不自动拍板
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] mt-1.5 flex-shrink-0" />
              交接报告与历史记录逐条比对，标记差异项，证据链不中断
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] mt-1.5 flex-shrink-0" />
              自检覆盖：重复导入、温度混用、补录重算、导出一致
            </li>
          </ul>
        </div>
      </div>

      {reports.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">历史交接报告</h3>
          <div className="space-y-2">
            {reports.slice(-5).reverse().map((report) => (
              <div 
                key={report.id} 
                className="flex items-center justify-between p-3 bg-slate-50 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                onClick={() => navigate('/report')}
              >
                <div className="flex items-center gap-3">
                  <FileCheck size={18} className="text-[#0F4C81]" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {getBatchTypeName(report.batchType)}批次报告
                    </p>
                    <p className="text-xs text-slate-500">
                      冲突 {report.conflictCount} 项，已解决 {report.resolvedCount} 项
                      {report.temperatureMixed && <span className="ml-2 text-amber-600">· 存在温度单位混用</span>}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
