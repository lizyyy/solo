import { useState, useRef, useEffect } from 'react';
import { X, Download, Loader2, Image as ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import type { SimulationParameters } from '../../types';

interface ScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: SimulationParameters;
  blackHoleMass: number;
  qualityStatus: string | null;
}

export function ScreenshotModal({
  isOpen,
  onClose,
  parameters,
  blackHoleMass,
  qualityStatus,
}: ScreenshotModalProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && !previewUrl) {
      captureScreenshot();
    }
    if (!isOpen) {
      setPreviewUrl(null);
    }
  }, [isOpen]);

  const captureScreenshot = async () => {
    setIsCapturing(true);
    try {
      const sceneElement = document.getElementById('main-canvas');
      if (sceneElement) {
        const canvas = await html2canvas(sceneElement, {
          backgroundColor: '#0a0a1a',
          scale: 2,
          useCORS: true,
        });

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(10, 10, 26, 0.85)';
          ctx.fillRect(10, canvas.height - 80, canvas.width - 20, 70);

          ctx.fillStyle = '#ff8c42';
          ctx.font = 'bold 14px Orbitron, sans-serif';
          ctx.fillText('黑洞引力透镜教具', 20, canvas.height - 55);

          ctx.fillStyle = '#ffffff';
          ctx.font = '11px monospace';
          const paramsText = `质量: ${blackHoleMass.toFixed(1)}M☉ | 光线: ${parameters.rayCount}条 | 密度: ${parameters.starDensity.toFixed(1)} | 透镜强度: ${parameters.lensStrength.toFixed(1)}`;
          ctx.fillText(paramsText, 20, canvas.height - 35);

          ctx.fillStyle = qualityStatus === 'pass' ? '#22c55e' : qualityStatus === 'warning' ? '#eab308' : qualityStatus === 'error' ? '#ef4444' : '#6b7280';
          const statusText = `质量状态: ${qualityStatus === 'pass' ? '通过' : qualityStatus === 'warning' ? '警告' : qualityStatus === 'error' ? '错误' : '未检测'}`;
          ctx.fillText(statusText, 20, canvas.height - 18);

          ctx.fillStyle = '#6b7280';
          ctx.font = '10px monospace';
          const dateText = new Date().toLocaleString('zh-CN');
          ctx.textAlign = 'right';
          ctx.fillText(dateText, canvas.width - 20, canvas.height - 18);
          ctx.textAlign = 'left';
        }

        setPreviewUrl(canvas.toDataURL('image/png'));
      }
    } catch (error) {
      console.error('截图失败:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const downloadScreenshot = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.download = `黑洞透镜_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = previewUrl;
      link.click();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-orange-400 font-['Orbitron'] tracking-wider">
            截图预览
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-gray-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            {isCapturing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                <span className="text-sm text-gray-400">正在生成截图...</span>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="截图预览"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <ImageIcon className="w-12 h-12 opacity-30" />
                <span className="text-sm">无法生成预览</span>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              参数水印
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">黑洞质量</span>
                <span className="text-orange-400 font-mono">{blackHoleMass.toFixed(1)} M☉</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">光线数量</span>
                <span className="text-blue-400 font-mono">{parameters.rayCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">恒星密度</span>
                <span className="text-yellow-400 font-mono">{parameters.starDensity.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">透镜强度</span>
                <span className="text-purple-400 font-mono">{parameters.lensStrength.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={captureScreenshot}
            disabled={isCapturing}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            重新截图
          </button>
          <button
            onClick={downloadScreenshot}
            disabled={!previewUrl || isCapturing}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            下载图片
          </button>
        </div>
      </div>
    </div>
  );
}
