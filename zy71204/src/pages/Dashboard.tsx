import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  FileCheck, 
  Clock, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import useBillStore, { useDashboardStats } from '@/store/useBillStore';
import { getStatusLabel, getStatusColorClass } from '@/services/billStateMachine';
import { getRiskScore, getMaturityWarningLevel, getMaturityWarningText } from '@/services/occupancyCalculator';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function Dashboard() {
  const navigate = useNavigate();
  const stats = useDashboardStats();
  const bills = useBillStore(state => state.bills);
  const validBills = bills.filter(b => !b.isDirty);
  
  const statusChartOption = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    validBills.forEach(b => {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    });
    
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: '5%', left: 'center' },
      series: [{
        name: '票据状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: Object.entries(statusCounts).map(([status, count]) => ({
          value: count,
          name: getStatusLabel(status as any),
          itemStyle: { color: getComputedStyle(document.documentElement)
            .getPropertyValue(`--tw-bg-status-${status}`).trim() || '#64748b' }
        }))
      }]
    };
  }, [validBills]);

  const maturityChartOption = useMemo(() => {
    const monthCounts: Record<string, number> = {};
    validBills
      .filter(b => b.status !== 'released' && b.status !== 'closed')
      .forEach(b => {
        const month = format(new Date(b.maturityDate), 'yyyy-MM', { locale: zhCN });
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      });
    
    const sortedMonths = Object.keys(monthCounts).sort();
    
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: sortedMonths },
      yAxis: { type: 'value' },
      series: [{
        name: '到期票据',
        type: 'bar',
        data: sortedMonths.map(m => monthCounts[m]),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#2b6aa8' },
              { offset: 1, color: '#1e3a5f' }
            ]
          }
        }
      }]
    };
  }, [validBills]);

  const riskBills = useMemo(() => {
    return validBills
      .map(bill => ({
        ...bill,
        risk: getRiskScore(bill)
      }))
      .filter(b => b.risk.level === 'high' || b.risk.level === 'medium')
      .sort((a, b) => b.risk.score - a.risk.score)
      .slice(0, 5);
  }, [validBills]);

  const statCards = [
    { 
      label: '票据总数', 
      value: stats.totalBills, 
      icon: FileCheck,
      gradient: 'stat-card-gradient-1',
      subtext: '有效票据'
    },
    { 
      label: '待确认异常', 
      value: stats.toConfirmBills, 
      icon: AlertTriangle,
      gradient: 'stat-card-gradient-4',
      subtext: `${stats.highSeverityCount} 个高风险`,
      alert: stats.highSeverityCount > 0
    },
    { 
      label: '本周到期', 
      value: stats.matureThisWeek, 
      icon: Clock,
      gradient: 'stat-card-gradient-2',
      subtext: `下周 ${stats.matureNextWeek} 张`
    },
    { 
      label: '保证金总额', 
      value: (stats.totalMargin / 10000).toFixed(2) + '万', 
      icon: DollarSign,
      gradient: 'stat-card-gradient-3',
      subtext: `占用 ${(stats.totalOccupancy / 10000).toFixed(2)}万`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`stat-card ${card.gradient} animate-slide-up`} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/80 text-sm">{card.label}</p>
                  <p className="text-3xl font-bold mt-1">{card.value}</p>
                  <p className="text-white/70 text-xs mt-2">{card.subtext}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              {card.alert && (
                <div className="absolute top-2 right-2">
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">票据状态分布</h3>
            <TrendingUp className="w-5 h-5 text-slate-400" />
          </div>
          <div className="card-body">
            <ReactECharts option={statusChartOption} style={{ height: '300px' }} />
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">到期趋势</h3>
            <TrendingUp className="w-5 h-5 text-slate-400" />
          </div>
          <div className="card-body">
            <ReactECharts option={maturityChartOption} style={{ height: '300px' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">风险预警</h3>
            <p className="text-sm text-slate-500 mt-1">高/中风险票据列表，点击查看详情</p>
          </div>
          <button 
            onClick={() => navigate('/exceptions')}
            className="btn btn-secondary text-sm"
          >
            查看全部
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        <div className="card-body">
          {riskBills.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>暂无风险票据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {riskBills.map(bill => {
                const warningLevel = getMaturityWarningLevel(bill);
                return (
                  <div 
                    key={bill.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/bills?billId=${bill.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        bill.risk.level === 'high' ? 'bg-red-500' : 'bg-amber-500'
                      } ${bill.risk.level === 'high' ? 'animate-pulse' : ''}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{bill.billNo}</span>
                          <span className={`status-badge ${getStatusColorClass(bill.status)}`}>
                            {getStatusLabel(bill.status)}
                          </span>
                          {warningLevel !== 'none' && (
                            <span className={`badge ${
                              warningLevel === 'overdue' ? 'bg-red-100 text-red-700' :
                              warningLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                              warningLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {getMaturityWarningText(warningLevel)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          风险因素: {bill.risk.factors.join('、')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold" style={{
                          color: bill.risk.level === 'high' ? '#dc2626' : 
                                 bill.risk.level === 'medium' ? '#f59e0b' : '#22c55e'
                        }}>
                          {bill.risk.score}
                        </span>
                        <span className="text-sm text-slate-500">分</span>
                      </div>
                      <p className="text-sm text-slate-500">到期日: {bill.maturityDate}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
