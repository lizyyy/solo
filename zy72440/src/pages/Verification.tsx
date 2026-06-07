import { FileText, CheckCircle, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '@/store/inventoryStore';

export function Verification() {
  const navigate = useNavigate();
  const { records } = useInventoryStore();
  
  const recordsWithVerification = records.filter(r => r.verificationOrder);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-800 mb-1">课时核销单对账</h3>
            <p className="text-blue-700 text-sm">
              核对课时核销单与库存记录是否一致，确保数据准确。
            </p>
            <div className="flex gap-6 mt-3">
              <div>
                <span className="text-blue-600 text-sm">已对账</span>
                <p className="text-xl font-bold text-blue-800">
                  {recordsWithVerification.filter(r => r.verificationOrder?.status === 'matched').length}
                </p>
              </div>
              <div>
                <span className="text-red-600 text-sm">存在差异</span>
                <p className="text-xl font-bold text-red-600">
                  {recordsWithVerification.filter(r => r.verificationOrder?.status === 'mismatch').length}
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-sm">待对账</span>
                <p className="text-xl font-bold text-slate-700">
                  {recordsWithVerification.filter(r => r.verificationOrder?.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">核销单列表</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">核销单号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">艺人/活动</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">商品</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">记录数量</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">核销数量</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">金额</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recordsWithVerification.map(record => {
                const order = record.verificationOrder!;
                const isMismatch = order.status === 'mismatch';
                const quantityDiff = record.quantity !== order.quantity;
                
                return (
                  <tr 
                    key={order.id} 
                    className={`hover:bg-slate-50 ${isMismatch ? 'bg-red-50/50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-slate-800">{order.orderNo}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{record.artistName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {record.merchandise}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={`font-medium ${quantityDiff ? 'text-red-600' : 'text-slate-800'}`}>
                        {record.quantity} 件
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={`font-medium ${quantityDiff ? 'text-red-600' : 'text-slate-800'}`}>
                        {order.quantity} 件
                        {quantityDiff && <span className="ml-1 text-xs">(不一致)</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-800">
                      ¥ {order.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {order.status === 'matched' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          <CheckCircle className="w-3.5 h-3.5" />
                          已对账
                        </span>
                      )}
                      {order.status === 'mismatch' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          存在差异
                        </span>
                      )}
                      {order.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          <Clock className="w-3.5 h-3.5" />
                          待对账
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => navigate(`/records/${record.id}`)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 ml-auto"
                      >
                        查看详情 <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {recordsWithVerification.length === 0 && (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">暂无核销单记录</p>
          </div>
        )}
      </div>

      {recordsWithVerification.some(r => r.verificationOrder?.status === 'mismatch') && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            差异说明
          </h4>
          <div className="space-y-2">
            {recordsWithVerification
              .filter(r => r.verificationOrder?.status === 'mismatch')
              .map(record => (
                <div key={record.id} className="flex items-start gap-3 text-sm text-red-700">
                  <span className="font-mono bg-red-100 px-2 py-0.5 rounded">{record.verificationOrder?.orderNo}</span>
                  <span>{record.verificationOrder?.mismatchReason}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
