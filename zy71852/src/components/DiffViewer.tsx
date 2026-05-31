import type { DiffResult } from '@/utils/diff';

interface DiffViewerProps {
  diffs: DiffResult[];
  className?: string;
}

export function DiffViewer({ diffs, className = '' }: DiffViewerProps) {
  return (
    <div className={`font-mono text-sm whitespace-pre-wrap ${className}`}>
      {diffs.map((diff, index) => {
        if (diff.type === 'equal') {
          return <span key={index} className="text-neutral-800">{diff.text}</span>;
        }
        if (diff.type === 'insert') {
          return (
            <span
              key={index}
              className="bg-green-100 text-green-800 rounded px-0.5"
            >
              {diff.text}
            </span>
          );
        }
        if (diff.type === 'delete') {
          return (
            <span
              key={index}
              className="bg-red-100 text-red-800 line-through rounded px-0.5"
            >
              {diff.text}
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}

interface SideBySideDiffProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
  diffs: DiffResult[];
}

export function SideBySideDiff({
  oldText,
  newText,
  oldLabel = '旧版本',
  newLabel = '新版本',
  diffs,
}: SideBySideDiffProps) {
  const oldContent: JSX.Element[] = [];
  const newContent: JSX.Element[] = [];

  diffs.forEach((diff, index) => {
    if (diff.type === 'equal') {
      oldContent.push(<span key={index}>{diff.text}</span>);
      newContent.push(<span key={index}>{diff.text}</span>);
    } else if (diff.type === 'delete') {
      oldContent.push(
        <span key={index} className="bg-red-100 text-red-800 line-through">
          {diff.text}
        </span>
      );
    } else if (diff.type === 'insert') {
      newContent.push(
        <span key={index} className="bg-green-100 text-green-800">
          {diff.text}
        </span>
      );
    }
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium text-neutral-600 mb-2 px-3 py-2 bg-neutral-100 rounded-t border border-b-0 border-neutral-200">
          {oldLabel}
        </div>
        <div className="p-4 border border-neutral-200 rounded-b font-mono text-sm whitespace-pre-wrap bg-white min-h-32">
          {oldContent.length > 0 ? oldContent : <span className="text-neutral-400">{oldText}</span>}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-neutral-600 mb-2 px-3 py-2 bg-neutral-100 rounded-t border border-b-0 border-neutral-200">
          {newLabel}
        </div>
        <div className="p-4 border border-neutral-200 rounded-b font-mono text-sm whitespace-pre-wrap bg-white min-h-32">
          {newContent.length > 0 ? newContent : <span className="text-neutral-400">{newText}</span>}
        </div>
      </div>
    </div>
  );
}
