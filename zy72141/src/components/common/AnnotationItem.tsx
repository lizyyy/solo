import { Annotation } from '@/types';
import { formatDateTimeShort } from '@/utils/dateUtils';
import { MessageCircle, User, Clock, FileImage, FileText } from 'lucide-react';

interface AnnotationItemProps {
  annotation: Annotation;
  trackName?: string;
}

const sourceIcons = {
  chat: MessageCircle,
  manual: FileText,
  contract: FileText,
  ocr: FileImage,
};

const sourceLabels = {
  chat: '群聊',
  manual: '手动',
  contract: '合同',
  ocr: 'OCR识别',
};

const sourceColors = {
  chat: 'bg-blue-100 text-blue-700',
  manual: 'bg-gray-100 text-gray-700',
  contract: 'bg-purple-100 text-purple-700',
  ocr: 'bg-green-100 text-green-700',
};

export function AnnotationItem({ annotation, trackName }: AnnotationItemProps) {
  const SourceIcon = sourceIcons[annotation.source];

  return (
    <div className="card hover:shadow-md transition-all duration-200 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${sourceColors[annotation.source]}`}>
          <SourceIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sourceColors[annotation.source]}`}>
                {sourceLabels[annotation.source]}
              </span>
              {trackName && (
                <span className="text-xs text-studio-textMuted">
                  · {trackName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-studio-textMuted">
              <User className="w-3 h-3" />
              <span>{annotation.author}</span>
            </div>
          </div>

          <p className="text-studio-text text-sm leading-relaxed">
            {annotation.content}
          </p>

          {annotation.evidence && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-studio-textMuted">
              <span className="font-medium">证据：</span>
              {annotation.evidence.type === 'text' && annotation.evidence.reference}
              {annotation.evidence.type === 'image' && '（截图）'}
              {annotation.evidence.type === 'ocr' && `OCR：${annotation.evidence.reference}`}
            </div>
          )}

          <div className="mt-2 text-xs text-studio-textMuted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDateTimeShort(annotation.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}
