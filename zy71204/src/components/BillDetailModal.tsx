import { useState } from 'react';
import { X, Clock, AlertTriangle, CheckCircle, FileText, Calculator, History } from 'lucide-react';
import { Bill } from '@/types/bill';
import { 
  getStatusLabel, 
  getStatusColorClass, 
  getAvailableTransitions,
  transitionBill 
} from '@/services/billStateMachine';
import { 
  getExceptionTypeLabel, 
  getSeverityLabel,
  confirmException 
} from '@/services/exceptionDetector';
import { 
  calculateBillOccupancy, 
  getRiskScore,
  getMaturityWarningLevel,
  getMaturityWarningText
} from '@/services/occupancyCalculator';
import useBillStore from '@/store/useBillStore';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface BillDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
}

type TabType = 'overview' | 'history' | 'exceptions' | 'calculation';

export default function BillDetailModal({ isOpen, onClose, bill }: BillDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { updateBill, recalculateOccupancy, addAuditLog } = useBillStore();

  if (!isOpen || !bill) return null;

  const risk = getRiskScore(bill);
  const warningLevel = getMaturityWarningLevel(bill);
  const occupancy = calculateBillOccupancy(bill);
  const availableTransitions = getAvailableTransitions(bill);

  const handleStatusTransition = (targetStatus: any, action: string) => {
    const updatedBill = transitionBill(bill, targetStatus, '资金经理');
    updateBill(bill.id, updatedBill);
    recalculateOccupancy();
    addAuditLog({
      action: `状态变更: ${action}`,
      operator: '资金经理',
      details: `票据 ${bill.billNo} 状态变更为 ${getStatusLabel(targetStatus)}`,
      billId: bill.id,
      billNo: bill.billNo,
    });
  };

  const handleConfirmException = (exceptionId: string) => {
    const updatedBill = confirmException(bill, exceptionId, '资金经理');
    updateBill(bill.id, updatedBill);
    recalculateOccupancy();
    addAuditLog({
      action: '确认异常',
      operator: '资金经理',
      details: `确认票据 ${bill.billNo} 的异常`,
      billId: bill.id,
      billNo: bill.billNo,
    });
  };

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'overview', label: '概览', icon: FileText },
    { key: 'history', label: '状态历史', icon: History },
    { key: 'exceptions', label: '异常记录', icon: AlertTriangle },
    { key: 'calculation', label: '占用计算', icon: Calculator },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{bill.billNo}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`status-badge ${getStatusColorClass(bill.status)}`}>
                {getStatusLabel(bill.status)}
              </span>
              {warningLevel !== 'none' && (
                <span className={`badge ${
                  warningLevel === 'overdue' ? 'bg-red-100 text-red-700' :
                  warningLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                  warningLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {getMaturityWarningText(warningLevel)}
                </span>
              )}
              <span className="text-sm text-slate-500">
                风险评分: 
                <span className={`font-bold ml-1 ${
                  risk.level === 'high' ? 'text-red-600' :
                  risk.level === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {risk.score}
                </span> 分
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'text-primary-600 border-primary-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.key === 'exceptions' && bill.exceptions.filter(e => !e.confirmed).length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {bill.exceptions.filter(e => !e.confirmed).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800">基本信息</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">票据编号</span>
                      <span className="font-medium text-slate-800">{bill.billNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">质押状态</span>
                      <span className="font-medium text-slate-800">{bill.pledgeStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">到期日</span>
                      <span className="font-medium text-slate-800">{bill.maturityDate}</span>
                    </div>
                    {bill.originalMaturityDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">原始到期日</span>
                        <span className="font-medium text-slate-800">{bill.originalMaturityDate}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800">金额信息</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">保证金</span>
                      <span className="font-mono font-medium text-slate-800">¥{bill.margin.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">计算占用</span>
                      <span className="font-mono font-medium text-primary-600">¥{(bill.calculatedOccupancy || bill.margin).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">释放申请</span>
                      <span className="font-medium text-slate-800">{bill.releaseApplication || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">占用报告</span>
                      <span className="font-medium text-slate-800">{bill.occupancyReport || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {availableTransitions.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-3">可用操作</h3>
                  <div className="flex gap-3">
                    {availableTransitions.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => handleStatusTransition(t.status, t.action)}
                        className="btn btn-primary"
                      >
                        {t.action}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-3">风险因素说明</h3>
                <div className="bg-slate-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-slate-600">
                    {risk.factors.map((factor, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary-500 mt-1">•</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-3">来源信息</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-500">来源文件: {bill.sourceFile}</span>
                  <span className="text-slate-500">创建时间: {format(new Date(bill.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                {[...bill.statusHistory].reverse().map((item, index) => (
                  <div key={item.id} className="relative flex gap-4 pb-6">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                      index === 0 ? 'bg-primary-600' : 'bg-slate-200'
                    }`}>
                      <Clock className={`w-4 h-4 ${index === 0 ? 'text-white' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`status-badge ${getStatusColorClass(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                        <span className="text-sm text-slate-500">
                          {format(new Date(item.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{item.reason}</p>
                      <p className="text-xs text-slate-400 mt-1">操作人: {item.operator}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'exceptions' && (
            <div className="space-y-4">
              {bill.exceptions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                  <p>暂无异常记录</p>
                </div>
              ) : (
                bill.exceptions.map(exc => (
                  <div 
                    key={exc.id} 
                    className={`${
                      exc.confirmed ? 'bg-slate-50' :
                      exc.severity === 'high' ? 'bg-red-50 border-l-4 border-red-500' :
                      exc.severity === 'medium' ? 'bg-amber-50 border-l-4 border-amber-500' :
                      'bg-blue-50 border-l-4 border-blue-500'
                    } rounded-lg p-4`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
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
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{exc.message}</p>
                        <p className="text-sm text-slate-500 bg-white/50 rounded p-3">
                          <strong>详细说明:</strong> {exc.explanation}
                        </p>
                      </div>
                      {!exc.confirmed && (
                        <button
                          onClick={() => handleConfirmException(exc.id)}
                          className="btn btn-success text-sm"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          确认
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span>检测时间: {format(new Date(exc.detectedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                      {exc.confirmed && (
                        <>
                          <span>确认人: {exc.confirmedBy}</span>
                          <span>确认时间: {exc.confirmedAt && format(new Date(exc.confirmedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'calculation' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold text-slate-800">占用计算明细</h3>
                </div>
                <div className="card-body">
                  <div className="space-y-3">
                    {occupancy.calculationDetails.map((detail, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <span className="text-slate-600">{detail.split(': ')[0]}</span>
                        <span className={`font-mono font-medium ${
                          detail.includes('最终占用') ? 'text-primary-600 text-lg' : 'text-slate-800'
                        }`}>
                          {detail.split(': ')[1]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold text-slate-800">计算规则说明</h3>
                </div>
                <div className="card-body">
                  <div className="space-y-4 text-sm text-slate-600">
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2">状态系数</h4>
                      <ul className="space-y-1">
                        <li>• 待处理/已质押: 基础保证金 × 1.0</li>
                        <li>• 已展期: 基础保证金 × 0.95</li>
                        <li>• 已到期: 基础保证金 × 1.1</li>
                        <li>• 待确认: 基础保证金 × 1.2</li>
                        <li>• 已释放/已结清: 占用为 0</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2">异常系数</h4>
                      <ul className="space-y-1">
                        <li>• 每个未确认高优先级异常: +10%</li>
                        <li>• 每个未确认中优先级异常: +5%</li>
                      </ul>
                    </div>
                    <div className="bg-primary-50 rounded-lg p-3 text-primary-700">
                      最终占用 = 基础保证金 × 状态系数 × 异常系数
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
