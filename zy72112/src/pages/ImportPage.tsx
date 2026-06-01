import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBatchStore } from '../store/useBatchStore';
import {
  Upload,
  Database,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';

export default function ImportPage() {
  const loadSampleBatch = useBatchStore(s => s.loadSampleBatch);
  const currentBatchId = useBatchStore(s => s.currentBatchId);
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  const handleLoadSample = () => {
    loadSampleBatch();
    setLoaded(true);
  };

  const handleGoTuning = () => {
    if (currentBatchId) {
      navigate('/tuning');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-blue-500" />
            <h1 className="text-lg font-mono font-bold tracking-tight">
              磁悬浮小车轨道调参系统
            </h1>
          </div>
          <nav className="flex items-center gap-2 text-sm font-mono">
            <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
              数据导入
            </span>
            <span className="px-3 py-1.5 text-zinc-500">调参主流程</span>
            <span className="px-3 py-1.5 text-zinc-500">历史对比</span>
            <span className="px-3 py-1.5 text-zinc-500">交接报告</span>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h2 className="text-2xl font-mono font-bold mb-2">数据导入</h2>
          <p className="text-zinc-400 text-sm">
            上传传感器记录、设备参数、现场备注或加载样例数据开始调参流程
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="border-2 border-dashed border-zinc-700 rounded-lg p-10 flex flex-col items-center justify-center hover:border-blue-500/50 transition-colors cursor-pointer group min-h-[240px]">
            <Upload className="w-12 h-12 text-zinc-600 group-hover:text-blue-500 transition-colors mb-4" />
            <p className="text-zinc-400 mb-2 font-mono text-sm">拖拽文件到此处或点击上传</p>
            <p className="text-zinc-600 text-xs">支持 CSV / JSON / TXT 格式</p>
          </div>

          <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
            <h3 className="font-mono font-bold mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              样例数据
            </h3>
            <p className="text-zinc-400 text-sm mb-6">
              包含3条预设记录：顺利记录、待确认记录、旧口径记录，用于演示完整调参流程
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-zinc-300 font-mono">顺利记录</span>
                <span className="text-zinc-600 ml-auto">单位统一，方向正常，间隔100ms</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-zinc-300 font-mono">待确认记录</span>
                <span className="text-zinc-600 ml-auto">X方向偏移-2.8mm，需人工审核</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                <span className="text-zinc-300 font-mono">旧口径记录</span>
                <span className="text-zinc-600 ml-auto">维修微信群数据，单位cm/μm/mA</span>
              </div>
            </div>

            <button
              onClick={handleLoadSample}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-sm rounded transition-colors"
            >
              {loaded ? '已加载样例数据' : '加载样例数据'}
            </button>

            {loaded && currentBatchId && (
              <button
                onClick={handleGoTuning}
                className="w-full mt-3 py-2.5 bg-green-600 hover:bg-green-500 text-white font-mono text-sm rounded transition-colors flex items-center justify-center gap-2"
              >
                <FlaskConical className="w-4 h-4" />
                进入调参主流程
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/30">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="font-mono text-sm font-bold text-green-400">顺利记录</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              所有校验项目通过：单位统一为mm/A，方向偏移在正常范围内，采样间隔100±10ms。系统自动标记为通过，无需人工确认。
            </p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/30">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="font-mono text-sm font-bold text-orange-400">待确认记录</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              存在校验警告：如X方向偏移超2mm、Y方向偏低/偏高、时间间隔异常等。需要实验老师人工确认后才能进入下一环节。
            </p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/30">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span className="font-mono text-sm font-bold text-zinc-400">旧口径记录</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              来自维修微信群的旧数据，单位不统一（cm/μm/mA），换算后数值可能与新口径有差异。需与新口径数据对比后再确认。
            </p>
          </div>
        </div>

        <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/30">
          <h3 className="font-mono font-bold mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            数据校验规则预览
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="text-blue-400 font-mono mb-2">单位校验</h4>
              <ul className="text-zinc-500 text-xs space-y-1">
                <li>轨道间隙 → 统一mm</li>
                <li>悬浮高度 → 统一mm（1μm = 0.001mm）</li>
                <li>推进电流 → 统一A（1mA = 0.001A）</li>
                <li>换算时保留原始值和换算后值</li>
              </ul>
            </div>
            <div>
              <h4 className="text-blue-400 font-mono mb-2">方向符号</h4>
              <ul className="text-zinc-500 text-xs space-y-1">
                <li>X轴：+向右 / -向左</li>
                <li>Y轴：+向上 / -向下</li>
                <li>X偏移超±2mm → 警告</li>
                <li>Y偏低(&lt;-1mm)或偏高(&gt;3mm) → 警告</li>
              </ul>
            </div>
            <div>
              <h4 className="text-blue-400 font-mono mb-2">时间间隔</h4>
              <ul className="text-zinc-500 text-xs space-y-1">
                <li>正常间隔：100ms ± 10ms</li>
                <li>间隔过大 → 可能数据丢包</li>
                <li>间隔过小 → 传感器触发异常</li>
                <li>首条记录无前置对比</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
