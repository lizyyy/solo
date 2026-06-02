import type { ModelEvidence, EvidenceSpan } from '../types';

interface EvidenceViewerProps {
  fullText: string;
  evidence: ModelEvidence | null;
  className?: string;
}

function highlightText(
  text: string,
  spans: EvidenceSpan[]
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);

  sortedSpans.forEach((span, idx) => {
    if (span.start > lastIndex) {
      nodes.push(text.slice(lastIndex, span.start));
    }
    nodes.push(
      <mark
        key={idx}
        className="bg-yellow-200 px-0.5 rounded font-medium"
        title={`证据片段: ${span.text}`}
      >
        {text.slice(span.start, span.end)}
      </mark>
    );
    lastIndex = span.end;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export default function EvidenceViewer({ fullText, evidence, className = '' }: EvidenceViewerProps) {
  if (!evidence) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
        <p className="text-gray-500 text-sm">无证据信息</p>
      </div>
    );
  }

  const hasSpans = evidence.spans && evidence.spans.length > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">证据原文</h4>
        <span className="text-xs text-gray-500">日志ID: {evidence.logId}</span>
      </div>
      
      <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm leading-relaxed">
        {hasSpans ? highlightText(fullText, evidence.spans) : fullText}
      </div>

      {evidence.reasoning && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900">模型推理说明</p>
              <p className="text-sm text-blue-800 mt-1">{evidence.reasoning}</p>
            </div>
          </div>
        </div>
      )}

      {hasSpans && (
        <div className="flex flex-wrap gap-2">
          {evidence.spans.map((span, idx) => (
            <div key={idx} className="px-3 py-1 bg-yellow-100 rounded-full text-xs text-yellow-800">
              位置 {span.start}-{span.end}: "{span.text}"
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        证据生成时间: {new Date(evidence.timestamp).toLocaleString('zh-CN')}
      </p>
    </div>
  );
}
