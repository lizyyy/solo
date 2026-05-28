import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Eye, Clock } from 'lucide-react';
import useBillStore from '@/store/useBillStore';
import { ExceptionType } from '@/types/bill';
import { 
  getExceptionTypeLabel, 
  getSeverityLabel,
  confirmException 
} from '@/services/exceptionDetector';
import { getStatusLabel, getStatusColorClass } from '@/services/billStateMachine';
import { getRiskScore } from '@/services/occupancyCalculator';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function ExceptionsPage() {
  const navigate = useNavigate();
  const bills = useBillStore(state => state.bills);
  const updateBill = useBillStore(state => state.updateBill);
  const recalculateOccupancy = useBillStore(state => state.recalculateOccupancy);
  const addAuditLog = useBillStore(state => state.addAuditLog);
  
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showConfirmed, setShowConfirmed] = useState(false);

  const allExceptions = useMemo(() => {
    return bills.flatMap(bill => 
      bill.exceptions
        .filter(exc => showConfirmed || !exc.confirmed)
        .map(exc => ({
          ...exc,
          bill,
        }))
    ).filter(exc => {
      if (severityFilter !== 'all' && exc.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && exc.type !== typeFilter) return false;
      return true;
    }).sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });
  }, [bills, severityFilter, typeFilter, showConfirmed]);

  const handleConfirmException = (billId: string, exceptionId: string, billNo: string) => {
    const bill = bills.find(b => b.id === billId);
    if (bill) {
      const updatedBill = confirmException(bill, exceptionId, '资金经理');
      updateBill(billId, updatedBill);
      recalculateOccupancy();
      addAuditLog({
        action: '确认异常',
        operator: '资金经理',
        details: `确认票据 ${billNo} 的异常`,
        billId,
        billNo,
      });
    }
  };

  const stats = useMemo(() => {
    const all = bills.flatMap(b => b.exceptions);
    return {
      total: all.length,
      unconfirmed: all.filter(e => !e.confirmed).length,
      high: all.filter(e => !e.confirmed && e.severity === 'high').length,
      medium: all.filter(e => !e.confirmed && e.severity === 'medium').length,
      low: all.filter(e => !e.confirmed && e.severity === 'low').length,
    };
  }, [bills]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">异常总数</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">待确认</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats.unconfirmed}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">高风险</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.high}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">中风险</p>
                <p className="text-2xl font-bold text-amber-500 mt-1">{stats.medium}</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">异常记录</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">严重程度:</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="input w-32 text-sm"
                >
                  <option value="all">全部</option>
                  <option value="high">高风险</option>
                  <option value="medium">中风险</option>
                  <option value="low">低风险</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">异常类型:</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="input w-40 text-sm"
                >
                  <option value="all">全部</option>
                  {(['overdue_not_released', 'extended_still_matured', 'duplicate_pledged', 'data_inconsistency'] as ExceptionType[]).map(type => (
                    <option key={type} value={type}>{getExceptionTypeLabel(type)}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showConfirmed}
                  onChange={(e) => setShowConfirmed(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm text-slate-700">显示已确认</span>
              </label>
            </div>
          </div>
        </div>

        <div className="card-body">
          {allExceptions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
              <p>暂无异常记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allExceptions.map((exc) => {
                const risk = getRiskScore(exc.bill);
                return (
                  <div 
                    key={exc.id} 
                    className={`border rounded-lg overflow-hidden ${
                      exc.confirmed ? 'bg-slate-50' :
                      exc.severity === 'high' ? 'border-red-200 bg-red-50/30' :
                      exc.severity === 'medium' ? 'border-amber-200 bg-amber-50/30' :
                      'border-blue-200 bg-blue-50/30'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`badge ${
                              exc.severity === 'high' ? 'bg-red-100 text-red-700' :
                              exc.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {getSeverityLabel(exc.severity)}
                            </span>
                            <span className="font-medium text-slate-800">
                              {getExceptionTypeLabel(exc.type)}
                            </span>
                            {exc.confirmed && (
                              <span className="badge bg-emerald-100 text-emerald-700">
                                已确认
                              </span>
                            )}
                            <span className={`status-badge ${getStatusColorClass(exc.bill.status)}`}>
                              {getStatusLabel(exc.bill.status)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 mb-3">
                            <div>
                              <span className="text-sm text-slate-500">票据编号:</span>
                              <span className="font-medium text-slate-800 ml-2">{exc.bill.billNo}</span>
                            </div>
                            <div>
                              <span className="text-sm text-slate-500">到期日:</span>
                              <span className="font-medium text-slate-800 ml-2">{exc.bill.maturityDate}</span>
                            </div>
                            <div>
                              <span className="text-sm text-slate-500">风险评分:</span>
                              <span className={`font-bold ml-2 ${
                                risk.level === 'high' ? 'text-red-600' :
                                risk.level === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                              }`}>
                                {risk.score}分
                              </span>
                            </div>
                            <div>
                              <span className="text-sm text-slate-500">检测时间:</span>
                              <span className="font-medium text-slate-800 ml-2">
                                {format(new Date(exc.detectedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-sm text-slate-600 mb-2">{exc.message}</p>
                          <p className="text-sm text-slate-500 bg-white/70 rounded p-3">
                            <strong>详细说明:</strong> {exc.explanation}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => navigate(`/bills?billId=${exc.bill.id}`)}
                            className="btn btn-secondary text-sm"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            查看票据
                          </button>
                          {!exc.confirmed && (
                            <button
                              onClick={() => handleConfirmException(exc.bill.id, exc.id, exc.bill.billNo)}
                              className="btn btn-success text-sm"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              确认异常
                            </button>
                          )}
                        </div>
                      </div>
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
