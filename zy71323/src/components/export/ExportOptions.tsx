import { useState } from 'react';
import { X, Settings, FileText, Image, CheckSquare, Square, Droplets } from 'lucide-react';
import type { ExportOptions as ExportOptionsType, ExportFormat } from '@/types';
import { cn } from '@/lib/utils';
import { ReportGenerator } from './ReportGenerator';

interface ExportOptionsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ContentToggle {
  key: keyof Omit<ExportOptionsType, 'format' | 'watermark'>;
  label: string;
  icon: React.ElementType;
}

const CONTENT_TOGGLES: ContentToggle[] = [
  { key: 'includeParams', label: '参数配置', icon: Settings },
  { key: 'includeCalculations', label: '计算过程', icon: FileText },
  { key: 'includeValidation', label: '验证结果', icon: CheckSquare },
  { key: 'includeCharts', label: '图表数据', icon: Image },
];

const FORMATS: Array<{ value: ExportFormat; label: string; desc: string }> = [
  { value: 'pdf', label: 'PDF', desc: '适合打印分享' },
  { value: 'markdown', label: 'Markdown', desc: '适合编辑存档' },
];

export function ExportOptions({ isOpen, onClose }: ExportOptionsProps) {
  const [options, setOptions] = useState<ExportOptionsType>({
    format: 'pdf',
    includeParams: true,
    includeCalculations: true,
    includeValidation: true,
    includeCharts: true,
    watermark: '',
  });
  const [showGenerator, setShowGenerator] = useState(false);

  const toggleContent = (key: ContentToggle['key']) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    setShowGenerator(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-ocean-900/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-ocean-700 border border-ocean-500 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-ocean-600/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-tech-500/20">
              <FileText className="w-5 h-5 text-tech-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">导出报告</h2>
              <p className="text-xs text-ocean-400">自定义报告内容和格式</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ocean-600/50 transition-colors"
          >
            <X className="w-5 h-5 text-ocean-400" />
          </button>
        </div>

        {!showGenerator ? (
          <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-sm font-medium text-ocean-200 mb-3 block">
                选择格式
              </label>
              <div className="grid grid-cols-2 gap-3">
                {FORMATS.map(fmt => (
                  <button
                    key={fmt.value}
                    onClick={() => setOptions(prev => ({ ...prev, format: fmt.value }))}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      options.format === fmt.value
                        ? 'border-tech-500 bg-tech-500/10'
                        : 'border-ocean-600/50 bg-ocean-600/20 hover:border-ocean-500'
                    )}
                  >
                    <div className="text-base font-semibold text-white mb-1">
                      {fmt.label}
                    </div>
                    <div className="text-[11px] text-ocean-400">{fmt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-ocean-200 mb-3 block">
                包含内容
              </label>
              <div className="space-y-2">
                {CONTENT_TOGGLES.map(toggle => {
                  const Icon = toggle.icon;
                  const isActive = options[toggle.key];
                  return (
                    <button
                      key={toggle.key}
                      onClick={() => toggleContent(toggle.key)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                        isActive
                          ? 'border-ocean-500 bg-ocean-600/30'
                          : 'border-ocean-600/30 bg-ocean-600/10 hover:border-ocean-500/50'
                      )}
                    >
                      {isActive ? (
                        <CheckSquare className="w-5 h-5 text-tech-400" />
                      ) : (
                        <Square className="w-5 h-5 text-ocean-500" />
                      )}
                      <Icon className={cn('w-4 h-4', isActive ? 'text-ocean-200' : 'text-ocean-500')} />
                      <span className={cn('text-sm', isActive ? 'text-white' : 'text-ocean-400')}>
                        {toggle.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-ocean-200 mb-2 block">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-ocean-400" />
                  水印文字
                </div>
              </label>
              <input
                type="text"
                value={options.watermark}
                onChange={e => setOptions(prev => ({ ...prev, watermark: e.target.value }))}
                placeholder="可选：输入水印文字，如'机密'、'内部使用'"
                className={cn(
                  'w-full px-4 py-3 rounded-lg border bg-ocean-800/50',
                  'border-ocean-600/50 text-white placeholder-ocean-500',
                  'focus:outline-none focus:border-tech-500 focus:ring-1 focus:ring-tech-500/50',
                  'text-sm transition-all'
                )}
              />
            </div>

            <button
              onClick={handleGenerate}
              className={cn(
                'w-full py-3.5 rounded-xl font-semibold text-white',
                'bg-gradient-to-r from-tech-500 to-tech-600',
                'hover:from-tech-400 hover:to-tech-500',
                'transition-all shadow-lg shadow-tech-500/20',
                'flex items-center justify-center gap-2'
              )}
            >
              <FileText className="w-5 h-5" />
              生成报告
            </button>
          </div>
        ) : (
          <div className="p-5">
            <ReportGenerator
              options={options}
              onComplete={() => setTimeout(onClose, 1500)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
