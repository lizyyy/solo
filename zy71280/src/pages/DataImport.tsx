import React, { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Database, Upload, Trash2, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useAuctionStore } from '../store/useAuctionStore';
import { DataTable } from '../components/DataTable';
import { FileUpload, CSVTemplateDownload } from '../components/FileUpload';
import { MetricCard } from '../components/MetricCard';
import { parseCSVFiles } from '../utils/csvParser';
import { formatCurrency, formatDate, formatBidType } from '../utils/formatters';
import type { AuctionItem, BidRecord, TransactionRecord, UnsoldRecord } from '../types/auction';
import { cn } from '@/lib/utils';

const DataImport: React.FC = () => {
  const {
    items,
    bids,
    transactions,
    unsolds,
    validationResult,
    selectedItemId,
    setSelectedItemId,
    loadSampleData,
    setUploadedData,
    clearData,
  } = useAuctionStore();

  const [uploadedFiles, setUploadedFiles] = useState<{
    items?: File;
    bids?: File;
    transactions?: File;
    unsolds?: File;
  }>({});
  const [activeDataTab, setActiveDataTab] = useState<'items' | 'bids' | 'transactions' | 'unsolds'>('items');

  const handleFileSelect = (type: keyof typeof uploadedFiles, file: File) => {
    if (!file.name) {
      setUploadedFiles(prev => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
      return;
    }
    setUploadedFiles(prev => ({ ...prev, [type]: file }));
  };

  const handleUpload = async () => {
    const data = await parseCSVFiles(uploadedFiles);
    setUploadedData(data);
  };

  const itemColumns = useMemo<ColumnDef<AuctionItem, unknown>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.getValue('id')}</span>,
      },
      {
        accessorKey: 'name',
        header: '拍品名称',
        cell: ({ row }) => (
          <span className={cn(
            'font-medium',
            row.original.id === selectedItemId ? 'text-amber-600' : 'text-slate-900'
          )}>{row.getValue('name')}</span>
        ),
      },
      {
        accessorKey: 'category',
        header: '品类',
      },
      {
        accessorKey: 'appraisedValue',
        header: '估值',
        cell: ({ row }) => <span className="font-mono">{formatCurrency(row.getValue('appraisedValue'))}</span>,
      },
      {
        accessorKey: 'condition',
        header: '品相',
      },
      {
        accessorKey: 'appraiser',
        header: '估值机构',
        cell: ({ row }) => <span className="text-slate-500">{row.getValue('appraiser') || '-'}</span>,
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItemId(row.original.id);
            }}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              row.original.id === selectedItemId
                ? 'bg-slate-800 text-amber-400'
                : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700'
            )}
          >
            {row.original.id === selectedItemId ? '已选择' : '选择分析'}
          </button>
        ),
      },
    ],
    [selectedItemId, setSelectedItemId]
  );

  const bidColumns = useMemo<ColumnDef<BidRecord, unknown>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.getValue('id')}</span>,
      },
      {
        accessorKey: 'itemId',
        header: '拍品ID',
        cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.getValue('itemId')}</span>,
      },
      {
        accessorKey: 'buyerName',
        header: '买家',
      },
      {
        accessorKey: 'bidAmount',
        header: '出价金额',
        cell: ({ row }) => <span className="font-mono">{formatCurrency(row.getValue('bidAmount'))}</span>,
      },
      {
        accessorKey: 'bidDate',
        header: '出价日期',
        cell: ({ row }) => formatDate(row.getValue('bidDate')),
      },
      {
        accessorKey: 'bidType',
        header: '出价方式',
        cell: ({ row }) => formatBidType(row.getValue('bidType')),
      },
      {
        accessorKey: 'buyerActivity',
        header: '活跃度',
        cell: ({ row }) => {
          const activity = row.getValue('buyerActivity') as number;
          return (
            <span className={cn(
              'px-2 py-0.5 text-xs rounded',
              activity >= 8 ? 'bg-emerald-100 text-emerald-700' :
              activity >= 5 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            )}>
              {activity}/10
            </span>
          );
        },
      },
      {
        accessorKey: 'isWinning',
        header: '是否中标',
        cell: ({ row }) => (
          row.getValue('isWinning') ? (
            <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded">是</span>
          ) : (
            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">否</span>
          )
        ),
      },
    ],
    []
  );

  const transactionColumns = useMemo<ColumnDef<TransactionRecord, unknown>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.getValue('id')}</span>,
      },
      {
        accessorKey: 'itemName',
        header: '拍品名称',
      },
      {
        accessorKey: 'salePrice',
        header: '成交价',
        cell: ({ row }) => <span className="font-mono font-medium text-emerald-600">{formatCurrency(row.getValue('salePrice'))}</span>,
      },
      {
        accessorKey: 'reservePrice',
        header: '保留价',
        cell: ({ row }) => <span className="font-mono">{formatCurrency(row.getValue('reservePrice'))}</span>,
      },
      {
        accessorKey: 'saleDate',
        header: '成交日期',
        cell: ({ row }) => formatDate(row.getValue('saleDate')),
      },
      {
        accessorKey: 'commissionRate',
        header: '佣金比例',
        cell: ({ row }) => `${row.getValue('commissionRate')}%`,
      },
      {
        accessorKey: 'commissionAmount',
        header: '佣金金额',
        cell: ({ row }) => <span className="font-mono text-amber-600">{formatCurrency(row.getValue('commissionAmount'))}</span>,
      },
      {
        accessorKey: 'auctionHouse',
        header: '拍卖行',
      },
    ],
    []
  );

  const unsoldColumns = useMemo<ColumnDef<UnsoldRecord, unknown>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.getValue('id')}</span>,
      },
      {
        accessorKey: 'itemName',
        header: '拍品名称',
      },
      {
        accessorKey: 'appraisedValue',
        header: '估值',
        cell: ({ row }) => <span className="font-mono">{formatCurrency(row.getValue('appraisedValue'))}</span>,
      },
      {
        accessorKey: 'reservePrice',
        header: '保留价',
        cell: ({ row }) => <span className="font-mono">{formatCurrency(row.getValue('reservePrice'))}</span>,
      },
      {
        accessorKey: 'highestBid',
        header: '最高出价',
        cell: ({ row }) => <span className="font-mono text-red-600">{formatCurrency(row.getValue('highestBid'))}</span>,
      },
      {
        accessorKey: 'reason',
        header: '流拍原因',
        cell: ({ row }) => (
          <span className="px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded">{row.getValue('reason')}</span>
        ),
      },
      {
        accessorKey: 'reAuctionCount',
        header: '重拍次数',
        cell: ({ row }) => {
          const count = row.getValue('reAuctionCount') as number;
          return (
            <span className={cn(
              'px-2 py-0.5 text-xs rounded',
              count >= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            )}>
              {count}次
            </span>
          );
        },
      },
      {
        id: 'totalCost',
        header: '总成本',
        cell: ({ row }) => {
          const total = (row.original.storageCost || 0) + (row.original.marketingCost || 0) + (row.original.opportunityCost || 0);
          return <span className={cn(
            'font-mono',
            total === 0 ? 'text-slate-400' : 'text-red-600'
          )}>{total > 0 ? formatCurrency(total) : '未记录'}</span>;
        },
      },
    ],
    []
  );

  const tabData = {
    items: { columns: itemColumns, data: items },
    bids: { columns: bidColumns, data: bids },
    transactions: { columns: transactionColumns, data: transactions },
    unsolds: { columns: unsoldColumns, data: unsolds },
  };

  const hasData = items.length > 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            数据导入
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            加载样例数据或上传CSV文件，查看数据预览和校验结果
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadSampleData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-amber-400 rounded-md hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <Database className="w-4 h-4" />
            加载样例数据
          </button>
          {hasData && (
            <button
              onClick={clearData}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              清空数据
            </button>
          )}
        </div>
      </div>

      {!hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-md border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-500" />
              上传CSV数据
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUpload
                  label="拍品信息 *"
                  onFileSelect={(f) => handleFileSelect('items', f)}
                  selectedFileName={uploadedFiles.items?.name}
                />
                <FileUpload
                  label="买家出价记录"
                  onFileSelect={(f) => handleFileSelect('bids', f)}
                  selectedFileName={uploadedFiles.bids?.name}
                />
                <FileUpload
                  label="历史成交记录"
                  onFileSelect={(f) => handleFileSelect('transactions', f)}
                  selectedFileName={uploadedFiles.transactions?.name}
                />
                <FileUpload
                  label="流拍记录"
                  onFileSelect={(f) => handleFileSelect('unsolds', f)}
                  selectedFileName={uploadedFiles.unsolds?.name}
                />
              </div>
              <div className="flex flex-wrap gap-3 justify-end pt-2 border-t border-slate-100">
                <CSVTemplateDownload type="items" label="拍品" />
                <CSVTemplateDownload type="bids" label="出价" />
                <CSVTemplateDownload type="transactions" label="成交" />
                <CSVTemplateDownload type="unsolds" label="流拍" />
              </div>
              <button
                onClick={handleUpload}
                disabled={!uploadedFiles.items}
                className={cn(
                  'w-full py-2.5 rounded-md font-medium text-sm transition-colors',
                  uploadedFiles.items
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                导入数据
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-amber-50 rounded-md border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-500" />
              快速开始
            </h2>
            <div className="space-y-3 text-sm text-slate-600">
              <p>1. 点击左上角 <span className="font-semibold text-amber-600">"加载样例数据"</span> 按钮</p>
              <p>2. 系统将加载预置的真实拍卖数据样例</p>
              <p>3. 样例数据包含：</p>
              <ul className="ml-4 space-y-1 text-slate-500">
                <li>• 5件拍品信息（瓷器、书画、玉器等）</li>
                <li>• 24条买家出价记录（含活跃度评分）</li>
                <li>• 20条历史成交记录（含佣金）</li>
                <li>• 8条流拍记录（含成本明细）</li>
              </ul>
              <p className="pt-3 border-t border-slate-200">
                或点击 <span className="font-semibold text-amber-600">"下载模板"</span>，按格式整理您的真实数据后上传。
              </p>
            </div>
          </div>
        </div>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="拍品数量"
              value={validationResult?.recordCounts.items || 0}
              subtitle={selectedItemId ? `已选择: ${items.find(i => i.id === selectedItemId)?.name}` : '请选择分析拍品'}
              className={selectedItemId ? 'ring-2 ring-amber-400' : ''}
            />
            <MetricCard
              title="出价记录"
              value={validationResult?.recordCounts.bids || 0}
              subtitle={`${new Set(bids.map(b => b.buyerId)).size}位买家`}
            />
            <MetricCard
              title="成交记录"
              value={validationResult?.recordCounts.transactions || 0}
              subtitle={`${transactions.length > 0 ? formatCurrency(transactions.reduce((sum, t) => sum + t.salePrice, 0) / transactions.length) : '-'}均价`}
            />
            <MetricCard
              title="流拍记录"
              value={validationResult?.recordCounts.unsolds || 0}
              subtitle={`${unsolds.filter(u => u.reAuctionCount >= 2).length}件多次流拍`}
            />
          </div>

          {validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
            <div className="space-y-2">
              {validationResult.errors.map((error, i) => (
                <div key={`err-${i}`} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              ))}
              {validationResult.warnings.map((warning, i) => (
                <div key={`warn-${i}`} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">{warning}</p>
                </div>
              ))}
              {validationResult.errors.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-700">数据校验通过，记录完整</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-md border border-slate-200 shadow-sm">
            <div className="border-b border-slate-200">
              <nav className="flex">
                {(['items', 'bids', 'transactions', 'unsolds'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDataTab(tab)}
                    className={cn(
                      'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                      activeDataTab === tab
                        ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    )}
                  >
                    {tab === 'items' ? '拍品信息' : tab === 'bids' ? '出价记录' : tab === 'transactions' ? '成交记录' : '流拍记录'}
                    <span className="ml-2 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                      {tabData[tab].data.length}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
            <div className="p-4">
              <DataTable
                columns={tabData[activeDataTab].columns as ColumnDef<unknown, unknown>[]}
                data={tabData[activeDataTab].data}
                highlightRow={(row) => (row as AuctionItem).id === selectedItemId}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DataImport;
