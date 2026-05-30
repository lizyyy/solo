import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Download, FileText, Calendar, AlertCircle, CheckCircle, Clock, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Modal } from '@/components/ui/Modal';
import { useBatchStore } from '@/store/batchStore';
import { loadDemoData } from '@/mock/demoData';
import type { Batch, BatchStatus } from '@/types';

const statusLabels: Record<BatchStatus, { label: string; status: 'success' | 'warning' | 'error' | 'info' | 'pending' | 'processing' }> = {
  draft: { label: '草稿', status: 'pending' },
  importing: { label: '导入中', status: 'processing' },
  parsing: { label: '解析中', status: 'processing' },
  calculating: { label: '试算中', status: 'processing' },
  validating: { label: '校验中', status: 'processing' },
  has_issues: { label: '有问题', status: 'error' },
  ready: { label: '待确认', status: 'warning' },
  completed: { label: '已完成', status: 'success' },
  archived: { label: '已归档', status: 'info' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { batches, createBatch, filterBatches, isLoading } = useBatchStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BatchStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDemoButton, setShowDemoButton] = useState(true);

  useEffect(() => {
    setShowDemoButton(batches.length === 0);
  }, [batches.length]);

  const handleCreateBatch = () => {
    if (batchName.trim()) {
      const batch = createBatch(batchName.trim());
      setShowCreateModal(false);
      setBatchName('');
      navigate(`/batch/${batch.id}`);
    }
  };

  const handleLoadDemo = () => {
    loadDemoData();
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || batch.status === statusFilter;
    
    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && batch.createdAt >= new Date(dateFrom);
    }
    if (dateTo) {
      matchesDate = matchesDate && batch.createdAt <= new Date(dateTo + 'T23:59:59');
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const stats = {
    total: batches.length,
    hasIssues: batches.filter(b => b.status === 'has_issues').length,
    ready: batches.filter(b => b.status === 'ready').length,
    completed: batches.filter(b => b.status === 'completed').length,
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'draft', label: '草稿' },
    { value: 'has_issues', label: '有问题' },
    { value: 'ready', label: '待确认' },
    { value: 'completed', label: '已完成' },
    { value: 'archived', label: '已归档' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-800 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">结构性存款收益复核</h1>
                <p className="text-xs text-gray-500">Structured Deposit Return Review</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {showDemoButton && (
                <Button variant="outline" size="sm" onClick={handleLoadDemo}>
                  加载演示数据
                </Button>
              )}
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新建批次
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {showDemoButton && batches.length === 0 && (
          <div className="mb-6 p-6 bg-primary-50 border border-primary-200 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-primary-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary-900 mb-1">欢迎使用结构性存款收益复核系统</h3>
                <p className="text-sm text-primary-700 mb-4">
                  本系统旨在帮助银行理财经理准确复核结构性存款收益，避免人工计算时挂钩标的、观察区间填错等问题。
                  系统支持产品条款、客户持仓、标的价格三类材料分批导入，自动解析条款、档位试算、复核校验，并生成完整的证据链。
                </p>
                <div className="flex items-center gap-3">
                  <Button onClick={handleLoadDemo}>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    加载演示数据体验完整流程
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    新建复核批次
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">总批次</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">待处理问题</p>
                  <p className="text-2xl font-bold text-red-600">{stats.hasIssues}</p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">待确认</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.ready}</p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">已完成</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">复核批次列表</CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Input
                    placeholder="搜索批次名称..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                  />
                </div>
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as BatchStatus | '')}
                  className="w-32"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-gray-400">至</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setDateFrom('');
                  setDateTo('');
                }}>
                  <Filter className="w-4 h-4 mr-1" />
                  重置
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredBatches.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">暂无复核批次</p>
                <p className="text-xs text-gray-400 mt-1">点击右上角「新建批次」开始创建</p>
              </div>
            ) : (
              <Table bordered>
                <TableHeader>
                  <TableRow>
                    <TableHead>批次名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-center">问题数</TableHead>
                    <TableHead className="text-center">错误</TableHead>
                    <TableHead className="text-center">警告</TableHead>
                    <TableHead>版本</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => (
                    <TableRow
                      key={batch.id}
                      hover
                      className="cursor-pointer"
                      onClick={() => navigate(`/batch/${batch.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium text-gray-900">{batch.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{batch.id}</div>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator
                          status={statusLabels[batch.status].status}
                          label={statusLabels[batch.status].label}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono text-sm font-medium ${
                          batch.issueCount > 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {batch.issueCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono text-sm font-medium ${
                          batch.errorCount > 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {batch.errorCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono text-sm font-medium ${
                          batch.warningCount > 0 ? 'text-yellow-600' : 'text-gray-600'
                        }`}>
                          {batch.warningCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">v{batch.currentVersion}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">{formatDate(batch.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">{formatDate(batch.updatedAt)}</span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setBatchName(''); }}
        title="新建复核批次"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowCreateModal(false); setBatchName(''); }}>
              取消
            </Button>
            <Button variant="primary" onClick={handleCreateBatch} disabled={!batchName.trim()}>
              创建批次
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              批次名称 <span className="text-red-500">*</span>
            </label>
            <Input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="例如：2024年Q4结构性存款收益复核"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              建议按「季度+产品类型+复核」的格式命名，便于后续检索
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
            <p className="font-medium mb-1">创建后您可以：</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>导入产品条款、客户持仓、标的价格三类材料</li>
              <li>系统自动解析条款并进行档位试算</li>
              <li>复核校验区间边界、收益档位、提前终止等问题</li>
              <li>生成兑付方案并导出完整报告</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}
