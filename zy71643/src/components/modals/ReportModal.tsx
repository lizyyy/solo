import { useState, useRef } from 'react';
import { X, FileText, Download, Loader, Eye } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useCollisionStore } from '../../stores/collisionStore';
import { usePipelineStore } from '../../stores/pipelineStore';
import { generatePDFReport, captureScene } from '../../utils/export';
import { cn } from '../../lib/utils';

export function ReportModal() {
  const show = useUIStore((state) => state.showReportModal);
  const setShow = useUIStore((state) => state.setShowReportModal);
  const showNotification = useUIStore((state) => state.showNotification);

  const collisions = useCollisionStore((state) => state.collisions);
  const dataIssues = useCollisionStore((state) => state.dataIssues);
  const lastResult = useCollisionStore((state) => state.lastResult);
  const segments = usePipelineStore((state) => state.segments);

  const [title, setTitle] = useState('市政道路地下管线碰撞检测');
  const [inspector, setInspector] = useState('系统管理员');
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);

  const sceneRef = useRef<HTMLDivElement>(null);

  if (!show) return null;

  const handleGenerate = async () => {
    if (!lastResult) {
      showNotification('请先执行碰撞检测', 'warning');
      return;
    }

    setIsGenerating(true);

    try {
      let sceneImage: string | undefined;

      if (includeScreenshot) {
        const sceneElement = document.getElementById('three-scene-container');
        if (sceneElement) {
          sceneImage = await captureScene(sceneElement);
        }
      }

      await generatePDFReport({
        title,
        date: new Date().toLocaleDateString('zh-CN'),
        inspector,
        detectionResult: lastResult,
        collisions,
        dataIssues,
        sceneImage,
      });

      showNotification('报告导出成功', 'success');
      setShow(false);
    } catch (error) {
      console.error('生成报告失败:', error);
      showNotification('报告生成失败，请重试', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const criticalCount = collisions.filter((c) => c.severity === 'critical').length;
  const warningCount = collisions.filter((c) => c.severity === 'warning').length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <FileText size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">导出检测报告</h2>
              <p className="text-slate-400 text-xs">生成PDF格式检测报告</p>
            </div>
          </div>
          <button
            onClick={() => setShow(false)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
            <h3 className="text-white text-sm font-medium mb-3">报告预览</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-slate-500">检测管线</div>
                <div className="text-white font-mono">{segments.length} 段</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-slate-500">碰撞总数</div>
                <div className="text-white font-mono">{collisions.length} 处</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-slate-500">严重问题</div>
                <div className="text-red-400 font-mono">{criticalCount} 处</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-slate-500">警告问题</div>
                <div className="text-orange-400 font-mono">{warningCount} 处</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-slate-500">数据异常</div>
                <div className="text-yellow-400 font-mono">{dataIssues.length} 处</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-slate-500">检测用时</div>
                <div className="text-white font-mono">
                  {lastResult ? (lastResult.duration / 1000).toFixed(2) : '0'}s
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">项目名称</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="请输入项目名称"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">检测人员</label>
              <input
                type="text"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="请输入检测人员姓名"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeScreenshot}
                onChange={(e) => setIncludeScreenshot(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-300">包含场景截图</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-700 bg-slate-800/30">
          <button
            onClick={() => setShow(false)}
            className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !lastResult}
            className={cn(
              'px-4 py-2 text-xs text-white rounded-lg transition-colors flex items-center gap-1.5',
              isGenerating || !lastResult
                ? 'bg-slate-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500'
            )}
          >
            {isGenerating ? (
              <>
                <Loader size={12} className="animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download size={12} />
                导出PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
