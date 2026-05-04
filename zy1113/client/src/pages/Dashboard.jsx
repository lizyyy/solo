import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
import dayjs from 'dayjs';

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#a4de6c',
  '#d0ed57',
];

function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    agentName: '',
    category: '',
    region: '',
    startDate: '',
    endDate: '',
  });
  const [agents, setAgents] = useState([]);
  const [regions, setRegions] = useState([]);
  const [categories, setCategories] = useState([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.agentName) params.agentName = filters.agentName;
      if (filters.category) params.category = filters.category;
      if (filters.region) params.region = filters.region;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await axios.get('/api/dashboard', { params });
      setDashboardData(response.data);
    } catch (error) {
      console.error('获取看板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const [agentsRes, regionsRes, categoriesRes] = await Promise.all([
        axios.get('/api/agents'),
        axios.get('/api/regions'),
        axios.get('/api/categories'),
      ]);
      setAgents(agentsRes.data);
      setRegions(regionsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('获取筛选条件失败:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchFilters();
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    fetchDashboardData();
  };

  const handleResetFilters = () => {
    setFilters({
      agentName: '',
      category: '',
      region: '',
      startDate: '',
      endDate: '',
    });
    setTimeout(() => fetchDashboardData(), 100);
  };

  const handleExport = async (format) => {
    try {
      const params = {};
      if (filters.agentName) params.agentName = filters.agentName;
      if (filters.category) params.category = filters.category;
      if (filters.region) params.region = filters.region;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await axios.get(`/api/export/${format}`, {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${dayjs().format('YYYYMMDD_HHmmss')}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请稍后重试');
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-500">加载中...</div>
      </div>
    );
  }

  const categoryStats = dashboardData?.categoryStats || [];
  const pendingCommitments = dashboardData?.pendingCommitments || [];
  const frequentCustomers = dashboardData?.frequentCustomers || [];
  const agentStats = dashboardData?.agentStats || [];
  const regionStats = dashboardData?.regionStats || [];

  const pieData = categoryStats.map((item) => ({
    name: item.category_name,
    value: item.count,
    percentage: item.percentage,
  }));

  const barData = agentStats.map((item) => ({
    name: item.agent_name || '未知客服',
    通话数: item.call_count,
    逾期承诺: item.overdue_count || 0,
    紧急待处理: item.urgent_count || 0,
  }));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">归因聚类看板</h2>
        
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">筛选条件</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客服</label>
              <select
                className="form-select"
                value={filters.agentName}
                onChange={(e) => handleFilterChange('agentName', e.target.value)}
              >
                <option value="">全部客服</option>
                {agents.map((agent) => (
                  <option key={agent} value={agent}>
                    {agent}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">产品分类</label>
              <select
                className="form-select"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="">全部分类</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">地区</label>
              <select
                className="form-select"
                value={filters.region}
                onChange={(e) => handleFilterChange('region', e.target.value)}
              >
                <option value="">全部地区</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="date"
                className="form-input"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="date"
                className="form-input"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <button className="btn-primary" onClick={handleApplyFilters}>
              应用筛选
            </button>
            <button className="btn-secondary" onClick={handleResetFilters}>
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-3xl font-bold text-primary">
            {dashboardData?.totalCalls || 0}
          </div>
          <div className="text-gray-600">总通话数</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600">
            {pendingCommitments.filter((c) => c.status === 'pending').length}
          </div>
          <div className="text-gray-600">待跟进承诺</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-red-600">
            {pendingCommitments.filter((c) => c.status === 'overdue').length}
          </div>
          <div className="text-gray-600">已逾期承诺</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600">
            {categoryStats.length}
          </div>
          <div className="text-gray-600">问题分类</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">问题分类占比</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-12">暂无数据</div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">客服统计</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="通话数" fill="#0088FE" />
                <Bar dataKey="逾期承诺" fill="#FF8042" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-12">暂无数据</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">问题分类详情</h3>
          {categoryStats.length > 0 ? (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>分类</th>
                    <th>数量</th>
                    <th>占比</th>
                    <th>进度</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryStats.map((item, index) => (
                    <tr key={item.category_code}>
                      <td>
                        <span className="flex items-center">
                          <span
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></span>
                          {item.category_name}
                        </span>
                      </td>
                      <td>{item.count}</td>
                      <td>{item.percentage}%</td>
                      <td style={{ width: '150px' }}>
                        <div className="progress-bar">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${Math.min(100, item.percentage)}%`,
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">暂无数据</div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">待跟进承诺</h3>
          {pendingCommitments.length > 0 ? (
            <div className="space-y-3">
              {pendingCommitments.slice(0, 5).map((commitment) => (
                <div
                  key={commitment.id}
                  className={`p-3 rounded-lg border ${
                    commitment.status === 'overdue'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span
                        className={`badge ${
                          commitment.priority === 'high'
                            ? 'badge-danger'
                            : commitment.priority === 'medium'
                            ? 'badge-warning'
                            : 'badge-success'
                        }`}
                      >
                        {commitment.priority === 'high'
                          ? '高优先级'
                          : commitment.priority === 'medium'
                          ? '中优先级'
                          : '低优先级'}
                      </span>
                      {commitment.status === 'overdue' && (
                        <span className="badge badge-danger ml-2">已逾期</span>
                      )}
                      <p className="mt-2 text-sm">{commitment.content}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">截止日期</p>
                      <p className="text-sm font-medium">{commitment.deadline || '-'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {commitment.agent_name || '未知客服'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {pendingCommitments.length > 5 && (
                <Link
                  to="/commitments"
                  className="block text-center text-primary hover:underline text-sm"
                >
                  查看全部 {pendingCommitments.length} 条承诺
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">暂无待跟进承诺</div>
          )}
        </div>
      </div>

      {frequentCustomers.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">反复出现的客户（通话超过1次）</h3>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>客户ID</th>
                  <th>客户名称</th>
                  <th>联系电话</th>
                  <th>通话次数</th>
                </tr>
              </thead>
              <tbody>
                {frequentCustomers.map((customer) => (
                  <tr key={customer.customer_id}>
                    <td>{customer.customer_id || '-'}</td>
                    <td>{customer.customer_name || '未知'}</td>
                    <td>{customer.phone || '-'}</td>
                    <td>
                      <span className="badge badge-danger">{customer.call_count} 次</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">导出复盘报告</h3>
        <p className="text-gray-600 mb-4">
          导出当前筛选条件下的复盘报告，支持多种格式。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={() => handleExport('markdown')}
          >
            📄 导出 Markdown
          </button>
          <button
            className="btn-primary"
            onClick={() => handleExport('html')}
          >
            🌐 导出 HTML
          </button>
          <button
            className="btn-primary"
            onClick={() => handleExport('csv')}
          >
            📊 导出 CSV
          </button>
          <button
            className="btn-primary"
            onClick={() => handleExport('json')}
          >
            📋 导出 JSON
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
