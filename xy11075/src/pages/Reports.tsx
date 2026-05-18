import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, Store, FileText, Calendar } from 'lucide-react';

interface ReportSummary {
  totalRecords: number;
  totalScore: number;
  avgScore: number;
  statusCounts: Record<string, number>;
  topStores: { storeName: string; totalScore: number; recordCount: number }[];
  topItems: { itemName: string; totalScore: number; recordCount: number }[];
  monthlyTrend: { month: string; totalScore: number; recordCount: number }[];
}

const Reports: React.FC = () => {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  });

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/reports/summary');
        const data = await res.json();
        setSummary(data);
      } catch (error) {
        console.error('Failed to fetch summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  const handleExport = async () => {
    try {
      const res = await fetch('/api/reports/export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `巡店扣分报表_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700"></div>
      </div>
    );
  }

  if (!summary) {
    return <div className="text-center py-12 text-gray-500">暂无数据</div>;
  }

  const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];

  const statusData = Object.entries(summary.statusCounts).map(([name, value]) => ({
    name: name === 'DRAFT' ? '草稿' :
          name === 'PENDING' ? '待审核' :
          name === 'CONFIRMED' ? '已确认' :
          name === 'APPEALING' ? '申诉中' :
          name === 'ADJUSTED' ? '已调整' : '已结案',
    value,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">数据报表</h1>
          <p className="text-gray-500">查看巡店扣分统计分析数据</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors font-medium"
        >
          <Download className="w-4 h-4" />
          导出报表
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-sm font-medium">总记录数</p>
              <p className="text-3xl font-bold mt-1">{summary.totalRecords}</p>
            </div>
            <FileText className="w-10 h-10 text-teal-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">总扣分数</p>
              <p className="text-3xl font-bold mt-1">{summary.totalScore}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">平均扣分</p>
              <p className="text-3xl font-bold mt-1">{summary.avgScore}</p>
            </div>
            <Calendar className="w-10 h-10 text-amber-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">门店数量</p>
              <p className="text-3xl font-bold mt-1">{summary.topStores.length}</p>
            </div>
            <Store className="w-10 h-10 text-blue-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">月度扣分趋势</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summary.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="totalScore" name="扣分数" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">状态分布</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {statusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">门店扣分排名 TOP 5</h2>
          <div className="space-y-4">
            {summary.topStores.map((store, index) => (
              <div key={store.storeName} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{store.storeName}</span>
                    <span className="text-red-600 font-bold">-{store.totalScore} 分</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full"
                      style={{ width: `${(store.totalScore / summary.topStores[0].totalScore) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{store.recordCount} 条记录</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">扣分项排名 TOP 5</h2>
          <div className="space-y-4">
            {summary.topItems.map((item, index) => (
              <div key={item.itemName} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{item.itemName}</span>
                    <span className="text-red-600 font-bold">-{item.totalScore} 分</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: `${(item.totalScore / summary.topItems[0].totalScore) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{item.recordCount} 次出现</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
