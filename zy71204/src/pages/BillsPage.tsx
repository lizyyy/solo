import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Eye, ChevronDown } from 'lucide-react';
import useBillStore from '@/store/useBillStore';
import { Bill, BillStatus } from '@/types/bill';
import { getStatusLabel, getStatusColorClass } from '@/services/billStateMachine';
import { 
  getRiskScore, 
  getMaturityWarningLevel, 
  getMaturityWarningText 
} from '@/services/occupancyCalculator';
import BillDetailModal from '@/components/BillDetailModal';

export default function BillsPage() {
  const [searchParams] = useSearchParams();
  const billId = searchParams.get('billId');
  
  const bills = useBillStore(state => state.bills);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDirty, setShowDirty] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      if (!showDirty && bill.isDirty) return false;
      
      if (statusFilter !== 'all' && bill.status !== statusFilter) return false;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          bill.billNo.toLowerCase().includes(term) ||
          bill.pledgeStatus.toLowerCase().includes(term) ||
          (bill.releaseApplication && bill.releaseApplication.toLowerCase().includes(term))
        );
      }
      
      return true;
    });
  }, [bills, searchTerm, statusFilter, showDirty]);

  const handleViewDetail = (bill: Bill) => {
    setSelectedBill(bill);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索票据编号、质押状态..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-80"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} text-sm`}
              >
                <Filter className="w-4 h-4 mr-2" />
                筛选
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                共 {filteredBills.length} 条记录
              </span>
            </div>
          </div>
          
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-slate-700">状态筛选:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input w-40"
                  >
                    <option value="all">全部状态</option>
                    {(['pending', 'pledged', 'extended', 'matured', 'released', 'to_confirm', 'closed'] as BillStatus[]).map(status => (
                      <option key={status} value={status}>{getStatusLabel(status)}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDirty}
                    onChange={(e) => setShowDirty(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-slate-700">显示脏数据</span>
                </label>
              </div>
            </div>
          )}
        </div>
        
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>票据编号</th>
                <th>质押状态</th>
                <th>系统状态</th>
                <th>到期日</th>
                <th>保证金</th>
                <th>计算占用</th>
                <th>风险评分</th>
                <th>异常数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => {
                const risk = getRiskScore(bill);
                const warningLevel = getMaturityWarningLevel(bill);
                
                return (
                  <tr 
                    key={bill.id} 
                    className={`${bill.isDirty ? 'bg-amber-50' : ''}`}
                  >
                    <td className="font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        {bill.billNo}
                        {bill.isDirty && (
                          <span className="badge bg-amber-100 text-amber-700">脏数据</span>
                        )}
                      </div>
                    </td>
                    <td>{bill.pledgeStatus}</td>
                    <td>
                      <span className={`status-badge ${getStatusColorClass(bill.status)}`}>
                        {getStatusLabel(bill.status)}
                      </span>
                      {warningLevel !== 'none' && (
                        <span className={`ml-2 badge ${
                          warningLevel === 'overdue' ? 'bg-red-100 text-red-700' :
                          warningLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                          warningLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {getMaturityWarningText(warningLevel)}
                        </span>
                      )}
                    </td>
                    <td>
                      <div>
                        {bill.maturityDate}
                        {bill.originalMaturityDate && (
                          <div className="text-xs text-slate-400">
                            原: {bill.originalMaturityDate}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="font-mono">¥{bill.margin.toLocaleString()}</td>
                    <td className="font-mono">¥{(bill.calculatedOccupancy || bill.margin).toLocaleString()}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              risk.level === 'high' ? 'bg-red-500' :
                              risk.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${risk.score}%` }}
                          />
                        </div>
                        <span className={`font-bold ${
                          risk.level === 'high' ? 'text-red-600' :
                          risk.level === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {risk.score}
                        </span>
                      </div>
                    </td>
                    <td>
                      {bill.exceptions.filter(e => !e.confirmed).length > 0 ? (
                        <span className="badge bg-red-100 text-red-700">
                          {bill.exceptions.filter(e => !e.confirmed).length} 个未确认
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleViewDetail(bill)}
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredBills.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>暂无符合条件的票据</p>
            </div>
          )}
        </div>
      </div>

      <BillDetailModal
        isOpen={!!selectedBill || !!billId}
        onClose={() => {
          setSelectedBill(null);
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('billId');
          window.history.replaceState({}, '', `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`);
        }}
        bill={selectedBill || bills.find(b => b.id === billId) || null}
      />
    </div>
  );
}
