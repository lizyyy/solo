import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, FileClock, Upload, FileText, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';
import { sampleDescriptions } from '../data/mockData';
import { BatchStatus } from '../types';
import StatusBadge from '../components/StatusBadge';

const ImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { batches, setCurrentBatch } = useAppStore();
  const [selectedType, setSelectedType] = useState<BatchStatus | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showHandwriting, setShowHandwriting] = useState(false);

  const sampleTypes: { type: BatchStatus; icon: React.ReactNode; color: string; borderColor: string }[] = [
    { 
      type: 'normal', 
      icon: <CheckCircle className="w-8 h-8" />, 
      color: 'bg-success/10 text-success',
      borderColor: 'border-success'
    },
    { 
      type: 'pending_review', 
      icon: <AlertTriangle className="w-8 h-8" />, 
      color: 'bg-warning/10 text-warning',
      borderColor: 'border-warning'
    },
    { 
      type: 'supplemented', 
      icon: <FileClock className="w-8 h-8" />, 
      color: 'bg-supplemented/10 text-supplemented',
      borderColor: 'border-supplemented'
    }
  ];

  const handleImport = () => {
    if (!selectedType) return;
    
    setIsImporting(true);
    setShowHandwriting(true);

    const targetBatch = batches.find(b => b.status === selectedType);
    
    setTimeout(() => {
      if (targetBatch) {
        setCurrentBatch(targetBatch.id);
        navigate(`/playback/${targetBatch.id}`);
      }
    }, 2000);
  };

  const handwritingNotes: Record<BatchStatus, string> = {
    normal: '1月15日 A批次高铝瓷\n升温正常 各温区稳定\n巡检人：张三 9:00',
    pending_review: '1月15日 B批次长石瓷\n*第8-9区数据有涂改\n原记录异常，已改系数\n原因待查 巡检人：李四',
    supplemented: '1月15日 C批次镁质瓷\n*按新口径超标\n*老配方产品，需查旧表\n巡检人：王五 请补录'
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-700">数据导入</h2>
          <p className="text-neutral-500 mt-1">选择演示样例，模拟手写巡检备注导入流程</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {sampleTypes.map((sample, index) => {
          const desc = sampleDescriptions[sample.type];
          const isSelected = selectedType === sample.type;
          
          return (
            <div
              key={sample.type}
              onClick={() => setSelectedType(sample.type)}
              className={`
                relative p-6 bg-white rounded-xl cursor-pointer transition-all duration-300
                border-2 hover:shadow-lg animate-fade-in-up
                ${isSelected 
                  ? `${sample.borderColor} shadow-md scale-[1.02]` 
                  : 'border-neutral-200 hover:border-neutral-300'
                }
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {isSelected && (
                <div className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center ${sample.color.split(' ')[0]}`}>
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${sample.color}`}>
                {sample.icon}
              </div>
              
              <h3 className="text-lg font-semibold text-neutral-700 mb-1">{desc.title}</h3>
              <p className="text-sm text-neutral-400 mb-3">{desc.subtitle}</p>
              <p className="text-sm text-neutral-500 leading-relaxed">{desc.description}</p>
              
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <StatusBadge status={sample.type} size="sm" />
              </div>
            </div>
          );
        })}
      </div>

      {showHandwriting && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800 mb-2">手写巡检备注识别中...</h4>
              <div className="bg-white/70 rounded-lg p-4 font-mono text-sm text-amber-900 whitespace-pre-line border border-amber-200">
                {selectedType && handwritingNotes[selectedType]}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 bg-amber-200/50 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-2000"
                    style={{ width: isImporting ? '100%' : '0%' }}
                  />
                </div>
                <span className="text-sm text-amber-700">解析中...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={handleImport}
          disabled={!selectedType || isImporting}
          className={`
            flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-white transition-all
            ${selectedType && !isImporting
              ? 'bg-primary hover:bg-primary/90 hover:scale-105 shadow-lg shadow-primary/25'
              : 'bg-neutral-300 cursor-not-allowed'
            }
          `}
        >
          <Upload className="w-5 h-5" />
          {isImporting ? '正在导入...' : '导入巡检数据'}
          {!isImporting && <ArrowRight className="w-5 h-5" />}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm">i</span>
          三步演示流程说明
        </h4>
        <ol className="space-y-2 text-sm text-blue-700">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
            <span>选择样例并导入 → 系统自动解析手写巡检备注中的温度数据</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
            <span>质检员小白查看安全阈值表 → 如发现口径问题，从阈值表补录旧口径标准</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
            <span>参数回放页更新 → 展示最终曲线和处理结果，人工修正需工程师复核</span>
          </li>
        </ol>
      </div>
    </div>
  );
};

export default ImportPage;
