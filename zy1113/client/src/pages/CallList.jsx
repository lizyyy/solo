import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

function CallList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    agent_name: searchParams.get('agent_name') || '',
    region: searchParams.get('region') || '',
    start_date: searchParams.get('start_date') || '',
    end_date: searchParams.get('end_date') || '',
    limit: parseInt(searchParams.get('limit')) || 20,
    offset: parseInt(searchParams.get('offset')) || 0,
  });
  const [agents, setAgents] = useState([]);
  const [regions, setRegions] = useState([]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.agent_name) params.agent_name = filters.agent_name;
      if (filters.region) params.region = filters.region;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      params.limit = filters.limit;
      params.offset = filters.offset;

      const response = await axios.get('/api/calls', { params });
      setCalls(response.data.calls);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取通话列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const [agentsRes, regionsRes] = await Promise.all([
        axios.get('/api/agents'),
        axios.get('/api/regions'),
      ]);
      setAgents(agentsRes.data);
      setRegions(regionsRes.data);
    } catch (error) {
      console.error('获取筛选条件失败:', error);
    }
  };

  useEffect(() => {
    fetchCalls();
    fetchFilters();
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, offset: 0 }));
  };

  const handleApplyFilters = () => {
    fetchCalls();
    const params = {};
    if (filters.agent_name) params.agent_name = filters.agent_name;
    if (filters.region) params.region = filters.region;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setFilters({
      agent_name: '',
      region: '',
      start_date: '',
      end_date: '',
      limit: 20,
      offset: 0,
    });
    setSearchParams({});
    setTimeout(() => fetchCalls(), 100);
  };

  const handlePageChange = (newOffset) => {
    setFilters((prev) => ({ ...prev, offset: newOffset }));
    setTimeout(() => fetchCalls(), 100);
  };

  const totalPages = Math.ceil(total / filters.limit);
  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) {
      return <span className="badge badge-success">高置信度</span>;
    } else if (confidence >= 0.5) {
      return <span className="badge badge-warning">中置信度</span>;
    } else {
      return <span className="badge badge-secondary">低置信度</span>;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">通话列表</h2>
        
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">筛选条件</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客服</label>
              <select
                className="form-select"
                value={filters.agent_name}
                onChange={(e) => handleFilterChange('agent_name', e.target.value)}
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
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="date"
                className="form-input"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
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

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">通话记录</h3>
          <span className="text-sm text-gray-500">
            共 {total} 条记录
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-gray-500">加载中...</div>
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg">暂无通话记录</p>
            <p className="text-sm mt-2">请先导入数据</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>通话ID</th>
                    <th>通话时间</th>
                    <th>客户</th>
                    <th>客服</th>
                    <th>地区</th>
                    <th>问题分类</th>
                    <th>置信度</th>
                    <th>人工修改</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.call_id}>
                      <td className="font-mono text-sm">{call.call_id}</td>
                      <td>
                        {call.call_time
                          ? dayjs(call.call_time).format('YYYY-MM-DD HH:mm')
                          : '-'}
                      </td>
                      <td>{call.customer_name || call.customer_id || '未知'}</td>
                      <td>{call.agent_name || '-'}</td>
                      <td>{call.region || '-'}</td>
                      <td>
                        <span className="badge badge-info">
                          {call.category_name || '未分类'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center space-x-2">
                          {getConfidenceBadge(call.confidence)}
                          <span className="text-xs text-gray-500">
                            {call.confidence ? `${Math.round(call.confidence * 100)}%` : '-'}
                          </span>
                        </div>
                      </td>
                      <td>
                        {call.is_manual ? (
                          <span className="badge badge-warning">已修改</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/calls/${call.call_id}`}
                          className="text-primary hover:underline text-sm"
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <span className="text-sm text-gray-500">
                  第 {currentPage} / {totalPages} 页
                </span>
                <div className="flex space-x-2">
                  <button
                    className="btn-secondary"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(filters.offset - filters.limit)}
                  >
                    上一页
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(filters.offset + filters.limit)}
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CallList;
