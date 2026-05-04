import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, MoreVertical, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { ropeApi } from '../services/api';
import RiskBadge from '../components/RiskBadge';
import { 
  sortByRisk, 
  filterByRisk,
  getEffectiveRiskLevel, 
  hasReviewDecision,
  formatDate,
  formatNumber
} from '../utils/helpers';

const RopesList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [ropes, setRopes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState(searchParams.get('filter') || '');
  const [actionDropdown, setActionDropdown] = useState(null);

  const fetchRopes = async () => {
    setLoading(true);
    try {
      const response = await ropeApi.getAll();
      const data = response.data.data || [];
      setRopes(data);
    } catch (error) {
      toast.error('加载数据失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRopes();
  }, []);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter) {
      setFilterRisk(filter);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = () => setActionDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredRopes = sortByRisk(
    filterByRisk(
      ropes.filter(rope => 
        rope.rope_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rope.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rope.model?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
      filterRisk,
      getEffectiveRiskLevel
    ),
    getEffectiveRiskLevel
  );

  const toggleDropdown = (e, id) => {
    e.stopPropagation();
    setActionDropdown(actionDropdown === id ? null : id);
  };

  return (
    <div>
      <div className="header">
        <h2>绳索管理</h2>
        <button
          className="btn btn-outline"
          onClick={fetchRopes}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spinner' : ''} />
          刷新
        </button>
      </div>

      <div className="page-content">
        <div className="filter-bar">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-secondary" />
            <input
              type="text"
              placeholder="搜索绳索编号、品牌..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ minWidth: '250px' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-secondary" />
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
            >
              <option value="">全部风险等级</option>
              <option value="scrap">报废</option>
              <option value="critical">严重</option>
              <option value="warning">警告</option>
              <option value="caution">注意</option>
              <option value="normal">正常</option>
            </select>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="empty-state">
              <div className="spinner" style={{ margin: '0 auto', width: '2rem', height: '2rem' }} />
              <p className="mt-4">加载中...</p>
            </div>
          ) : filteredRopes.length === 0 ? (
            <div className="empty-state">
              <Search size={48} />
              <p>没有找到匹配的绳索</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>绳索编号</th>
                    <th>品牌/型号</th>
                    <th>购买日期</th>
                    <th>风险等级</th>
                    <th>累计能量</th>
                    <th>使用天数</th>
                    <th>磨损等级</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRopes.map(rope => (
                    <tr key={rope.id}>
                      <td className="font-medium">{rope.rope_number}</td>
                      <td>
                        <div className="text-sm">
                          <div>{rope.brand || '-'}</div>
                          <div className="text-secondary">{rope.model || '-'}</div>
                        </div>
                      </td>
                      <td className="text-sm">
                        {formatDate(rope.purchase_date)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <RiskBadge level={getEffectiveRiskLevel(rope)} />
                          {hasReviewDecision(rope) && (
                            <span className="badge badge-info">已复核</span>
                          )}
                        </div>
                      </td>
                      <td className="text-sm">
                        {formatNumber(rope.latest_assessment?.total_energy_kj)} kJ
                      </td>
                      <td className="text-sm">
                        {rope.latest_assessment?.service_days || 0} 天
                      </td>
                      <td className="text-sm">
                        {rope.latest_assessment?.current_wear_level || 0}
                      </td>
                      <td>
                        <span className={`badge ${rope.status === 'scrapped' ? 'badge-danger' : 'badge-success'}`}>
                          {rope.status === 'scrapped' ? '已报废' : '使用中'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => navigate(`/ropes/${rope.id}`)}
                          >
                            <Eye size={14} />
                            查看
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-secondary">
          <span>共 {filteredRopes.length} 条记录</span>
          {filterRisk && (
            <span>
              (筛选: 
              <span className="font-medium" style={{ marginLeft: '0.25rem' }}>
                {filterRisk === 'scrap' ? '报废' :
                 filterRisk === 'critical' ? '严重' :
                 filterRisk === 'warning' ? '警告' :
                 filterRisk === 'caution' ? '注意' :
                 filterRisk === 'normal' ? '正常' : ''}
              </span>)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RopesList;
