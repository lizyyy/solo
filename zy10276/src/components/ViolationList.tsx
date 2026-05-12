import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, CheckCircle, AlertTriangle, Gavel } from 'lucide-react';
import { ViolationFilterParams } from '../types';
import { violationApi } from '../services/api';
import { formatDateTime, getStatusText, getViolationTypeText, formatMoney } from '../utils/format';
import ViolationDetail from './ViolationDetail';
import MatchShiftModal from './MatchShiftModal';
import AppealModal from './AppealModal';

const ViolationList: React.FC = () => {
  const [violations, setViolations] = useState<any[]>([]);
  const [filters, setFilters] = useState<ViolationFilterParams>({});
  const [selectedViolation, setSelectedViolation] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await violationApi.filter(filters);
      setViolations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载违章记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (violation: any) => {
    if (!violation.matchedDriverId) return;
    try {
      await violationApi.confirm(violation.id, violation.matchedDriverId);
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handlePenalize = async (violation: any) => {
    try {
      await violationApi.applyPenalty(violation.id);
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAppeal = (violation: any) => {
    setSelectedViolation(violation);
    setShowAppealModal(true);
  };

  const handleMatchShift = (violation: any) => {
    setSelectedViolation(violation);
    setShowMatchModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">违章记录列表</h2>
          <div className="text-sm text-gray-500">共 {violations.length} 条记录</div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="车牌号"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.plateNumber || ''}
              onChange={(e) => setFilters({ ...filters, plateNumber: e.target.value })}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="司机姓名"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.driverName || ''}
              onChange={(e) => setFilters({ ...filters, driverName: e.target.value })}
            />
          </div>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
          >
            <option value="">全部状态</option>
            <option value="imported">已导入</option>
            <option value="matched">已匹配</option>
            <option value="pending_confirmation">待确认</option>
            <option value="confirmed">已确认</option>
            <option value="appealing">申诉中</option>
            <option value="appeal_approved">申诉通过</option>
            <option value="appeal_rejected">申诉驳回</option>
            <option value="penalized">已处罚</option>
            <option value="rolled_back">已回滚</option>
          </select>
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.startDate || ''}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.endDate || ''}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">车牌号</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">违章时间</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">违章类型</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">地点</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">司机</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">扣分/罚款</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  加载中...
                </td>
              </tr>
            ) : violations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  暂无违章记录
                </td>
              </tr>
            ) : (
              violations.map((violation) => (
                <tr key={violation.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{violation.plateNumber}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(violation.violationTime)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {getViolationTypeText(violation.violationType)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {violation.location}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {violation.matchedDriverId || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <span className="text-red-600 font-medium">{violation.points} 分</span>
                    <span className="mx-1">/</span>
                    <span className="text-orange-600">{formatMoney(violation.fineAmount)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`status-badge status-${violation.status}`}>
                      {getStatusText(violation.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setSelectedViolation(violation);
                          setShowDetail(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {violation.status === 'imported' && (
                        <button
                          onClick={() => handleMatchShift(violation)}
                          className="text-yellow-600 hover:text-yellow-900 p-1"
                          title="匹配班次"
                        >
                          <Filter className="w-4 h-4" />
                        </button>
                      )}

                      {violation.status === 'pending_confirmation' && (
                        <>
                          <button
                            onClick={() => handleConfirm(violation)}
                            className="text-green-600 hover:text-green-900 p-1"
                            title="确认违章"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleAppeal(violation)}
                            className="text-orange-600 hover:text-orange-900 p-1"
                            title="申诉"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {(violation.status === 'confirmed' || violation.status === 'appeal_rejected') && (
                        <button
                          onClick={() => handlePenalize(violation)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="执行处罚"
                        >
                          <Gavel className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showDetail && selectedViolation && (
        <ViolationDetail
          violation={selectedViolation}
          onClose={() => {
            setShowDetail(false);
            setSelectedViolation(null);
          }}
          onRefresh={loadData}
        />
      )}

      {showMatchModal && selectedViolation && (
        <MatchShiftModal
          violationId={selectedViolation.id}
          plateNumber={selectedViolation.plateNumber}
          onClose={() => {
            setShowMatchModal(false);
            setSelectedViolation(null);
            loadData();
          }}
        />
      )}

      {showAppealModal && selectedViolation && (
        <AppealModal
          violation={selectedViolation}
          onClose={() => {
            setShowAppealModal(false);
            setSelectedViolation(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default ViolationList;
