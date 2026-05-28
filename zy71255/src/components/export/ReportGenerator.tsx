import { useMemo } from 'react';
import { useDataStore } from '@/store/useDataStore';
import Table from '@/components/ui/Table';
import type { Enterprise, Transaction, Gap, Issue } from '@/types';

interface ReportGeneratorProps {
  hidden?: boolean;
}

interface SummaryCardProps {
  label: string;
  value: string | number;
  color: string;
  icon: React.ReactNode;
}

function SummaryCard({ label, value, color, icon }: SummaryCardProps) {
  return (
    <div
      className="relative p-6 rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(135deg, ${color}20 0%, transparent 100%)`,
        }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-white/50 text-sm font-medium">{label}</div>
          <div
            className="text-3xl font-bold font-orbitron mt-2"
            style={{ color }}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
        </div>
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ReportGenerator({ hidden = false }: ReportGeneratorProps) {
  const { enterprises, transactions, gaps, issues } = useDataStore();

  const summary = useMemo(() => {
    const totalEnterprises = enterprises.length;
    const totalTransactions = transactions.length;
    const totalGapAmount = gaps.reduce((sum, g) => sum + g.gap, 0);
    const totalIssues = issues.length;

    return {
      totalEnterprises,
      totalTransactions,
      totalGapAmount,
      totalIssues,
    };
  }, [enterprises, transactions, gaps, issues]);

  const enterpriseRanking = useMemo(() => {
    return enterprises
      .map((e) => ({
        ...e,
        remainingQuota: e.totalQuota - e.usedQuota,
        utilizationRate: e.totalQuota > 0 ? (e.usedQuota / e.totalQuota) * 100 : 0,
      }))
      .sort((a, b) => b.totalQuota - a.totalQuota);
  }, [enterprises]);

  const transactionDetails = useMemo(() => {
    return transactions.map((tx) => {
      const fromEnterprise = enterprises.find((e) => e.id === tx.fromId);
      const toEnterprise = enterprises.find((e) => e.id === tx.toId);
      return {
        ...tx,
        fromEnterpriseName: fromEnterprise?.name || '未知企业',
        toEnterpriseName: toEnterprise?.name || '未知企业',
        totalValue: tx.amount * tx.price,
      };
    });
  }, [transactions, enterprises]);

  const gapAnalysis = useMemo(() => {
    return gaps
      .filter((g) => g.gap > 0)
      .map((g) => {
        const enterprise = enterprises.find((e) => e.id === g.enterpriseId);
        return {
          ...g,
          enterpriseName: enterprise?.name || '未知企业',
          gapRate: g.required > 0 ? (g.gap / g.required) * 100 : 0,
        };
      })
      .sort((a, b) => b.gap - a.gap);
  }, [gaps, enterprises]);

  const issueRecords = useMemo(() => {
    return issues.map((issue) => {
      const enterprise = enterprises.find((e) => e.id === issue.enterpriseId);
      return {
        ...issue,
        enterpriseName: enterprise?.name || '未知企业',
      };
    });
  }, [issues, enterprises]);

  const rankingColumns = [
    { key: 'rank', header: '排名', width: '80px', render: (_: unknown, __: unknown, index: number) => index + 1 },
    { key: 'name', header: '企业名称' },
    { key: 'industry', header: '所属行业' },
    { key: 'totalQuota', header: '总配额', sortable: true, render: (v: unknown) => Number(v).toLocaleString() },
    { key: 'usedQuota', header: '已使用', sortable: true, render: (v: unknown) => Number(v).toLocaleString() },
    { key: 'remainingQuota', header: '剩余额度', sortable: true, render: (v: unknown) => Number(v).toLocaleString() },
    {
      key: 'utilizationRate',
      header: '利用率',
      sortable: true,
      render: (v: unknown) => `${Number(v).toFixed(1)}%`,
    },
  ];

  const transactionColumns = [
    { key: 'id', header: '交易ID', width: '150px' },
    { key: 'date', header: '交易日期', width: '120px' },
    { key: 'fromEnterpriseName', header: '转出企业' },
    { key: 'toEnterpriseName', header: '转入企业' },
    { key: 'amount', header: '交易量', sortable: true, render: (v: unknown) => `${Number(v).toLocaleString()} 吨` },
    { key: 'price', header: '单价', sortable: true, render: (v: unknown) => `¥${Number(v).toFixed(2)}` },
    { key: 'totalValue', header: '总金额', sortable: true, render: (v: unknown) => `¥${Number(v).toLocaleString()}` },
  ];

  const gapColumns = [
    { key: 'enterpriseName', header: '企业名称' },
    { key: 'required', header: '应履约量', render: (v: unknown) => Number(v).toLocaleString() },
    { key: 'actual', header: '实际履约量', render: (v: unknown) => Number(v).toLocaleString() },
    { key: 'gap', header: '缺口量', sortable: true, render: (v: unknown) => <span className="text-accent-red">{Number(v).toLocaleString()}</span> },
    { key: 'gapRate', header: '缺口率', sortable: true, render: (v: unknown) => <span className="text-accent-red">{Number(v).toFixed(1)}%</span> },
    { key: 'periodId', header: '履约期' },
  ];

  const issueColumns = [
    {
      key: 'severity',
      header: '严重程度',
      width: '100px',
      render: (v: unknown) => {
        const colors: Record<string, string> = {
          high: 'bg-accent-red/20 text-accent-red',
          medium: 'bg-accent-yellow/20 text-accent-yellow',
          low: 'bg-accent-cyan/20 text-accent-cyan',
        };
        const labels: Record<string, string> = { high: '高', medium: '中', low: '低' };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${colors[String(v)]}`}>
            {labels[String(v)]}
          </span>
        );
      },
    },
    { key: 'type', header: '问题类型' },
    { key: 'enterpriseName', header: '关联企业' },
    { key: 'description', header: '问题描述' },
    {
      key: 'status',
      header: '状态',
      width: '100px',
      render: (v: unknown) => {
        const colors: Record<string, string> = {
          open: 'bg-accent-red/20 text-accent-red',
          explained: 'bg-accent-yellow/20 text-accent-yellow',
          fixed: 'bg-accent-green/20 text-accent-green',
        };
        const labels: Record<string, string> = { open: '待处理', explained: '已解释', fixed: '已修复' };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${colors[String(v)]}`}>
            {labels[String(v)]}
          </span>
        );
      },
    },
  ];

  if (hidden) {
    return (
      <div className="absolute left-[-9999px] top-[-9999px] w-[1200px]">
        <div className="bg-primary-400 p-8">
          <div className="mb-8 text-center border-b-2 border-accent-cyan pb-4">
            <h1 className="text-3xl font-bold font-orbitron text-white mb-2">碳交易流向分析报告</h1>
            <p className="text-white/60">生成时间: {new Date().toLocaleString('zh-CN')}</p>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <SummaryCard label="企业总数" value={summary.totalEnterprises} color="#00D4FF" icon={<div />} />
            <SummaryCard label="交易总数" value={summary.totalTransactions} color="#00FF9D" icon={<div />} />
            <SummaryCard label="缺口总量" value={summary.totalGapAmount.toLocaleString()} color="#FF6B6B" icon={<div />} />
            <SummaryCard label="问题总数" value={summary.totalIssues} color="#FFD93D" icon={<div />} />
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold font-orbitron text-white mb-4 pb-2 border-b border-white/10">
              企业配额排名
            </h2>
            <Table columns={rankingColumns} data={enterpriseRanking} rowKey="id" />
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold font-orbitron text-white mb-4 pb-2 border-b border-white/10">
              交易流水明细
            </h2>
            <Table columns={transactionColumns} data={transactionDetails} rowKey="id" />
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold font-orbitron text-white mb-4 pb-2 border-b border-white/10">
              缺口分析
            </h2>
            <Table columns={gapColumns} data={gapAnalysis} rowKey="id" />
          </div>

          <div>
            <h2 className="text-xl font-bold font-orbitron text-white mb-4 pb-2 border-b border-white/10">
              问题记录
            </h2>
            <Table columns={issueColumns} data={issueRecords} rowKey="id" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 text-center border-b border-white/10 pb-6">
        <h1 className="text-3xl font-bold font-orbitron text-white mb-2 tracking-wider">
          碳交易流向分析报告
        </h1>
        <p className="text-white/50">
          生成时间: {new Date().toLocaleString('zh-CN')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="企业总数"
          value={summary.totalEnterprises}
          color="#00D4FF"
          icon={<div className="w-6 h-6">🏢</div>}
        />
        <SummaryCard
          label="交易总数"
          value={summary.totalTransactions}
          color="#00FF9D"
          icon={<div className="w-6 h-6">📊</div>}
        />
        <SummaryCard
          label="缺口总量"
          value={summary.totalGapAmount.toLocaleString()}
          color="#FF6B6B"
          icon={<div className="w-6 h-6">⚠️</div>}
        />
        <SummaryCard
          label="问题总数"
          value={summary.totalIssues}
          color="#FFD93D"
          icon={<div className="w-6 h-6">🔍</div>}
        />
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-bold font-orbitron text-white mb-4 pb-2 border-b border-white/10">
            企业配额排名
          </h2>
          <Table columns={rankingColumns} data={enterpriseRanking} rowKey="id" />
        </section>

        <section>
          <h2 className="text-xl font-bold font-orbitron text-white mb-4 pb-2 border-b border-white/10">
            交易流水明细
          </h2>
          <Table columns={transactionColumns} data={transactionDetails} rowKey="id" />
        </section>

        <section>
          <h2 className="text-xl font-bold font-orbitron text-white mb-4 pb-2 border-b border-white/10">
            缺口分析
          </h2>
          <Table columns={gapColumns} data={gapAnalysis} rowKey="id" />
        </section>

        <section>
          <h2 className="text-xl font-bold font-orbitron text-white mb-4 pb-2 border-b border-white/10">
            问题记录
          </h2>
          <Table columns={issueColumns} data={issueRecords} rowKey="id" />
        </section>
      </div>
    </div>
  );
}
