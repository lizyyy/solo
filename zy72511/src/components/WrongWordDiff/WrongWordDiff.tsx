import React from 'react';
import { WrongWord } from '../../types';
import { highlightTextDiff } from '../../utils';

interface WrongWordDiffProps {
  originalText: string;
  transcribedText: string;
  wrongWords: WrongWord[];
}

export const WrongWordDiff: React.FC<WrongWordDiffProps> = ({
  originalText,
  transcribedText,
  wrongWords
}) => {
  const { originalHtml, transcribedHtml } = highlightTextDiff(originalText, transcribedText);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-2">错词对比</h4>
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500 mb-2">原文</p>
            <p
              className="text-sm text-slate-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: originalHtml }}
            />
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500 mb-2">转写结果</p>
            <p
              className="text-sm text-slate-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: transcribedHtml }}
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-2">错词详情 ({wrongWords.length} 处)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">序号</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">原文</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">转写</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">错误类型</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">置信度</th>
              </tr>
            </thead>
            <tbody>
              {wrongWords.map((word, index) => (
                <tr key={word.id} className="border-b border-slate-100">
                  <td className="py-2 px-3 text-slate-600">{index + 1}</td>
                  <td className="py-2 px-3">
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                      {word.original}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                      {word.transcribed}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-600">{word.errorType}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${word.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        {(word.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
