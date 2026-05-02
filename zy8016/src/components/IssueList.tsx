import React, { useState, useMemo } from 'react';
import { 
  BudgetIssue, 
  BudgetIssueType,
  ParsedRequest,
  ResourceType,
} from '@/types';
import { formatBytes, formatMilliseconds } from '@/utils/harParser';
import { 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  X,
  ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';

interface IssueListProps {
  issues: BudgetIssue[];
  onRequestSelect?: (request: ParsedRequest) => void;
}

const issueTypeNames: Record<BudgetIssueType, string> = {
  total_requests: '总请求数超出',
  total_size: '总资源大小超出',
  resource_type_count: '资源类型数量超出',
  resource_type_size: '资源类型大小超出',
  third_party_count: '第三方资源数量超出',
  third_party_size: '第三方资源大小超出',
  cache_miss_rate: '缓存未命中率过高',
  duplicate_request: '重复请求',
  missing_timing: '缺少Timing数据',
  large_resource: '大资源文件',
  slow_resource: '慢速资源',
};

const resourceTypeNames: Record<ResourceType, string> = {
  document: '文档',
  stylesheet: '样式表',
  script: '脚本',
  image: '图片',
  font: '字体',
  media: '媒体',
  xhr: 'XHR',
  fetch: 'Fetch',
  websocket: 'WebSocket',
  other: '其他',
};

const SeverityIcon: React.FC<{ severity: BudgetIssue['severity'] }> = ({ severity }) => {
  switch (severity) {
    case 'error':
      return <AlertCircle className="text-red-500" size={20} />;
    case 'warning':
      return <AlertTriangle className="text-yellow-500" size={20} />;
    case 'info':
      return <Info className="text-blue-500" size={20} />;
    default:
      return null;
  }
};

const IssueItem: React.FC<{
  issue: BudgetIssue;
  onRequestSelect?: (request: ParsedRequest) => void;
}> = ({ issue, onRequestSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasRequests = issue.requests && issue.requests.length > 0;

  const formatValue = (value: number | undefined, type?: BudgetIssueType): string => {
    if (value === undefined) return '-';
    
    if (type?.includes('size') || type === 'large_resource') {
      return formatBytes(value);
    }
    if (type?.includes('time') || type === 'slow_resource') {
      return formatMilliseconds(value);
    }
    if (type === 'cache_miss_rate') {
      return `${value.toFixed(2)}%`;
    }
    return value.toString();
  };

  return (
    <div className={clsx(
      "border rounded-lg overflow-hidden transition-colors",
      issue.severity === 'error' && "border-red-200 bg-red-50/50",
      issue.severity === 'warning' && "border-yellow-200 bg-yellow-50/50",
      issue.severity === 'info' && "border-blue-200 bg-blue-50/50",
    )}>
      <button
        onClick={() => hasRequests && setIsExpanded(!isExpanded)}
        className={clsx(
          "w-full p-4 text-left flex items-start gap-3",
          hasRequests && "hover:bg-white/50 cursor-pointer"
        )}
      >
        <div className="mt-0.5">
          <SeverityIcon severity={issue.severity} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-800">{issue.title}</h4>
            <span className={clsx(
              "px-2 py-0.5 rounded text-xs font-medium",
              issue.severity === 'error' && "bg-red-100 text-red-800",
              issue.severity === 'warning' && "bg-yellow-100 text-yellow-800",
              issue.severity === 'info' && "bg-blue-100 text-blue-800",
            )}>
              {issue.type === 'error' ? '错误' : issue.type === 'warning' ? '警告' : '信息'}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
          
          {issue.threshold !== undefined && issue.actual !== undefined && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">阈值:</span>
                <span className="font-mono text-gray-800">
                  {formatValue(issue.threshold, issue.type)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">实际:</span>
                <span className={clsx(
                  "font-mono font-medium",
                  issue.severity === 'error' && "text-red-600",
                  issue.severity === 'warning' && "text-yellow-600",
                )}>
                  {formatValue(issue.actual, issue.type)}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {hasRequests && (
          <div className="mt-0.5 text-gray-400">
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>
        )}
      </button>
      
      {isExpanded && hasRequests && issue.requests && (
        <div className="border-t bg-white/50 p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">
            相关请求 ({issue.requests.length})
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {issue.requests.map((req, idx) => (
              <div
                key={idx}
                onClick={() => onRequestSelect?.(req)}
                className={clsx(
                  "p-2 rounded text-sm flex items-center justify-between gap-2",
                  onRequestSelect && "hover:bg-gray-100 cursor-pointer"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={clsx(
                      "px-1.5 py-0.5 rounded text-xs font-mono",
                      req.status >= 200 && req.status < 300 
                        ? "bg-green-100 text-green-800" 
                        : req.status >= 400 
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    )}>
                      {req.status}
                    </span>
                    <span className="font-medium text-gray-700">{req.method}</span>
                    <span className="text-xs text-gray-500">
                      {resourceTypeNames[req.resourceType]}
                    </span>
                  </div>
                  <div className="text-gray-600 truncate font-mono text-xs">
                    {req.url}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 flex flex-col gap-0.5">
                  <span>{formatBytes(req.transferSize)}</span>
                  <span>{formatMilliseconds(req.totalTime)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const IssueList: React.FC<IssueListProps> = ({ issues, onRequestSelect }) => {
  const [filterSeverity, setFilterSeverity] = useState<Set<BudgetIssue['severity']>>(new Set());
  
  const groupedIssues = useMemo(() => {
    const errors: BudgetIssue[] = [];
    const warnings: BudgetIssue[] = [];
    const infos: BudgetIssue[] = [];
    
    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          errors.push(issue);
          break;
        case 'warning':
          warnings.push(issue);
          break;
        case 'info':
          infos.push(issue);
          break;
      }
    }
    
    return { errors, warnings, infos };
  }, [issues]);
  
  const filteredIssues = useMemo(() => {
    if (filterSeverity.size === 0) {
      return issues;
    }
    return issues.filter(issue => filterSeverity.has(issue.severity));
  }, [issues, filterSeverity]);

  const toggleFilter = (severity: BudgetIssue['severity']) => {
    setFilterSeverity(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilterSeverity(new Set());
  };

  if (issues.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-green-500 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-800 mb-2">所有检查通过</h3>
        <p className="text-gray-500">页面性能符合预算要求，没有发现问题。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">性能问题</h3>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle size={16} />
              {groupedIssues.errors.length} 错误
            </span>
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle size={16} />
              {groupedIssues.warnings.length} 警告
            </span>
            <span className="flex items-center gap-1 text-blue-600">
              <Info size={16} />
              {groupedIssues.infos.length} 信息
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {filterSeverity.size > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <X size={14} />
              清除筛选
            </button>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => toggleFilter('error')}
          className={clsx(
            "px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition-colors",
            filterSeverity.has('error')
              ? "bg-red-500 text-white"
              : "bg-red-100 text-red-800 hover:bg-red-200"
          )}
        >
          <AlertCircle size={14} />
          错误 ({groupedIssues.errors.length})
        </button>
        <button
          onClick={() => toggleFilter('warning')}
          className={clsx(
            "px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition-colors",
            filterSeverity.has('warning')
              ? "bg-yellow-500 text-white"
              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
          )}
        >
          <AlertTriangle size={14} />
          警告 ({groupedIssues.warnings.length})
        </button>
        <button
          onClick={() => toggleFilter('info')}
          className={clsx(
            "px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition-colors",
            filterSeverity.has('info')
              ? "bg-blue-500 text-white"
              : "bg-blue-100 text-blue-800 hover:bg-blue-200"
          )}
        >
          <Info size={14} />
          信息 ({groupedIssues.infos.length})
        </button>
      </div>
      
      <div className="space-y-3">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            没有符合筛选条件的问题
          </div>
        ) : (
          filteredIssues.map((issue, idx) => (
            <IssueItem 
              key={idx} 
              issue={issue} 
              onRequestSelect={onRequestSelect}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default IssueList;
