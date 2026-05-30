import { useAppStore } from '@/store';
import type { ExceptionType } from '@/types';

const exceptionTypeLabels: Record<ExceptionType, string> = {
  MISSING_PERIOD: '现金流漏期',
  DUPLICATE_DATE: '日期重复',
  IRREGULAR_AMOUNT: '金额异常',
  INTERPOLATION_ERROR: '插值错误',
  CONVEXITY_SIGN_ERROR: '凸性符号错误',
};

export default function ExceptionDrawer() {
  const { showExceptionDrawer, toggleExceptionDrawer, exceptions, clearException, clearAllExceptions } = useAppStore();

  if (!showExceptionDrawer) return null;

  const handleSourceClick = (sourceRef: string) => {
    console.log('跳转到来源:', sourceRef);
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={toggleExceptionDrawer}
      />
      
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 animate-slide-in flex flex-col">
        <div className="p-5 border-b border-navy-100 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-navy-800">异常追溯面板</h3>
          <button
            onClick={toggleExceptionDrawer}
            className="text-navy-400 hover:text-navy-600 text-xl"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-3 bg-navy-50 border-b border-navy-100 flex justify-between items-center">
          <span className="text-sm text-navy-600">共 {exceptions.length} 条异常</span>
          {exceptions.length > 0 && (
            <button
              onClick={clearAllExceptions}
              className="text-xs text-navy-500 hover:text-navy-700 underline"
            >
              清空全部
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {exceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-navy-400">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-sm">暂无异常</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-100">
              {exceptions.map((ex, index) => (
                <div 
                  key={ex.id} 
                  className={`p-4 animate-fade-in ${
                    ex.severity === 'ERROR' ? 'bg-red-50/50' : 'bg-yellow-50/50'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={ex.severity === 'ERROR' ? 'text-red-500' : 'text-yellow-500'}>
                        {ex.severity === 'ERROR' ? '❌' : '⚠️'}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-navy-100 text-navy-600">
                        {exceptionTypeLabels[ex.type]}
                      </span>
                    </div>
                    <button
                      onClick={() => clearException(ex.id)}
                      className="text-navy-400 hover:text-navy-600 text-sm"
                    >
                      ×
                    </button>
                  </div>
                  
                  <p className="mt-2 text-sm text-navy-700">{ex.message}</p>
                  
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => handleSourceClick(ex.sourceRef)}
                      className="source-ref"
                    >
                      来源: {ex.sourceRef}
                    </button>
                    <span className="text-xs text-navy-400">
                      {new Date(ex.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
