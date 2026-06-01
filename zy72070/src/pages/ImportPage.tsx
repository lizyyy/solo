import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Upload, Database, FileJson, ChevronRight, Info } from 'lucide-react';

export function ImportPage() {
  const navigate = useNavigate();
  const loadSampleData = useAppStore((state) => state.loadSampleData);
  const devices = useAppStore((state) => state.devices);

  const handleLoadSample = () => {
    loadSampleData();
    navigate('/workspace');
  };

  const handleContinue = () => {
    navigate('/workspace');
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="p-6 border-b border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-text-primary">地下停车诱导模型</h1>
          <p className="text-text-secondary mt-1">CAD导出点位数据对齐工具</p>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <section className="bg-bg-secondary rounded-lg border border-border-subtle overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-accent-blue" />
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">快速开始</h2>
                  <p className="text-sm text-text-muted">加载预置样例数据，体验完整功能</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <button
                onClick={handleLoadSample}
                className="w-full flex items-center justify-between p-4 bg-accent-blue/10 hover:bg-accent-blue/20 border border-accent-blue/30 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent-blue/20 rounded-lg flex items-center justify-center">
                    <FileJson className="w-6 h-6 text-accent-blue" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-text-primary">地下停车诱导模型 - 样例数据</div>
                    <div className="text-sm text-text-muted mt-0.5">
                      包含坐标偏移、设备重名、缺照片、跨楼层、坐标系不一致等典型异常
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-accent-blue group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="mt-4 p-4 bg-bg-tertiary rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-text-muted space-y-1">
                    <p>样例数据包含以下场景：</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>1条顺利通过记录 - 数据完整、坐标一致</li>
                      <li>1条需人工确认记录 - 坐标接近阈值边界</li>
                      <li>1条CAD旧口径记录 - 字段命名与新标准不同</li>
                      <li>坐标偏移、设备重名、缺照片、跨楼层异常各1条</li>
                      <li>1组坐标系不一致数据 - 分别渲染不强行合并</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-bg-secondary rounded-lg border border-border-subtle overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <Upload className="w-6 h-6 text-accent-green" />
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">导入数据</h2>
                  <p className="text-sm text-text-muted">上传您的CAD点位和现场采集数据</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="border-2 border-dashed border-border-subtle rounded-lg p-8 text-center hover:border-accent-blue/50 transition-colors">
                <Upload className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">拖拽文件到此处，或</p>
                <button className="mt-2 px-4 py-2 bg-bg-tertiary hover:bg-border-subtle rounded text-sm text-text-primary transition-colors">
                  选择文件
                </button>
                <p className="text-xs text-text-muted mt-4">支持 JSON、CSV 格式</p>
              </div>
            </div>
          </section>

          {devices.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={handleContinue}
                className="px-6 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                继续上次工作
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="p-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto text-center text-sm text-text-muted">
          地下停车诱导模型工具 · 让乱材料能对得上，让判断过程有迹可循
        </div>
      </footer>
    </div>
  );
}
