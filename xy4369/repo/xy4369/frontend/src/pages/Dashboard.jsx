import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Eye, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { ropeApi, exportApi } from '../services/api';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import { 
  groupByRisk, 
  getEffectiveRiskLevel, 
  RISK_LABELS,
  sortByRisk,
  formatDate,
  formatNumber
} from '../utils/helpers';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [ropes, setRopes] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    scrap: 0,
    critical: 0,
    warning: 0,
    caution: 0,
    normal: 0
  });

  const fetchRopes = async () => {
    setLoading(true);
    try {
      const response = await ropeApi.getAll();
      const data = response.data.data || [];
      setRopes(data);
      
      const groups = groupByRisk(data);
      setStats({
        total: data.length,
        scrap: groups.scrap.length,
        critical: groups.critical.length,
        warning: groups.warning.length,
        caution: groups.caution.length,
        normal: groups.normal.length
      });
    } catch (error) {
      toast.error('加载数据失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAssessAll = async () => {
    setAssessing(true);
    try {
      const response = await ropeApi.assessAll();
      toast.success(`已评估 ${response.data.data?.assessed || 0} 条绳索`);
      await fetchRopes();
    } catch (error) {
      toast.error('评估失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setAssessing(false);
    }
  };

  useEffect(() => {
    fetchRopes();
  }, []);

  const highPriorityRopes = sortByRisk(
    ropes.filter(r => getEffectiveRiskLevel(r) !== 'normal'),
    getEffectiveRiskLevel
  ).slice(0, 5);

  return (
    <div>
      <div className="header">
        <h2>仪表盘</h2>
        <div className="flex gap-2">
          <button
            className="btn btn-outline"
            onClick={fetchRopes}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            刷新
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAssessAll}
            disabled={assessing}
          >
            {assessing ? <RefreshCw size={16} className="spinner" /> : <RefreshCw size={16} />}
            全部评估
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <StatCard
            title="绳索总数"
            value={stats.total}
            level="normal"
            onClick={() => navigate('/ropes')}
          />
          <StatCard
            title={RISK_LABELS.scrap}
            value={stats.scrap}
            level="scrap"
            onClick={() => navigate('/ropes?filter=scrap')}
          />
          <StatCard
            title={RISK_LABELS.critical}
            value={stats.critical}
            level="critical"
            onClick={() => navigate('/ropes?filter=critical')}
          />
          <StatCard
            title={RISK_LABELS.warning}
            value={stats.warning}
            level="warning"
            onClick={() => navigate('/ropes?filter=warning')}
          />
          <StatCard
            title={RISK_LABELS.caution}
            value={stats.caution}
            level="caution"
            onClick={() => navigate('/ropes?filter=caution')}
          />
          <StatCard
            title={RISK_LABELS.normal}
            value={stats.normal}
            level="normal"
            onClick={() => navigate('/ropes?filter=normal')}
          />
        </div>

        <div className="card">
          <div className="card-header">
            <h3>高风险绳索</h3>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate('/ropes')}
            >
              查看全部
            </button>
          </div>
          
          {highPriorityRopes.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <p>当前没有高风险绳索</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>绳索编号</th>
                    <th>品牌/型号</th>
                    <th>风险等级</th>
                    <th>累计能量</th>
                    <th>使用天数</th>
                    <th>磨损等级</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {highPriorityRopes.map(rope => (
                    <tr key={rope.id}>
                      <td className="font-medium">{rope.rope_number}</td>
                      <td>
                        <div className="text-sm">
                          <div>{rope.brand || '-'}</div>
                          <div className="text-secondary">{rope.model || '-'}</div>
                        </div>
                      </td>
                      <td>
                        <RiskBadge level={getEffectiveRiskLevel(rope)} />
                      </td>
                      <td>
                        {formatNumber(rope.latest_assessment?.total_energy_kj)} kJ
                      </td>
                      <td>{rope.latest_assessment?.service_days || 0} 天</td>
                      <td>{rope.latest_assessment?.current_wear_level || 0}</td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/ropes/${rope.id}`)}
                        >
                          <Eye size={14} />
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>快速操作</h3>
          </div>
          <div className="flex gap-4 flex-wrap">
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/import')}
            >
              导入数据
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/export')}
            >
              导出报告
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleAssessAll}
              disabled={assessing}
            >
              风险评估
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
