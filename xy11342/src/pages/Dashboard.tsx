import { PackageOpen, Wrench, FileCheck, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAppStore } from '@/store';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatCurrency } from '@/utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { pickupOrders, repairOrders, claimOrders, importErrors } = useAppStore();

  const successRate = claimOrders.length > 0
    ? Math.round((claimOrders.filter(c => c.status === 'approved' || c.status === 'paid').length / claimOrders.length) * 100)
    : 0;

  const monthlyData = [
    { month: '1月', 领件: 45, 返修: 38, 索赔: 32 },
    { month: '2月', 领件: 52, 返修: 45, 索赔: 38 },
    { month: '3月', 领件: 48, 返修: 42, 索赔: 36 },
    { month: '4月', 领件: 60, 返修: 55, 索赔: 48 },
    { month: '5月', 领件: pickupOrders.length || 55, 返修: repairOrders.length || 50, 索赔: claimOrders.length || 42 },
  ];

  const statusDistribution = [
    { name: '已完成', value: repairOrders.filter(r => r.status === 'completed').length || 35, color: '#10B981' },
    { name: '处理中', value: repairOrders.filter(r => r.status === 'processing').length || 25, color: '#3B82F6' },
    { name: '待处理', value: repairOrders.filter(r => r.status === 'pending').length || 15, color: '#F59E0B' },
    { name: '异常', value: repairOrders.filter(r => r.status === 'abnormal').length || 5, color: '#EF4444' },
  ];

  const recentPickups = pickupOrders.slice(0, 5);
  const recentRepairs = repairOrders.slice(0, 5);

  const totalClaimAmount = claimOrders.reduce((sum, c) => sum + c.claimAmount, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="领件总数"
          value={pickupOrders.length || 260}
          icon={PackageOpen}
          trend={12}
          trendLabel="较上月"
          color="blue"
        />
        <StatCard
          title="返修总数"
          value={repairOrders.length || 215}
          icon={Wrench}
          trend={8}
          trendLabel="较上月"
          color="green"
        />
        <StatCard
          title="索赔成功率"
          value={`${successRate || 85}%`}
          icon={FileCheck}
          trend={5}
          trendLabel="较上月"
          color="purple"
        />
        <StatCard
          title="导入异常"
          value={importErrors.filter(e => e.status === 'pending').length || 3}
          icon={AlertTriangle}
          trend={-15}
          trendLabel="较上月"
          color={importErrors.filter(e => e.status === 'pending').length > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">月度趋势</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="领件" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="返修" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="索赔" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">返修状态分布</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {statusDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-slate-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">最近领件</h3>
            <Link to="/pickup" className="text-sm text-blue-600 hover:text-blue-700">
              查看全部
            </Link>
          </div>
          <DataTable
            data={recentPickups.length > 0 ? recentPickups : [
              { id: '1', orderNo: 'PJ202405001', engineerName: '张工', partName: '压缩机', quantity: 2, pickupDate: '2024-05-15', status: 'picked' },
              { id: '2', orderNo: 'PJ202405002', engineerName: '李工', partName: '主板', quantity: 1, pickupDate: '2024-05-14', status: 'returned' },
              { id: '3', orderNo: 'PJ202405003', engineerName: '王工', partName: '电机', quantity: 3, pickupDate: '2024-05-13', status: 'pending' },
            ]}
            columns={[
              { key: 'orderNo', header: '单号', width: '120px' },
              { key: 'engineerName', header: '工程师' },
              { key: 'partName', header: '配件' },
              { key: 'quantity', header: '数量' },
              { key: 'pickupDate', header: '日期', render: (item) => formatDate(item.pickupDate) },
              { key: 'status', header: '状态', render: (item) => <StatusBadge status={item.status} /> },
            ]}
            pageSize={5}
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">最近返修</h3>
            <Link to="/repair" className="text-sm text-blue-600 hover:text-blue-700">
              查看全部
            </Link>
          </div>
          <DataTable
            data={recentRepairs.length > 0 ? recentRepairs : [
              { id: '1', repairNo: 'WX202405001', customerName: '张三', faultType: '不制冷', engineerName: '张工', oldPartReturned: 'yes', status: 'completed' },
              { id: '2', repairNo: 'WX202405002', customerName: '李四', faultType: '噪音大', engineerName: '李工', oldPartReturned: 'partial', status: 'processing' },
              { id: '3', repairNo: 'WX202405003', customerName: '王五', faultType: '漏水', engineerName: '王工', oldPartReturned: 'no', status: 'pending' },
            ]}
            columns={[
              { key: 'repairNo', header: '单号', width: '120px' },
              { key: 'customerName', header: '客户' },
              { key: 'faultType', header: '故障' },
              { key: 'oldPartReturned', header: '旧件', render: (item) => <StatusBadge status={item.oldPartReturned} /> },
              { key: 'status', header: '状态', render: (item) => <StatusBadge status={item.status} /> },
            ]}
            pageSize={5}
          />
        </div>
      </div>

      {/* Claim Summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">索赔概览</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(totalClaimAmount || 125800)}</div>
            <div className="text-sm text-blue-600 mt-1">总索赔金额</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="text-3xl font-bold text-green-600">{claimOrders.filter(c => c.status === 'approved' || c.status === 'paid').length || 86}</div>
            <div className="text-sm text-green-600 mt-1">已通过索赔</div>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl">
            <div className="text-3xl font-bold text-amber-600">{claimOrders.filter(c => c.status === 'submitted' || c.status === 'draft').length || 12}</div>
            <div className="text-sm text-amber-600 mt-1">待审批索赔</div>
          </div>
        </div>
      </div>
    </div>
  );
}
