import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle, X, ChevronDown, ChevronRight, Lightbulb, MapPin } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EvidenceDisplay } from './EvidenceDisplay';
import type { ValidationIssue } from '@/types';

interface IssueListProps {
  issues: ValidationIssue[];
  onResolve?: (issueId: string, note: string) => void;
}

const severityConfig = {
  error: {
    label: '错误',
    variant: 'error' as const,
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  warning: {
    label: '警告',
    variant: 'warning' as const,
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  info: {
    label: '提示',
    variant: 'info' as const,
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
};

const typeLabels: Record<string, string> = {
  boundary_error: '区间边界错误',
  tier_mismatch: '收益档位误套',
  early_termination_missing: '提前终止未处理',
  data_missing: '数据缺失',
  logic_conflict: '逻辑冲突',
};

export const IssueList: React.FC<IssueListProps> = ({ issues, onResolve }) => {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<ValidationIssue | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info' | 'resolved'>('all');

  const filteredIssues = issues.filter(issue => {
    if (filter === 'all') return !issue.resolved;
    if (filter === 'resolved') return issue.resolved;
    return issue.severity === filter && !issue.resolved;
  });

  const handleResolve = () => {
    if (resolveModal && resolveNote.trim()) {
      onResolve?.(resolveModal.id, resolveNote.trim());
      setResolveModal(null);
      setResolveNote('');
    }
  };

  const stats = {
    error: issues.filter(i => i.severity === 'error' && !i.resolved).length,
    warning: issues.filter(i => i.severity === 'warning' && !i.resolved).length,
    info: issues.filter(i => i.severity === 'info' && !i.resolved).length,
    resolved: issues.filter(i => i.resolved).length,
  };

  if (issues.length === 0) {
    return (
      <div className="text-center py-12 bg-green-50 rounded-lg border-2 border-dashed border-green-200">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-green-700">复核通过，未发现问题</p>
        <p className="text-xs text-green-500 mt-1">所有校验项均已通过，可以继续后续流程</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            全部
            <Badge variant="neutral" size="sm" className="ml-1">
              {issues.filter(i => !i.resolved).length}
            </Badge>
          </Button>
          <Button
            variant={filter === 'error' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('error')}
          >
            <AlertCircle className="w-4 h-4 mr-1 text-red-500" />
            错误
            <Badge variant="error" size="sm" className="ml-1">{stats.error}</Badge>
          </Button>
          <Button
            variant={filter === 'warning' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('warning')}
          >
            <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />
            警告
            <Badge variant="warning" size="sm" className="ml-1">{stats.warning}</Badge>
          </Button>
          <Button
            variant={filter === 'info' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('info')}
          >
            <Info className="w-4 h-4 mr-1 text-blue-500" />
            提示
            <Badge variant="info" size="sm" className="ml-1">{stats.info}</Badge>
          </Button>
          <Button
            variant={filter === 'resolved' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('resolved')}
          >
            <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
            已解决
            <Badge variant="success" size="sm" className="ml-1">{stats.resolved}</Badge>
          </Button>
        </div>
      </div>

      {filteredIssues.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">该分类下暂无问题</p>
        </div>
      ) : (
        <Table bordered>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-20">级别</TableHead>
              <TableHead className="w-32">类型</TableHead>
              <TableHead>问题描述</TableHead>
              <TableHead className="w-32">触发材料</TableHead>
              <TableHead className="w-32">卡住位置</TableHead>
              <TableHead className="text-right w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIssues.map((issue) => {
              const config = severityConfig[issue.severity];
              const Icon = config.icon;
              const isExpanded = expandedIssue === issue.id;

              return (
                <React.Fragment key={issue.id}>
                  <TableRow
                    className={issue.resolved ? 'bg-green-50/50' : config.bgColor}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6"
                        onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} dot>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700">{typeLabels[issue.type]}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <span className="text-sm font-medium text-gray-900">
                          {issue.description}
                        </span>
                        {issue.resolved && (
                          <Badge variant="success" size="sm">已解决</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center text-xs text-gray-500">
                        <MapPin className="w-3 h-3 mr-1" />
                        {issue.triggeredBy}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">{issue.blockedAt}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {!issue.resolved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setResolveModal(issue);
                            setResolveNote('');
                          }}
                        >
                          标记解决
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-white border-t-0">
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-yellow-50 rounded-lg">
                              <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 mb-1">
                                <Lightbulb className="w-4 h-4" />
                                修复建议
                              </div>
                              <p className="text-sm text-yellow-700">{issue.suggestion}</p>
                            </div>
                            {issue.resolved && issue.resolutionNote && (
                              <div className="p-3 bg-green-50 rounded-lg">
                                <div className="flex items-center gap-2 text-sm font-medium text-green-800 mb-1">
                                  <CheckCircle className="w-4 h-4" />
                                  解决说明
                                </div>
                                <p className="text-sm text-green-700">{issue.resolutionNote}</p>
                                <p className="text-xs text-green-600 mt-1">
                                  解决时间: {issue.resolvedAt && new Date(issue.resolvedAt).toLocaleString('zh-CN')}
                                </p>
                              </div>
                            )}
                          </div>
                          <EvidenceDisplay evidence={issue.evidence} title="证据链追踪" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Modal
        open={!!resolveModal}
        onClose={() => { setResolveModal(null); setResolveNote(''); }}
        title="标记问题已解决"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setResolveModal(null); setResolveNote(''); }}>
              取消
            </Button>
            <Button variant="primary" onClick={handleResolve} disabled={!resolveNote.trim()}>
              确认解决
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {resolveModal && (
            <>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-1">
                  {React.createElement(severityConfig[resolveModal.severity].icon, {
                    className: `w-4 h-4 ${severityConfig[resolveModal.severity].color}`,
                  })}
                  {resolveModal.description}
                </div>
                <p className="text-xs text-gray-500">
                  类型: {typeLabels[resolveModal.type]} | 卡住: {resolveModal.blockedAt}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  解决说明 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="请说明如何解决此问题..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  此说明将作为审计证据记录在操作日志中
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
IssueList.displayName = 'IssueList';
