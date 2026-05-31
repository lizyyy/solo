import { computeDiff, DiffLine } from '../utils/diff';

interface DiffViewerProps {
  oldText: string;
  newText: string;
}

export function DiffViewer({ oldText, newText }: DiffViewerProps) {
  const diff = computeDiff(oldText, newText);

  const getLineStyle = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500';
      case 'removed':
        return 'bg-rose-50 text-rose-800 border-l-4 border-rose-500 line-through';
      default:
        return 'bg-white text-gray-700';
    }
  };

  const getLinePrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return <span className="text-emerald-600 font-bold mr-2">+</span>;
      case 'removed':
        return <span className="text-rose-600 font-bold mr-2">−</span>;
      default:
        return <span className="text-gray-400 mr-2">│</span>;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">变更对比</span>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></span>
            新增
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-rose-100 border border-rose-300 rounded"></span>
            删除
          </span>
        </div>
      </div>
      <div className="max-h-96 overflow-auto font-mono text-sm">
        {diff.map((line, index) => (
          <div
            key={index}
            className={`flex py-1 px-3 ${getLineStyle(line.type)}`}
          >
            <span className="text-gray-400 w-12 flex-shrink-0 select-none text-right pr-4">
              {line.lineNumber}
            </span>
            {getLinePrefix(line.type)}
            <span className="flex-1 whitespace-pre-wrap break-all">
              {line.content || ' '}
            </span>
          </div>
        ))}
        {diff.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            无变更内容
          </div>
        )}
      </div>
    </div>
  );
}
