import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  FileCheck,
  FileSignature,
  Calendar,
  Phone,
  AlertTriangle,
  Building2,
  User,
  DollarSign,
  Clock,
  Edit3,
  Download,
} from 'lucide-react';
import Card from '@/components/Card';
import Loading from '@/components/Loading';
import ErrorState from '@/components/ErrorState';
import Tabs from '@/components/Tabs';
import Timeline from '@/components/Timeline';
import LinkGraphView from '@/components/LinkGraphView';
import Table from '@/components/Table';
import { CaseStatusBadge, RiskBadge, WriteOffBadge } from '@/components/StatusBadge';
import { caseService } from '@/services/caseService';
import { businessService } from '@/services/businessService';
import { formatMoney, formatDate } from '@/lib/utils';
import type {
  CaseDetail as CaseDetailType,
  LinkGraph,
  StateTransition,
  Repayment,
  CollectionNote,
  RiskReport,
  Invoice,
  Confirmation,
  FactoringContract,
  RepaymentPlan,
  LinkGraphNode,
} from '../../shared/types';
import {
  STATUS_LABELS,
  DATA_TYPE_LABELS,
} from '../../shared/types';

const DATA_TAB_ITEMS = [
  { key: 'invoice', label: '发票信息', icon: <FileText size={16} /> },
  { key: 'confirmation', label: '买方确认', icon: <FileCheck size={16} /> },
  { key: 'contract', label: '保理合同', icon: <FileSignature size={16} /> },
  { key: 'repayment_plan', label: '回款计划', icon: <Calendar size={16} /> },
  { key: 'collection', label: '催收记录', icon: <Phone size={16} /> },
  { key: 'risk', label: '风险报告', icon: <AlertTriangle size={16} /> },
];

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseDetailType | null>(null);
  const [linkGraph, setLinkGraph] = useState<LinkGraph | null>(null);
  const [activeDataTab, setActiveDataTab] = useState('invoice');
  const [selectedNode, setSelectedNode] = useState<LinkGraphNode | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const detailRes = await caseService.getCaseDetail(id);

      if (detailRes.success && detailRes.data) {
        setCaseData(detailRes.data);
        const graphRes = await businessService.getLinkGraph(detailRes.data.caseInfo.businessNo);
        if (graphRes.success && graphRes.data) {
          setLinkGraph(graphRes.data);
        }
      } else {
        setError(detailRes.message || '加载案件详情失败');
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleNodeClick = (node: LinkGraphNode) => {
    setSelectedNode(node);
    if (node.type === 'invoice') setActiveDataTab('invoice');
    else if (node.type === 'confirmation') setActiveDataTab('confirmation');
    else if (node.type === 'contract') setActiveDataTab('contract');
    else if (node.type === 'repayment_plan') setActiveDataTab('repayment_plan');
    else if (node.type === 'collection_note') setActiveDataTab('collection');
    else if (node.type === 'risk_report') setActiveDataTab('risk');
  };

  const getTransitionStatus = (
    type: StateTransition['transitionType']
  ): 'success' | 'warning' | 'error' => {
    if (type === 'normal') return 'success';
    if (type === 'reverse') return 'warning';
    return 'error';
  };

  const getTimelineItems = () => {
    if (!caseData) return [];
    return caseData.transitions.map((t) => ({
      id: t.id,
      title: `${STATUS_LABELS[t.fromStatus]} → ${STATUS_LABELS[t.toStatus]}`,
      description: t.reason,
      time: formatDate(t.timestamp),
      status: getTransitionStatus(t.transitionType),
      extra: (
        <div className="text-xs text-slate-500">
          <span>操作人: {t.operatorName}</span>
          {t.transitionType !== 'normal' && (
            <span className="ml-3 text-amber-600">
              影响范围: {t.impactScope}
            </span>
          )}
        </div>
      ),
    }));
  };

  const repaymentColumns: {
    key: string;
    title: string;
    render?: (row: Repayment, index: number) => React.ReactNode;
    dataIndex?: keyof Repayment;
  }[] = [
    {
      key: 'repaymentDate',
      title: '回款日期',
      render: (row: Repayment) => formatDate(row.repaymentDate),
    },
    {
      key: 'totalAmount',
      title: '回款金额',
      render: (row: Repayment) => formatMoney(row.totalAmount),
    },
    {
      key: 'principalPaid',
      title: '本金',
      render: (row: Repayment) => formatMoney(row.principalPaid),
    },
    {
      key: 'interestPaid',
      title: '利息',
      render: (row: Repayment) => formatMoney(row.interestPaid),
    },
    {
      key: 'penaltyPaid',
      title: '罚息',
      render: (row: Repayment) => formatMoney(row.penaltyPaid),
    },
    {
      key: 'payer',
      title: '付款方',
      dataIndex: 'payer',
    },
    {
      key: 'writeOffStatus',
      title: '核销状态',
      render: (row: Repayment) => <WriteOffBadge status={row.writeOffStatus} />,
    },
  ];

  const collectionColumns: {
    key: string;
    title: string;
    render?: (row: CollectionNote, index: number) => React.ReactNode;
    dataIndex?: keyof CollectionNote;
  }[] = [
    {
      key: 'collectionDate',
      title: '催收日期',
      render: (row: CollectionNote) => formatDate(row.collectionDate),
    },
    {
      key: 'collector',
      title: '催收人',
      dataIndex: 'collector',
    },
    {
      key: 'collectionMethod',
      title: '催收方式',
      render: (row: CollectionNote) => {
        const methodMap: Record<string, string> = {
          phone: '电话',
          email: '邮件',
          visit: '上门',
          legal: '法律',
          other: '其他',
        };
        return methodMap[row.collectionMethod] || row.collectionMethod;
      },
    },
    {
      key: 'contactPerson',
      title: '联系人',
      dataIndex: 'contactPerson',
    },
    {
      key: 'contactResult',
      title: '联系结果',
      render: (row: CollectionNote) => (
        <span className="max-w-[200px] truncate block" title={row.contactResult}>
          {row.contactResult}
        </span>
      ),
    },
    {
      key: 'nextAction',
      title: '下一步',
      render: (row: CollectionNote) => (
        <span className="max-w-[200px] truncate block" title={row.nextAction}>
          {row.nextAction}
        </span>
      ),
    },
    {
      key: 'followUpDate',
      title: '跟进日期',
      render: (row: CollectionNote) => formatDate(row.followUpDate),
    },
  ];

  const riskReportColumns: {
    key: string;
    title: string;
    render?: (row: RiskReport, index: number) => React.ReactNode;
    dataIndex?: keyof RiskReport;
  }[] = [
    {
      key: 'reportDate',
      title: '报告日期',
      render: (row: RiskReport) => formatDate(row.reportDate),
    },
    {
      key: 'riskLevel',
      title: '风险等级',
      render: (row: RiskReport) => <RiskBadge level={row.riskLevel} />,
    },
    {
      key: 'analyst',
      title: '分析员',
      dataIndex: 'analyst',
    },
    {
      key: 'keyFindings',
      title: '关键发现',
      render: (row: RiskReport) => (
        <span className="max-w-[300px] truncate block" title={row.keyFindings}>
          {row.keyFindings}
        </span>
      ),
    },
    {
      key: 'recommendations',
      title: '建议',
      render: (row: RiskReport) => (
        <span className="max-w-[300px] truncate block" title={row.recommendations}>
          {row.recommendations}
        </span>
      ),
    },
  ];

  const renderInvoiceDetail = (invoice: Invoice | null) => {
    if (!invoice) {
      return (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p>暂无发票数据</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <InfoItem label="发票编号" value={invoice.invoiceNo} />
        <InfoItem label="卖方名称" value={invoice.sellerName} />
        <InfoItem label="发票金额" value={formatMoney(invoice.amount)} />
        <InfoItem label="税额" value={formatMoney(invoice.taxAmount)} />
        <InfoItem label="开票日期" value={formatDate(invoice.issueDate)} />
        <InfoItem label="到期日期" value={formatDate(invoice.dueDate)} />
        <InfoItem label="货物描述" value={invoice.goodsDescription} />
        <InfoItem label="状态" value={invoice.status} />
        <InfoItem label="版本" value={`v${invoice.version}`} />
      </div>
    );
  };

  const renderConfirmationDetail = (confirmation: Confirmation | null) => {
    if (!confirmation) {
      return (
        <div className="text-center py-12 text-slate-500">
          <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p>暂无买方确认数据</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <InfoItem label="确认日期" value={formatDate(confirmation.confirmDate)} />
        <InfoItem label="确认金额" value={formatMoney(confirmation.confirmAmount)} />
        <InfoItem label="确认人" value={confirmation.confirmer} />
        <InfoItem
          label="货物已收"
          value={confirmation.goodsReceived ? '是' : '否'}
        />
        <InfoItem
          label="质量问题"
          value={confirmation.qualityIssue ? '是' : '否'}
        />
        {confirmation.qualityIssue && (
          <InfoItem
            label="问题描述"
            value={confirmation.qualityIssueDesc}
            className="lg:col-span-2"
          />
        )}
        <InfoItem
          label="是否撤回"
          value={confirmation.isWithdrawn ? '是' : '否'}
        />
        {confirmation.isWithdrawn && (
          <>
            <InfoItem label="撤回原因" value={confirmation.withdrawReason} />
            <InfoItem label="撤回日期" value={formatDate(confirmation.withdrawDate)} />
          </>
        )}
        <InfoItem label="状态" value={confirmation.status} />
        <InfoItem label="版本" value={`v${confirmation.version}`} />
      </div>
    );
  };

  const renderContractDetail = (contract: FactoringContract | null) => {
    if (!contract) {
      return (
        <div className="text-center py-12 text-slate-500">
          <FileSignature className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p>暂无保理合同数据</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <InfoItem label="合同编号" value={contract.contractNo} />
        <InfoItem label="保理费率" value={`${contract.factoringRate}%`} />
        <InfoItem
          label="融资金额"
          value={formatMoney(contract.financingAmount)}
        />
        <InfoItem label="开始日期" value={formatDate(contract.startDate)} />
        <InfoItem label="结束日期" value={formatDate(contract.endDate)} />
        <InfoItem label="状态" value={contract.status} />
        <InfoItem label="版本" value={`v${contract.version}`} />
      </div>
    );
  };

  const renderRepaymentPlanDetail = (plans: RepaymentPlan[]) => {
    if (plans.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p>暂无回款计划数据</p>
        </div>
      );
    }
    const columns: {
      key: string;
      title: string;
      render?: (row: RepaymentPlan, index: number) => React.ReactNode;
      dataIndex?: keyof RepaymentPlan;
    }[] = [
      { key: 'instalmentNo', title: '期数', dataIndex: 'instalmentNo' },
      {
        key: 'principal',
        title: '本金',
        render: (row: RepaymentPlan) => formatMoney(row.principal),
      },
      {
        key: 'interest',
        title: '利息',
        render: (row: RepaymentPlan) => formatMoney(row.interest),
      },
      {
        key: 'plannedDate',
        title: '计划日期',
        render: (row: RepaymentPlan) => formatDate(row.plannedDate),
      },
      { key: 'status', title: '状态', dataIndex: 'status' },
      { key: 'version', title: '版本', render: (row: RepaymentPlan) => `v${row.version}` },
    ];
    return <Table columns={columns} data={plans} />;
  };

  const renderDataTabContent = () => {
    if (!caseData) return null;

    switch (activeDataTab) {
      case 'invoice':
        return renderInvoiceDetail(caseData.invoice);
      case 'confirmation':
        return renderConfirmationDetail(caseData.confirmation);
      case 'contract':
        return renderContractDetail(caseData.contract);
      case 'repayment_plan':
        return renderRepaymentPlanDetail(caseData.repaymentPlans);
      case 'collection':
        return (
          <Table
            columns={collectionColumns}
            data={caseData.collectionNotes}

          />
        );
      case 'risk':
        return (
          <Table
            columns={riskReportColumns}
            data={caseData.riskReports}

          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loading size="lg" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <ErrorState
        message={error || '加载案件详情失败'}
        onRetry={loadData}
      />
    );
  }

  const { caseInfo } = caseData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>返回列表</span>
          </button>
          <div className="h-6 w-px bg-slate-300" />
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              案件详情 - {caseInfo.businessNo}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              创建于 {formatDate(caseInfo.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <Edit3 size={16} />
            编辑
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            <Download size={16} />
            导出报告
          </button>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 text-white border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 size={24} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">买方</p>
              <p className="text-base font-medium mt-1">{caseInfo.buyerName}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <User size={24} className="text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">卖方</p>
              <p className="text-base font-medium mt-1">{caseInfo.sellerName}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <DollarSign size={24} className="text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">
                票面金额 / 融资金额
              </p>
              <p className="text-base font-medium mt-1">
                {formatMoney(caseInfo.totalAmount)} /{' '}
                {formatMoney(caseInfo.financingAmount)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock size={24} className="text-rose-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">状态</p>
              <div className="flex items-center gap-3 mt-1">
                <CaseStatusBadge status={caseInfo.currentStatus} />
                <RiskBadge level={caseInfo.riskLevel} />
              </div>
              {caseInfo.overdueDays > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  逾期 {caseInfo.overdueDays} 天
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card
          title="关联图谱"
          subtitle="发票 → 确权 → 合同 → 回款 → 追偿"
          extra={
            selectedNode && (
              <span className="text-sm text-slate-500">
                已选中: {selectedNode.name}
              </span>
            )
          }
        >
          <LinkGraphView
            data={linkGraph || { nodes: [], links: [] }}
            onNodeClick={handleNodeClick}
            className="h-[400px]"
          />
        </Card>

        <Card title="状态流转时间线">
          <div className="max-h-[400px] overflow-y-auto pr-2">
            <Timeline items={getTimelineItems()} />
          </div>
        </Card>
      </div>

      <Card
        title="业务数据详情"
        subtitle="六类核心业务数据完整记录"
      >
        <Tabs
          items={DATA_TAB_ITEMS}
          activeKey={activeDataTab}
          onChange={setActiveDataTab}
        />
        <div className="pt-2">{renderDataTabContent()}</div>
      </Card>

      <Card
        title="回款记录"
        subtitle={`共 ${caseData.repayments.length} 条回款记录`}
      >
        <Table
          columns={repaymentColumns}
          data={caseData.repayments}
          
        />
      </Card>

      <Card
        title="催收记录"
        subtitle={`共 ${caseData.collectionNotes.length} 条催收记录`}
      >
        <Table
          columns={collectionColumns}
          data={caseData.collectionNotes}
        />
      </Card>

      <Card
        title="风险报告"
        subtitle={`共 ${caseData.riskReports.length} 份风险报告`}
      >
        <Table
          columns={riskReportColumns}
          data={caseData.riskReports}
        />
      </Card>
    </div>
  );
}

function InfoItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value || '-'}</p>
    </div>
  );
}
