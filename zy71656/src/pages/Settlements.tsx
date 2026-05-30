import { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Lock,
  Download,
  Eye,
  LockOpen,
} from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { useNavigate } from 'react-router-dom';

export default function Settlements() {
  const { settlements, loadSettlements, lockSettlement, exportSettlement } = useStore();
  const navigate = useNavigate();
  const [selectedSettlement, setSelectedSettlement] = useState<string | null>(null);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  const handleLock = (id: string) => {
    if (confirm('确定要锁定此结算吗？锁定后将无法重新计算。')) {
      lockSettlement(id, '当前用户');
    }
  };

  const handleExport = (id: string) => {
    exportSettlement({
      settlementId: id,
      format: 'EXCEL',
      includeTrail: true,
      includeRawData: false,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">结算报告</h2>
        <p className="text-gray-500 mt-1">查看和管理所有结算批次</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">结算周期</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">作者</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">明细条数</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">异常数量</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">总金额</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">状态</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">创建时间</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {settlements.length > 0 ? (
                settlements.map((settlement) => (
                  <tr key={settlement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-blue-500" size={18} />
                        <span className="font-medium text-gray-800">
                          {settlement.period}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {settlement.authorId || '全部作者'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">
                      {settlement.itemCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">
                      {settlement.exceptionCount}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800 text-right">
                      ¥{settlement.totalAmount.toLocaleString('zh-CN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                          settlement.status === 'LOCKED'
                            ? 'bg-gray-100 text-gray-600'
                            : settlement.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-yellow-100 text-yellow-600'
                        }`}
                      >
                        {settlement.status === 'LOCKED' ? (
                          <Lock size={12} />
                        ) : (
                          <LockOpen size={12} />
                        )}
                        {settlement.status === 'LOCKED'
                          ? '已锁定'
                          : settlement.status === 'COMPLETED'
                          ? '已完成'
                          : '处理中'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(settlement.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/settlement/${settlement.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleExport(settlement.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="导出"
                        >
                          <Download size={16} />
                        </button>
                        {settlement.status !== 'LOCKED' && (
                          <button
                            onClick={() => handleLock(settlement.id)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="锁定"
                          >
                            <Lock size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    暂无结算记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
