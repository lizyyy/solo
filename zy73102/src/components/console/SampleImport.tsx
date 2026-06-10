import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Package } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

export default function SampleImport() {
  const navigate = useNavigate();
  const loadSamplePack = useAppStore((state) => state.loadSamplePack);
  const isSampleLoaded = useAppStore((state) => state.isSampleLoaded);

  const handleLoadSample = () => {
    loadSamplePack();
    setTimeout(() => {
      navigate('/tracker');
    }, 400);
  };

  return (
    <div className="bg-white rounded-xl card-shadow p-6">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-roof-slate mb-1 flex items-center gap-2">
          <Package className="w-[18px] h-[18px] text-engineering-blue" strokeWidth={2} />
          样例导入
        </h3>
        <p className="text-xs text-concrete-gray">快速加载标准演示数据或上传自有项目资料</p>
      </div>

      <div
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-all duration-300 overflow-hidden',
          isSampleLoaded
            ? 'border-pass-green/40 bg-green-50/30'
            : 'border-engineering-blue/25 bg-engineering-blue/[0.02] hover:border-engineering-blue/50 hover:bg-engineering-blue/[0.04]'
        )}
      >
        <div className="p-7 flex flex-col items-center text-center">
          {isSampleLoaded ? (
            <div className="w-14 h-14 rounded-full bg-pass-green/10 flex items-center justify-center mb-4">
              <div className="w-7 h-7 rounded-full bg-pass-green flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-engineering-blue/10 flex items-center justify-center mb-4">
              <Upload className="w-7 h-7 text-engineering-blue" strokeWidth={1.8} />
            </div>
          )}

          <button
            onClick={handleLoadSample}
            className={cn(
              'px-7 py-3 rounded-xl text-sm font-semibold transition-all duration-300 transform mb-3.5',
              isSampleLoaded
                ? 'bg-pass-green text-white hover:bg-pass-green/90 shadow-lg shadow-pass-green/25'
                : 'bg-engineering-blue text-white hover:bg-engineering-blue/90 hover:scale-[1.02] shadow-lg shadow-engineering-blue/25 active:scale-[0.98]'
            )}
          >
            {isSampleLoaded ? '✅ 样例包已加载，再次载入' : '🚀 一键加载标准样例包A'}
          </button>

          <p className={cn('text-xs font-medium mb-1.5', isSampleLoaded ? 'text-pass-green' : 'text-roof-slate')}>
            {isSampleLoaded ? '包含4个标准批次 + 7次执行记录，可随时跳转工作台体验' : '包含4个标准批次 + 7次历史执行完整链路数据'}
          </p>
          <p className="text-[11px] text-concrete-gray/80">
            {isSampleLoaded ? '数据已准备就绪，点击上方按钮可重新加载' : '建议新用户优先体验标准样例包熟悉操作流程'}
          </p>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText className="w-4 h-4 text-concrete-gray" strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-roof-slate font-medium mb-1">或上传自有项目资料</p>
            <p className="text-[11px] text-concrete-gray leading-relaxed">
              支持上传格式：<span className="font-mono text-engineering-blue font-medium">屋面图纸.dwg/.pdf</span>
              {' + '}
              <span className="font-mono text-engineering-blue font-medium">会议纪要.json</span>
            </p>
            <p className="text-[11px] text-concrete-gray/70 leading-relaxed mt-1">
              上传后系统将自动提取材料清单与规格参数，生成追踪批次
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
