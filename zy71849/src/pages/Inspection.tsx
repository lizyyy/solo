import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store';
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  UserEdit,
  Download,
  FileText,
  User,
  Phone,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Share2,
  Check,
  RefreshCw,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import TraceSidebar from '@/components/TraceSidebar';
import { InspectionCategory, INSPECTION_CATEGORY_LABELS } from '@/types';
import { confirmInspectionItem, generateExportData } from '@/utils/inspectionGenerator';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export default function Inspection() {
  const { id } = useParams();
  const {
    inspectionItems,
    inspectionStats,
    currentProject,
    loadProjectData,
    generateInspection,
    selectRecord,
    selectedRecord,
    sightRecords,
    currentUser,
  } = useAppStore();

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<InspectionCategory | 'all'>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (id) {
      loadProjectData(id);
      if (inspectionItems.length === 0 && sightRecords.length > 0) {
        generateInspection(id);
      }
    }
  }, [id, loadProjectData, generateInspection, inspectionItems.length, sightRecords.length]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedItems(next);
  };

  const handleConfirm = async (itemId: string) => {
    await confirmInspectionItem(itemId, currentUser);
    if (id) {
      loadProjectData(id);
    }
  };

  const handleGenerateAgain = async () => {
    if (!id) return;
    setIsGenerating(true);
    await generateInspection(id);
    setIsGenerating(false);
  };

  const handleExportPDF = async () => {
    if (!id || !currentProject) return;

    const data = await generateExportData(id);

    const doc = new jsPDF();
    let yPosition = 20;

    doc.setFontSize(18);
    doc.text(currentProject.name, 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`导出时间：${new Date().toLocaleString('zh-CN')}`, 20, yPosition);
    yPosition += 5;
    doc.text(
      `总计：${data.summary.total} 条 | 已确认：${data.summary.confirmed} | 待补充：${data.summary.pending} | 人工修改：${data.summary.manual}`,
      20,
      yPosition
    );
    yPosition += 10;

    for (const category of data.categories) {
      if (category.items.length === 0) continue;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${category.label}（${category.items.length}条）`, 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      for (const item of category.items) {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.text(item.deviceName, 25, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'normal');
        const descriptionLines = doc.splitTextToSize(item.description, 160);
        doc.text(descriptionLines, 25, yPosition);
        yPosition += descriptionLines.length * 5;

        doc.setFont('helvetica', 'bold');
        doc.text('处理口径：', 25, yPosition);
        doc.setFont('helvetica', 'normal');
        const handlingLines = doc.splitTextToSize(item.handlingMethod, 140);
        doc.text(handlingLines, 55, yPosition);
        yPosition += handlingLines.length * 5;

        doc.setFont('helvetica', 'bold');
        doc.text('下一步：', 25, yPosition);
        doc.setFont('helvetica', 'normal');
        const nextStepLines = doc.splitTextToSize(item.nextStep, 140);
        doc.text(nextStepLines, 50, yPosition);
        yPosition += nextStepLines.length * 5;

        doc.text(
          `联系人：${item.contactPerson}（${item.contactRole}）`,
          25,
          yPosition
        );
        yPosition += 5;

        if (item.isConfirmed && item.confirmedBy) {
          doc.setTextColor(34, 197, 94);
          doc.text(
            `已确认：${item.confirmedBy} at ${item.confirmedAt?.toLocaleString('zh-CN')}`,
            25,
            yPosition
          );
          doc.setTextColor(0, 0, 0);
        } else {
          doc.setTextColor(245, 158, 11);
          doc.text('待确认', 25, yPosition);
          doc.setTextColor(0, 0, 0);
        }

        yPosition += 8;
        doc.setDrawColor(220);
        doc.line(20, yPosition - 3, 190, yPosition - 3);
      }

      yPosition += 5;
    }

    doc.save(`巡检单_${currentProject.name}_${new Date().toLocaleDateString('zh-CN')}.pdf`);
  };

  const handleExportExcel = async () => {
    if (!id || !currentProject) return;

    const data = await generateExportData(id);

    const wb = XLSX.utils.book_new();

    for (const category of data.categories) {
      const rows = category.items.map((item) => ({
        '设备名称': item.deviceName,
        '问题描述': item.description,
        '处理口径': item.handlingMethod,
        '下一步操作': item.nextStep,
        '联系人': item.contactPerson,
        '角色': item.contactRole,
        '状态': item.isConfirmed ? '已确认' : '待确认',
        '确认人': item.confirmedBy || '',
        '确认时间': item.confirmedAt?.toLocaleString('zh-CN') || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `${category.label}（${category.items.length}）`);
    }

    XLSX.writeFile(wb, `巡检单_${currentProject.name}_${new Date().toLocaleDateString('zh-CN')}.xlsx`);
  };

  const handleShare = () => {
    const shareId = Math.random().toString(36).substring(2, 10);
    localStorage.setItem(`inspection_share_${shareId}`, JSON.stringify({
      projectId: id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    const shareUrl = `${window.location.origin}/inspection/${shareId}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`共享链接已复制到剪贴板：\n${shareUrl}\n\n链接7天内有效`);
  };

  if (!id) return null;

  const tabs: Array<{ key: InspectionCategory | 'all'; label: string; color: string; count: number }> = [
    { key: 'all', label: '全部', color: 'bg-slate-100 text-slate-700', count: inspectionItems.length },
    {
      key: 'confirmed',
      label: '已确认',
      color: 'bg-green-100 text-green-700',
      count: inspectionStats?.confirmed || 0,
    },
    {
      key: 'pending-supplement',
      label: '待补充',
      color: 'bg-amber-100 text-amber-700',
      count: inspectionStats?.pending || 0,
    },
    {
      key: 'manual-modified',
      label: '人工改过',
      color: 'bg-red-100 text-red-700',
      count: inspectionStats?.manual || 0,
    },
  ];

  const filteredItems =
    activeTab === 'all'
      ? inspectionItems
      : inspectionItems.filter((i) => i.category === activeTab);

  const categoryConfig: Record<InspectionCategory, { icon: typeof CheckCircle2; bgColor: string; borderColor: string }> = {
    confirmed: { icon: CheckCircle2, bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    'pending-supplement': { icon: AlertTriangle, bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    'manual-modified': { icon: UserEdit, bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  };

  return (
    <div className="p-8 relative">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-serif text-2xl font-semibold text-slate-800 flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-amber-600" />
            巡检单
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="btn btn-secondary text-sm flex items-center gap-1"
            >
              <Share2 className="w-4 h-4" />
              生成共享链接
            </button>
            <button
              onClick={handleExportExcel}
              className="btn btn-secondary text-sm flex items-center gap-1"
            >
              <FileText className="w-4 h-4" />
              导出 Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="btn btn-primary text-sm flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              导出 PDF
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          查看分类巡检记录，每条记录附带处理口径，可导出给客户项目群
        </p>
      </div>

      {inspectionStats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="p-4">
              <p className="text-sm text-slate-500">总计</p>
              <p className="text-2xl font-semibold text-slate-800 mt-1">{inspectionStats.total}</p>
            </div>
          </div>
          <div className="card border-l-4 border-l-status-confirmed">
            <div className="p-4">
              <p className="text-sm text-slate-500">已确认</p>
              <p className="text-2xl font-semibold text-status-confirmed mt-1">
                {inspectionStats.confirmed}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {inspectionStats.confirmedCount}/{inspectionStats.confirmed} 已确认
              </p>
            </div>
          </div>
          <div className="card border-l-4 border-l-status-pending">
            <div className="p-4">
              <p className="text-sm text-slate-500">待补充</p>
              <p className="text-2xl font-semibold text-status-pending mt-1">
                {inspectionStats.pending}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {inspectionStats.pendingCount}/{inspectionStats.pending} 已确认
              </p>
            </div>
          </div>
          <div className="card border-l-4 border-l-status-manual">
            <div className="p-4">
              <p className="text-sm text-slate-500">人工修改</p>
              <p className="text-2xl font-semibold text-status-manual mt-1">
                {inspectionStats.manual}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {inspectionStats.manualCount}/{inspectionStats.manual} 已确认
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? `${tab.color} shadow-sm`
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerateAgain}
          disabled={isGenerating}
          className="btn btn-secondary text-sm flex items-center gap-1"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          重新生成
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredItems.map((item) => {
          const config = categoryConfig[item.category];
          const CategoryIcon = config.icon;
          const isExpanded = expandedItems.has(item.id);
          const record = sightRecords.find((r) => r.id === item.recordId);

          return (
            <div
              key={item.id}
              className={`card border ${config.borderColor} ${config.bgColor}/30 overflow-hidden`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${config.bgColor} ${config.borderColor} border flex items-center justify-center flex-shrink-0`}>
                      <CategoryIcon
                        className={`w-5 h-5 ${
                          item.category === 'confirmed'
                            ? 'text-status-confirmed'
                            : item.category === 'pending-supplement'
                            ? 'text-status-pending'
                            : 'text-status-manual'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={item.category} type="inspection" />
                        {record?.deviceCode && (
                          <span className="text-xs font-mono text-slate-500">
                            {record.deviceCode}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-slate-800">
                        {record?.deviceName || '未知设备'}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">{item.description}</p>

                      {isExpanded && (
                        <div className="mt-4 space-y-4 animate-fade-in">
                          <div className="bg-white rounded-lg border border-slate-200 p-4">
                            <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                              <FileText className="w-4 h-4" />
                              处理口径
                            </h4>
                            <p className="text-sm text-slate-600">{item.handlingMethod}</p>
                          </div>

                          <div className="bg-white rounded-lg border border-slate-200 p-4">
                            <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                              <ArrowRight className="w-4 h-4" />
                              下一步操作
                            </h4>
                            <p className="text-sm text-slate-600">{item.nextStep}</p>
                          </div>

                          <div className="bg-white rounded-lg border border-slate-200 p-4">
                            <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                              <Phone className="w-4 h-4" />
                              联系人
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <User className="w-4 h-4" />
                              <span className="font-medium">{item.contactPerson}</span>
                              <span className="text-slate-400">|</span>
                              <span>{item.contactRole}</span>
                            </div>
                          </div>

                          {item.isConfirmed && item.confirmedBy && (
                            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                              <div className="flex items-center gap-2 text-sm text-green-700">
                                <Check className="w-4 h-4" />
                                <span className="font-medium">已确认</span>
                                <span className="text-green-600">
                                  by {item.confirmedBy} at{' '}
                                  {item.confirmedAt?.toLocaleString('zh-CN')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!item.isConfirmed && (
                      <button
                        onClick={() => handleConfirm(item.id)}
                        className="btn btn-success text-xs flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        确认
                      </button>
                    )}
                    {record && (
                      <button
                        onClick={() => selectRecord(record)}
                        className="btn btn-secondary text-xs"
                      >
                        追溯
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="p-1.5 hover:bg-white/50 rounded-md transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {activeTab === 'all'
              ? '暂无巡检记录，请先运行视线分析'
              : `暂无${INSPECTION_CATEGORY_LABELS[activeTab as InspectionCategory]}的记录`}
          </p>
        </div>
      )}

      {selectedRecord && <TraceSidebar />}
    </div>
  );
}
