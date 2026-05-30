import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBatchStore } from '@/store/batchStore';
import { ValidationError, MATERIAL_TYPE_LABELS, Severity, ErrorCategory } from '@/types';
import { AlertTriangle, AlertCircle, Info, FileText, ArrowRight, CheckCircle, ChevronDown, ChevronUp, Database, Download, XCircle } from 'lucide-react';

const ErrorDiagnosis: React.FC = () => {
  const { validationErrors, materials, currentBatch } = useBatchStore();
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<ErrorCategory | 'all'>('all');

  const getSeverityIcon = (severity: Severity) => {
    switch (severity) {
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: Severity) => {
    switch (severity) {
      case 'error': return <Badge variant="danger">错误</Badge>;
      case 'warning': return <Badge variant="warning">警告</Badge>;
      case 'info': return <Badge variant="info">提示</Badge>;
    }
  };

  const getCategoryLabel = (category: ErrorCategory) => {
    switch (category) {
      case 'tax': return '税费计算';
      case 'weight': return '权重闭合';
      case 'loss_offset': return '亏损抵扣';
      case 'data_integrity': return '数据完整性';
    }
  };

  const getMaterialForError = (materialId: string) => {
    return materials.find(m => m.id === materialId);
  };

  const filteredErrors = validationErrors.filter(e => {
    if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && e.category !== filterCategory) return false;
    return true;
  });

  const groupedErrors = {
    error: filteredErrors.filter(e => e.severity === 'error'),
    warning: filteredErrors.filter(e => e.severity === 'warning'),
    info: filteredErrors.filter(e => e.severity === 'info'),
  };

  const toggleError = (errorId: string) => {
    setExpandedError(expandedError === errorId ? null : errorId);
  };

  const renderErrorItem = (error: ValidationError) => {
    const material = getMaterialForError(error.materialId);
    const isExpanded = expandedError === error.id;

    return (
      <div 
        key={error.id}
        className={`border rounded-md mb-2 overflow-hidden transition-colors ${
          error.severity === 'error' ? 'border-red-500/30 bg-red-500/5' :
          error.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5' :
          'border-blue-500/30 bg-blue-500/5'
        }`}
      >
        <div 
          className="p-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
          onClick={() => toggleError(error.id)}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getSeverityIcon(error.severity)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getSeverityBadge(error.severity)}
                <Badge variant="secondary" size="sm">{getCategoryLabel(error.category)}</Badge>
                {material && (
                  <span className="text-xs text-slate-500">
                    {MATERIAL_TYPE_LABELS[material.type]} · {material.fileName}
                    {error.rowIndex !== undefined && ` · 第${error.rowIndex + 1}行`}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-300">{error.message}</div>
            </div>
            <div className="flex-shrink-0">
              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 pt-0 border-t border-slate-700/50 bg-slate-900/30">
            <div className="mt-3 grid grid-cols-2 gap-4">
              {error.currentValue !== undefined && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">当前值</div>
                  <div className="text-sm font-mono text-white bg-slate-800 rounded px-2 py-1">
                    {String(error.currentValue)}
                  </div>
                </div>
              )}
              {error.expectedValue !== undefined && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">期望值</div>
                  <div className="text-sm font-mono text-emerald-400 bg-slate-800 rounded px-2 py-1">
                    {String(error.expectedValue)}
                  </div>
                </div>
              )}
            </div>

            {error.fieldName && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">问题字段</div>
                <div className="text-sm font-mono text-slate-300">{error.fieldName}</div>
              </div>
            )}

            <div className="mt-3">
              <div className="text-xs text-slate-500 mb-1">修复建议</div>
              <div className="text-sm text-slate-300 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{error.fixSuggestion}</span>
              </div>
            </div>

            {error.requiredData && (
              <div className="mt-3 p-3 bg-slate-800/50 rounded-md">
                <div className="text-xs text-slate-500 mb-2">需要补充的数据格式</div>
                <div className="space-y-1 text-xs">
                  <div><span className="text-slate-400">说明：</span><span className="text-white">{error.requiredData.description}</span></div>
                  <div><span className="text-slate-400">格式：</span><span className="text-white font-mono">{error.requiredData.format}</span></div>
                  <div><span className="text-slate-400">示例：</span><span className="text-white font-mono">{error.requiredData.example}</span></div>
                </div>
              </div>
            )}

            {material && (
              <div className="mt-3 flex items-center gap-2">
                <Link to="/import">
                  <Button variant="secondary" size="sm">
                    <Database className="w-3 h-3 mr-1" />
                    查看原始材料
                  </Button>
                </Link>
                {error.rowIndex !== undefined && (
                  <span className="text-xs text-slate-500">
                    定位到 {MATERIAL_TYPE_LABELS[material.type]} 第 {error.rowIndex + 1} 行
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (validationErrors.length === 0) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">错误诊断</h1>
            <p className="mt-1 text-sm text-slate-400">
              查看数据校验问题、定位错误来源、获取修复建议
            </p>
          </div>
          <Card className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
            <h2 className="text-lg font-semibold text-white mb-2">数据校验通过</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              未发现任何数据问题，所有材料完整有效，可以进行再平衡计算。
            </p>
            <Link to="/configure">
              <Button variant="primary">
                开始计算 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">错误诊断</h1>
            <p className="mt-1 text-sm text-slate-400">
              批次号：{currentBatch?.id.slice(-8)} · 共发现 {validationErrors.length} 个问题
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/import">
              <Button variant="secondary">
                <FileText className="w-4 h-4 mr-2" />
                返回导入
              </Button>
            </Link>
            <Link to="/configure">
              <Button variant="primary" disabled={groupedErrors.error.length > 0}>
                继续计算 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className={`p-4 ${groupedErrors.error.length > 0 ? 'border-red-500/30' : ''}`}>
            <div className="flex items-center gap-3">
              <XCircle className={`w-8 h-8 ${groupedErrors.error.length > 0 ? 'text-red-500' : 'text-slate-600'}`} />
              <div>
                <div className="text-2xl font-bold text-white">{groupedErrors.error.length}</div>
                <div className="text-xs text-slate-500">严重错误</div>
              </div>
            </div>
          </Card>
          <Card className={`p-4 ${groupedErrors.warning.length > 0 ? 'border-amber-500/30' : ''}`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-8 h-8 ${groupedErrors.warning.length > 0 ? 'text-amber-500' : 'text-slate-600'}`} />
              <div>
                <div className="text-2xl font-bold text-white">{groupedErrors.warning.length}</div>
                <div className="text-xs text-slate-500">警告</div>
              </div>
            </div>
          </Card>
          <Card className={`p-4 ${groupedErrors.info.length > 0 ? 'border-blue-500/30' : ''}`}>
            <div className="flex items-center gap-3">
              <Info className={`w-8 h-8 ${groupedErrors.info.length > 0 ? 'text-blue-500' : 'text-slate-600'}`} />
              <div>
                <div className="text-2xl font-bold text-white">{groupedErrors.info.length}</div>
                <div className="text-xs text-slate-500">提示</div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-white">问题列表</h3>
            <div className="flex items-center gap-2">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as Severity | 'all')}
                className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-slate-600"
              >
                <option value="all">全部级别</option>
                <option value="error">仅错误</option>
                <option value="warning">仅警告</option>
                <option value="info">仅提示</option>
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as ErrorCategory | 'all')}
                className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-slate-600"
              >
                <option value="all">全部类别</option>
                <option value="tax">税费计算</option>
                <option value="weight">权重闭合</option>
                <option value="loss_offset">亏损抵扣</option>
                <option value="data_integrity">数据完整性</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {filteredErrors.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                没有符合筛选条件的问题
              </div>
            ) : (
              filteredErrors.map(error => renderErrorItem(error))
            )}
          </div>
        </Card>

        {groupedErrors.error.length > 0 && (
          <Card className="p-4 border-red-500/30 bg-red-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-red-400 mb-1">存在严重错误，无法继续计算</h3>
                <p className="text-sm text-slate-400">
                  请先修复上述 {groupedErrors.error.length} 个严重错误后，再进行再平衡优化计算。
                  警告和提示不影响计算，但可能影响结果准确性。
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default ErrorDiagnosis;
