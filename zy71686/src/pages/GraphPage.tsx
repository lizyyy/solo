import { useState, useEffect, useMemo } from 'react';
import { riskApi } from '../services/apiClient';
import { GuaranteeGraph } from '../components/GuaranteeGraph';
import { PageLoading } from '../components/LoadingSpinner';
import { RiskBadge } from '../components/RiskBadge';
import { Modal } from '../components/Modal';
import { useAppStore, formatAmount, formatDate, getRiskLevelText } from '../store';
import { Search, Filter, RefreshCw, ChevronDown, Users, Shield, CreditCard, AlertTriangle } from 'lucide-react';
import type { GraphNode, GraphResponse, RiskLevel, Customer } from '../../shared/types';

export function GraphPage() {
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [centerCustomerId, setCenterCustomerId] = useState<string>('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [riskLevels, setRiskLevels] = useState<RiskLevel[]>(['low', 'medium', 'high', 'critical']);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const activeVersion = useAppStore((state) => state.activeVersion);
  const setSelectedCustomer = useAppStore((state) => state.setSelectedCustomer);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim() || customers.length === 0) return [];
    const query = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [customers, searchQuery]);

  useEffect(() => {
    loadCustomers();
    loadGraph();
  }, [activeVersion?.id]);

  const loadCustomers = async () => {
    try {
      const res = await riskApi.getResults(activeVersion?.id);
      if (res.success && res.data) {
        const uniqueCustomers = res.data
          .filter((r: any) => r.customerName)
          .map((r: any) => ({
            id: r.customerId,
            name: r.customerName,
          })) as Customer[];
        setCustomers(uniqueCustomers);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadGraph = async () => {
    setLoading(true);
    try {
      const params: any = {
        maxDepth,
        riskLevels,
        version: activeVersion?.id,
      };
      if (centerCustomerId) {
        params.centerCustomerId = centerCustomerId;
      }
      const res = await riskApi.getGraph(params);
      if (res.success && res.data) {
        setGraphData(res.data);
      }
    } catch (error) {
      console.error('Failed to load graph:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    setShowDetailModal(true);
    if (node.type === 'customer') {
      setSelectedCustomer(node.data as Customer);
    }
  };

  const handleCenterCustomerSelect = (customerId: string) => {
    setCenterCustomerId(customerId);
    setShowCustomerSearch(false);
    setSearchQuery('');
    loadGraph();
  };

  const handleRiskLevelToggle = (level: RiskLevel) => {
    setRiskLevels(prev => 
      prev.includes(level)
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  const handleReset = () => {
    setCenterCustomerId('');
    setMaxDepth(3);
    setRiskLevels(['low', 'medium', 'high', 'critical']);
    loadGraph();
  };

  const getNodeDetailContent = () => {
    if (!selectedNode) return null;

    if (selectedNode.type === 'customer') {
      const customer = selectedNode.data as Customer;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{selectedNode.name}</h3>
            <RiskBadge level={selectedNode.riskLevel} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">客户类型</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {customer.customerType === 'enterprise' ? '企业' : customer.customerType === 'group' ? '集团' : '个人'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">信用评级</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{customer.creditRating || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">所属行业</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{customer.industry || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">风险等级</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{getRiskLevelText(selectedNode.riskLevel)}</p>
            </div>
          </div>
          <div className="pt-2">
            <p className="text-xs text-gray-500">数据来源</p>
            <p className="text-sm text-gray-700 mt-1">{customer.sourceFile}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleCenterCustomerSelect(customer.id)}
              className="flex-1 btn btn-primary text-sm"
            >
              以此为中心查看
            </button>
          </div>
        </div>
      );
    }

    if (selectedNode.type === 'guarantee') {
      const guarantee = selectedNode.data as any;
      return (
        <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{selectedNode.name}</h3>
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
            {guarantee.isCounterGuarantee ? '反担保' : '担保'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">担保金额</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{formatAmount(guarantee.amount)}万</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">合同编号</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{guarantee.contractNumber || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">开始日期</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(guarantee.startDate)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">到期日期</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(guarantee.endDate)}</p>
          </div>
        </div>
        <div className="pt-2">
          <p className="text-xs text-gray-500">数据来源</p>
          <p className="text-sm text-gray-700 mt-1">{guarantee.sourceFile} (第{guarantee.sourceRow}行)</p>
        </div>
      </div>
      );
    }

    if (selectedNode.type === 'credit') {
      const credit = selectedNode.data as any;
      return (
        <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{selectedNode.name}</h3>
          <RiskBadge level={selectedNode.riskLevel} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">授信总额</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{formatAmount(credit.totalAmount)}万</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">已用额度</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{formatAmount(credit.usedAmount)}万</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">可用额度</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{formatAmount(credit.availableAmount)}万</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">数据日期</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(credit.asOfDate)}</p>
          </div>
        </div>
        <div className="pt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary-500 h-2 rounded-full"
              style={{ width: `${credit.totalAmount > 0 ? (credit.usedAmount / credit.totalAmount) * 100 : 0}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">使用率：{credit.totalAmount > 0 ? ((credit.usedAmount / credit.totalAmount) * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="pt-2">
          <p className="text-xs text-gray-500">数据来源</p>
          <p className="text-sm text-gray-700 mt-1">{credit.sourceFile} (第{credit.sourceRow}行)</p>
        </div>
      </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">担保圈图谱</h1>
          <p className="text-gray-500 mt-1">可视化展示客户担保关系网络，支持关系穿透和风险识别</p>
        </div>
        <div className="flex items-center gap-3">
          {activeVersion && (
            <span className="text-sm text-gray-500">
              当前版本：{activeVersion.name}
            </span>
          )}
          <button
            onClick={loadGraph}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索客户并设置为中心节点..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowCustomerSearch(true);
                }}
                onFocus={() => setShowCustomerSearch(true)}
                className="input pl-10 w-full"
              />
              {showCustomerSearch && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleCenterCustomerSelect(customer.id)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2"
                    >
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{customer.name}</span>
                      <span className="text-gray-400 text-xs">({customer.id})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">深度：</span>
            <select
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="input w-24"
            >
              <option value={1}>1层</option>
              <option value={2}>2层</option>
              <option value={3}>3层</option>
              <option value={4}>4层</option>
              <option value={5}>5层</option>
            </select>
          </div>

          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`btn ${showFilterPanel ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
          >
            <Filter className="w-4 h-4" />
            筛选
            <ChevronDown className={`w-4 h-4 ${showFilterPanel ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={handleReset}
            className="btn btn-secondary"
          >
            重置
          </button>
        </div>

        {showFilterPanel && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">风险等级筛选</p>
            <div className="flex items-center gap-4">
              {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riskLevels.includes(level)}
                    onChange={() => handleRiskLevelToggle(level)}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <RiskBadge level={level} size="sm" />
                  <span className="text-sm text-gray-600">{getRiskLevelText(level)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {centerCustomerId && (
          <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              <span className="text-sm text-primary-700">
                当前以「{customers.find(c => c.id === centerCustomerId)?.name || centerCustomerId}」为中心展示
              </span>
            </div>
            <button
              onClick={() => { setCenterCustomerId(''); loadGraph(); }}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              取消
            </button>
          </div>
        )}

        <GuaranteeGraph
          data={graphData}
          loading={loading}
          onNodeClick={handleNodeClick}
          height="600px"
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-node-customer" />
            <div>
              <p className="text-xs text-gray-500">客户节点</p>
              <p className="text-sm font-medium text-gray-900">按风险等级着色</p>
            </div>
          </div>
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-node-guarantee" />
            <div>
              <p className="text-xs text-gray-500">担保节点</p>
              <p className="text-sm font-medium text-gray-900">担保合同关系</p>
            </div>
          </div>
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-node-credit" />
            <div>
              <p className="text-xs text-gray-500">授信节点</p>
              <p className="text-sm font-medium text-gray-900">授信额度信息</p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="节点详情"
        size="md"
      >
        {getNodeDetailContent()}
      </Modal>
    </div>
  );
}
