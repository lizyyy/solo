import { Settings, Info } from 'lucide-react';
import { ModelParams } from '../../types';

interface ParamsSectionProps {
  params: ModelParams;
}

const ParamsSection = ({ params }: ParamsSectionProps) => {
  return (
    <div className="card-border">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h3 className="text-lg font-serif font-semibold text-primary-800">参数版本与计算说明</h3>
          <p className="text-sm text-gray-500">模型判断参数及取舍理由</p>
        </div>
      </div>
      
      <div className="mb-4">
        <span className="tag-accent mb-2 inline-block">
          参数版本：{params.version}
        </span>
      </div>
      
      <div className="bg-slate-900 rounded-lg p-4 mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(params.params).map(([key, value]) => (
              <tr key={key}>
                <td className="py-1.5 pr-4 text-slate-400 font-mono whitespace-nowrap">{key}</td>
                <td className="py-1.5 text-accent-400 font-mono">
                  {typeof value === 'boolean' ? value.toString() : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-accent-50 rounded-lg border border-accent-200">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-accent-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-accent-800 mb-1">取舍理由</p>
            <p className="text-sm text-accent-700 leading-relaxed">{params.tradeOffReason}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParamsSection;
