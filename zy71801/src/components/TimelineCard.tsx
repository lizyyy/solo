import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Receipt, 
  Image, 
  Mail, 
  Edit3, 
  Copy, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  User
} from 'lucide-react';
import type { AllEvidence } from '../types';

interface TimelineCardProps {
  evidence: AllEvidence;
  isFirst?: boolean;
  isLast?: boolean;
}

const typeConfig = {
  transaction: {
    icon: Receipt,
    color: 'bg-blue-500',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50'
  },
  screenshot: {
    icon: Image,
    color: 'bg-green-500',
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50'
  },
  email: {
    icon: Mail,
    color: 'bg-purple-500',
    borderColor: 'border-purple-200',
    bgColor: 'bg-purple-50'
  },
  correction: {
    icon: Edit3,
    color: 'bg-orange-500',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50'
  }
};

export function TimelineCard({ evidence, isFirst = false, isLast = false }: TimelineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[evidence.type];
  const Icon = config.icon;

  const getBadges = () => {
    const badges = [];
    if (evidence.isDuplicate) {
      badges.push({ label: '重复', icon: Copy, color: 'bg-yellow-100 text-yellow-700' });
    }
    if (evidence.isLate) {
      badges.push({ label: '晚到', icon: Clock, color: 'bg-red-100 text-red-700' });
    }
    if (evidence.isCorrection) {
      badges.push({ label: '更正', icon: Edit3, color: 'bg-orange-100 text-orange-700' });
    }
    return badges;
  };

  const badges = getBadges();

  const renderDetails = () => {
    switch (evidence.type) {
      case 'transaction':
        return (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">交易编号</span>
              <span className="font-mono">{evidence.transactionNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">交易金额</span>
              <span className="font-semibold text-danger-600">
                ¥{evidence.amount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">交易对手</span>
              <span>{evidence.counterparty}</span>
            </div>
          </div>
        );
      case 'screenshot':
        return (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">文件名</span>
              <span className="font-mono">{evidence.filename}</span>
            </div>
            {evidence.approver && (
              <div className="flex justify-between">
                <span className="text-gray-500">审批人</span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {evidence.approver}
                </span>
              </div>
            )}
            <div className="mt-3">
              <img 
                src={evidence.imageUrl} 
                alt={evidence.title}
                className="w-full h-32 object-cover rounded border"
              />
            </div>
          </div>
        );
      case 'email':
        return (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">发件人</span>
              <span>{evidence.from}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">收件人</span>
              <span>{evidence.to.join(', ')}</span>
            </div>
            <div className="mt-3 p-3 bg-white rounded border">
              <p className="text-gray-700 text-sm leading-relaxed">
                {evidence.content}
              </p>
            </div>
            {evidence.attachments.length > 0 && (
              <div className="mt-2">
                <span className="text-gray-500 text-xs">附件：</span>
                <span className="text-xs ml-1">{evidence.attachments.join(', ')}</span>
              </div>
            )}
          </div>
        );
      case 'correction':
        return (
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">更正类型</span>
              <span className="capitalize">{evidence.correctionType}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded border">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">更正前</div>
                <div className="font-mono text-danger-600 line-through">
                  {evidence.beforeValue}
                </div>
              </div>
              <div className="text-gray-400">→</div>
              <div className="flex-1 text-right">
                <div className="text-xs text-gray-500 mb-1">更正后</div>
                <div className="font-mono text-success-600">
                  {evidence.afterValue}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">操作人</span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {evidence.operator}
              </span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative pl-10 pb-6">
      {!isFirst && (
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      )}
      
      <div className={`timeline-dot ${config.color}`} style={{ top: '4px' }} />
      
      <div className={`border rounded-lg p-4 ${config.bgColor} ${config.borderColor} card-hover`}>
        <div 
          className="cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-900">{evidence.title}</span>
                {badges.map((badge, idx) => (
                  <span 
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${badge.color}`}
                  >
                    <badge.icon className="w-3 h-3" />
                    {badge.label}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-600">{evidence.description}</p>
              <div className="mt-2 text-xs text-gray-400">
                {format(new Date(evidence.timestamp), 'yyyy-MM-dd HH:mm')}
                <span className="mx-2">·</span>
                来源：{evidence.source}
              </div>
            </div>
            <div className="ml-2">
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>
        
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            {renderDetails()}
          </div>
        )}
      </div>
    </div>
  );
}
