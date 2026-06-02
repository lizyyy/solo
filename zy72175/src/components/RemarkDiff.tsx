
import React from 'react';
import { MessageSquare, ArrowRight } from 'lucide-react';

interface RemarkDiffProps {
  before: string;
  after: string;
}

export const RemarkDiff: React.FC<RemarkDiffProps> = ({ before, after }) => {
  const getDiffParts = () => {
    const beforeWords = before.split('');
    const afterWords = after.split('');
    
    let i = 0;
    while (i < afterWords.length) {
      if (beforeWords[i] !== afterWords[i]) {
        break;
      }
      i++;
    }
    
    const commonPrefix = afterWords.slice(0, i).join('');
    const newPart = afterWords.slice(i).join('');
    
    return { commonPrefix, newPart };
  };

  const { commonPrefix, newPart } = getDiffParts();

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">补录备注差异</span>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">补录前：</div>
          <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
            {before || <span className="text-gray-400 italic">（无备注）</span>}
          </div>
        </div>
        
        <div className="flex justify-center">
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </div>
        
        <div>
          <div className="text-xs text-gray-500 mb-1">补录后：</div>
          <div className="text-sm text-gray-700 bg-green-50 px-3 py-2 rounded border border-green-200">
            {commonPrefix}
            {newPart && (
              <span className="bg-green-200 text-green-800 px-1 rounded font-medium">
                {newPart}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
