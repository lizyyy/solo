import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getBatchTypeName } from "@/utils";
import type { CheckType } from "@/types";
import { ShieldCheck, Copy, Thermometer, RefreshCw, FileCheck, Play, CheckCircle, XCircle, ChevronDown, ChevronUp, Clock, AlertTriangle } from "lucide-react";

const checkConfigs: Record<CheckType, {
  name: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  description: string;
  color: string;
}> = {
  duplicate_import: {
    name: "重复导入检测",
    icon: Copy,
    description: "检测相同设备+时间段的重复导入记录",
    color: "text-blue-600 bg-blue-50"
  },
  temperature_mixed: {
    name: "摄氏度/开尔文混用检测",
    icon: Thermometer,
    description: "全量扫描温度单位不一致的记录",
    color: "text-amber-600 bg-amber-50"
  },
  recalculation: {
    name: "补录后重算验证",
    icon: RefreshCw,
    description: "验证补录数据后溶氧扩散计算结果一致性",
    color: "text-green-600 bg-green-50"
  },
  export_consistency: {
    name: "导出一致性校验",
    icon: FileCheck,
    description: "校验导出数据与系统内数据是否一致",
    color: "text-purple-600 bg-purple-50"
  }
};

export default function SelfCheck() {
  const { 
    currentBatchType, 
    selfCheckResults,
    runSelfCheck
  } = useAppStore();

  const [running, setRunning] = useState(false);
  const [currentRunning, setCurrentRunning] = useState<CheckType | null>(null);
  const [expanded, setExpanded] = useState<CheckType | null>(null);
  const [progress, setProgress] = useState(0);

  const handleRunAll = async () => {
    setRunning(true);
    setProgress(0);
    const types: CheckType[] = ['duplicate_import', 'temperature_mixed', 'recalculation', 'export_consistency'];
    
    for (let i = 0; i < types.length; i++) {
      setCurrentRunning(types[i]);
      setProgress((i / types.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 600));
      runSelfCheck(types[i]);
    }
    
    setProgress(100);
    await new Promise(resolve => setTimeout(resolve, 300));
    setRunning(false);
    setCurrentRunning(null);
  };

  const handleRunSingle = async (type: CheckType) => {
    setCurrentRunning(type);
    await new Promise(resolve => setTimeout(resolve, 400));
    runSelfCheck(type);
    setCurrentRunning(null);
  };

  const getResultForType = (type: CheckType) => {
    return selfCheckResults.find(r => r.checkType === type);
  };

  const passedCount = selfCheckResults.filter(r => r.passed).length;
  const failedCount = selfCheckResults.filter(r => !r.passed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">自检中心</h2>
          <p className="text-sm text-slate-500 mt-1">覆盖最容易出错的四个关键点：重复导入、温度混用、补录重算、导出一致</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded">
            {getBatchTypeName(currentBatchType)}
          </span>
          <button
            onClick={handleRunAll}
            disabled={running}
            className="px-4 py-2 text-sm bg-[#0F4C81] text-white rounded hover:bg-[#0a3a65] transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                自检中...
              </>
            ) : (
              <>
                <Play size={16} />
                运行全部自检
              </>
            )}
          </button>
        </div>
      </div>

      {running && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">
              正在检测：{currentRunning && checkConfigs[currentRunning].name}
            </span>
            <span className="text-sm font-medium text-[#0F4C81]">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#0F4C81] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {selfCheckResults.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-3xl font-bold text-slate-800">{selfCheckResults.length}</p>
            <p className="text-sm text-slate-500 mt-1">总检测项</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-green-200 p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{passedCount}</p>
            <p className="text-sm text-slate-500 mt-1">通过</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{failedCount}</p>
            <p className="text-sm text-slate-500 mt-1">未通过</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-3xl font-bold text-[#0F4C81]">
              {selfCheckResults.length > 0 ? Math.round((passedCount / selfCheckResults.length) * 100) : 0}%
            </p>
            <p className="text-sm text-slate-500 mt-1">通过率</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {(Object.keys(checkConfigs) as CheckType[]).map((type) => {
          const config = checkConfigs[type];
          const Icon = config.icon;
          const result = getResultForType(type);
          const isExpanded = expanded === type;
          const isRunning = currentRunning === type;

          return (
            <div 
              key={type}
              className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all ${
                result 
                  ? result.passed 
                    ? 'border-green-200' 
                    : 'border-red-200'
                  : 'border-slate-200'
              }`}
            >
              <div 
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => !isRunning && setExpanded(isExpanded ? null : type)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-lg ${config.color}`}>
                    {isRunning ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <Icon size={20} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-800">{config.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isRunning ? (
                    <span className="text-xs text-slate-500">检测中...</span>
                  ) : result ? (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                        result.passed 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {result.passed ? (
                          <><CheckCircle size={12} /> 通过</>
                        ) : (
                          <><XCircle size={12} /> 未通过</>
                        )}
                      </span>
                      <span className="text-xs text-slate-400">
                        <Clock size={12} className="inline mr-1" />
                        {result.checkedAt && new Date(result.checkedAt).toLocaleTimeString('zh-CN')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">未检测</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunSingle(type);
                    }}
                    disabled={isRunning || running}
                    className="p-1.5 text-slate-400 hover:text-[#0F4C81] hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                    title="重新检测"
                  >
                    <RefreshCw size={16} className={isRunning ? 'animate-spin' : ''} />
                  </button>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </div>
              </div>

              {isExpanded && result && (
                <div className="px-5 pb-4">
                  <div className={`p-3 rounded border ${
                    result.passed 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <p className={`text-sm ${result.passed ? 'text-green-800' : 'text-red-800'}`}>
                      {result.details}
                    </p>
                  </div>
                  
                  {result.data && type === 'duplicate_import' && result.data.duplicates && Array.isArray(result.data.duplicates) && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-600 mb-2">重复组列表：</p>
                      <div className="space-y-1">
                        {(result.data.duplicates as Array<{ key: string; count: number }>).map((item, idx) => (
                          <div key={idx} className="text-xs text-slate-600 p-2 bg-slate-50 rounded">
                            {item.key} ({item.count}条)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.data && type === 'temperature_mixed' && result.data.mixedDetails && Array.isArray(result.data.mixedDetails) && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-600 mb-2">混用记录：</p>
                      <div className="space-y-1">
                        {(result.data.mixedDetails as string[]).map((item, idx) => (
                          <div key={idx} className="text-xs text-slate-600 p-2 bg-slate-50 rounded">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {type === 'temperature_mixed' && !result.passed && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700">
                          处理建议：系统不会自动转换单位，请提交给训练教练复核确认后再处理。
                        </p>
                      </div>
                    </div>
                  )}

                  {type === 'duplicate_import' && !result.passed && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700">
                          处理建议：请核对重复记录，确认是补录还是误导入，必要时删除冗余数据。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-[#0F4C81] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-800">自检说明</p>
            <ul className="text-xs text-slate-500 mt-2 space-y-1">
              <li>• <strong>重复导入检测</strong>：检查是否存在相同设备在相同时间的多条记录</li>
              <li>• <strong>温度混用检测</strong>：检查同一批数据中是否同时使用了摄氏度和开尔文</li>
              <li>• <strong>补录重算验证</strong>：验证补录数据后溶氧扩散计算是否正确执行</li>
              <li>• <strong>导出一致性校验</strong>：验证导出数据与系统内部数据是否完全一致</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
