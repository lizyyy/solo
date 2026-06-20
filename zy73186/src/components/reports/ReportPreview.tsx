import React, { useState, useEffect, useRef } from 'react';
import { Download, Copy, Check, FileText, Hash, User, Clock, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import type { Report } from '@/types';
import { shortHash } from '@/utils/hash';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/common/Tooltip';
import { CitationPopover } from './CitationPopover';
import { reportGenerator } from '@/services/reportGenerator';

interface ReportPreviewProps {
  report: Report;
  onDownload?: () => void;
  showFull?: boolean;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  report,
  onDownload,
  showFull = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [citationPopover, setCitationPopover] = useState<{
    x: number;
    y: number;
    content: string;
    materialId: string;
    anchorText: string;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([report.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onDownload?.();
  };

  const handleCitationClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const href = e.currentTarget.getAttribute('data-citation');
    if (!href) return;

    const match = report.citations.find((c) => c.id === href);
    if (!match) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setCitationPopover({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
      content: match.content,
      materialId: match.materialId,
      anchorText: match.anchorText,
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (citationPopover) {
        setCitationPopover(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [citationPopover]);

  return (
    <div className="bg-[#1a202c] border border-[#4a5568] rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-4 bg-[#0d1117] border-b border-[#4a5568] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#68d391]" />
          <div>
            <div className="font-mono text-sm text-[#e2e8f0]">{report.title}</div>
            <div className="flex items-center gap-3 mt-0.5 text-xs font-mono text-[#718096]">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                #{shortHash(report.id, 8)}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {report.generatedBy}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(report.generatedAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Copy className="w-3.5 h-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
          >
            {copied ? '已复制' : '复制'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
          >
            下载
          </Button>
          {showFull && (
            isExpanded ? (
              <ChevronUp className="w-5 h-5 text-[#718096]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#718096]" />
            )
          )}
        </div>
      </div>

      {isExpanded && (
        <div ref={contentRef} className="p-6">
          <article
            className="prose prose-invert max-w-none"
            style={{
              fontSize: '14px',
              lineHeight: 1.7,
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-mono text-[#e2e8f0] border-b border-[#4a5568] pb-2 mb-4 mt-0 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-mono text-[#e2e8f0] mt-6 mb-3 flex items-center gap-2">
                    <span className="w-1 h-5 bg-[#3182ce] rounded" />
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-mono text-[#e2e8f0] mt-4 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-[#a0aec0] mb-3 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-[#a0aec0] mb-3 space-y-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-[#a0aec0] mb-3 space-y-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-[#a0aec0]">{children}</li>
                ),
                code: ({ node, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 bg-[#0d1117] text-[#63b3ed] rounded text-sm font-mono">
                        {children}
                      </code>
                    );
                  }

                  return (
                    <pre className="p-4 bg-[#0d1117] border border-[#4a5568] rounded-lg overflow-x-auto mb-4">
                      <code className="text-sm font-mono text-[#a0aec0]">
                        {children}
                      </code>
                    </pre>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[#3182ce] pl-4 my-4 text-[#a0aec0] italic bg-[#0d1117] py-2 pr-4 rounded-r">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full border-collapse text-sm font-mono">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 bg-[#0d1117] border border-[#4a5568] text-left text-[#e2e8f0] font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 border border-[#4a5568] text-[#a0aec0]">
                    {children}
                  </td>
                ),
                a: ({ href, children, ...props }) => {
                  const isCitation = href?.startsWith('#cite-');
                  if (isCitation) {
                    return (
                      <a
                        href={href}
                        data-citation={href.replace('#cite-', '')}
                        onClick={handleCitationClick}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-[#1a365d] text-[#63b3ed] rounded hover:bg-[#2c5282] cursor-pointer transition-colors"
                      >
                        <BookOpen className="w-3 h-3" />
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a
                      href={href}
                      className="text-[#63b3ed] hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  );
                },
                strong: ({ children }) => (
                  <strong className="text-[#e2e8f0] font-semibold">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="text-[#f6ad55] not-italic">{children}</em>
                ),
                hr: () => <hr className="my-6 border-[#4a5568]" />,
              }}
            >
              {report.content}
            </ReactMarkdown>
          </article>

          {report.citations.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#4a5568]">
              <h3 className="font-mono text-sm text-[#e2e8f0] mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#63b3ed]" />
                引用溯源
              </h3>
              <div className="space-y-2">
                {report.citations.map((citation, index) => (
                  <div
                    key={citation.id}
                    className="p-3 bg-[#0d1117] rounded border border-[#4a5568]"
                  >
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 text-xs bg-[#1a365d] text-[#63b3ed] rounded flex-shrink-0">
                        [{index + 1}]
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-[#718096] mb-1">
                          原文片段
                        </div>
                        <p className="text-sm text-[#a0aec0] mb-2">
                          "{citation.anchorText}"
                        </p>
                        <div className="flex items-center gap-3 text-xs font-mono text-[#718096]">
                          <span>材料: #{shortHash(citation.materialId, 6)}</span>
                          <span>位置: 第 {citation.position} 字符</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {citationPopover && (
        <CitationPopover
          x={citationPopover.x}
          y={citationPopover.y}
          content={citationPopover.content}
          materialId={citationPopover.materialId}
          anchorText={citationPopover.anchorText}
          onClose={() => setCitationPopover(null)}
        />
      )}
    </div>
  );
};
