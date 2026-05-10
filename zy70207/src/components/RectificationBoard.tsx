import { useApp } from '../context/AppContext';
import {
  formatDate,
  getRectificationStatusText,
  getRectificationStatusColor,
} from '../utils/helpers';

export const RectificationBoard = () => {
  const { state } = useApp();
  const { rectifications, stalls } = state;

  const sortedRectifications = [...rectifications].sort((a, b) => {
    if (a.status === b.status) {
      return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
    }
    const statusOrder = { pending: 0, in_progress: 1, completed: 2, verified: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const stats = {
    pending: rectifications.filter(r => r.status === 'pending').length,
    inProgress: rectifications.filter(r => r.status === 'in_progress').length,
    completed: rectifications.filter(r => r.status === 'completed').length,
    verified: rectifications.filter(r => r.status === 'verified').length,
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">整改公示 - 统计概览</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <div className="text-3xl font-bold text-red-600">{stats.pending}</div>
            <div className="text-sm text-red-700">待整改</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg text-center">
            <div className="text-3xl font-bold text-yellow-600">{stats.inProgress}</div>
            <div className="text-sm text-yellow-700">整改中</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-green-700">已完成</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.verified}</div>
            <div className="text-sm text-blue-700">已验证</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">整改公示 - 详细列表</h2>
        
        {sortedRectifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>暂无整改记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">摊位</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">状态</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">截止日期</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">完成日期</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">验证日期</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">整改措施</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedRectifications.map((rect) => {
                  const stall = stalls.find(s => s.id === rect.stallId);
                  return (
                    <tr key={rect.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {stall?.name || '未知摊位'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${getRectificationStatusColor(rect.status)}`}>
                          {getRectificationStatusText(rect.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(rect.deadline)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {rect.completedAt ? formatDate(rect.completedAt) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {rect.verifiedAt ? formatDate(rect.verifiedAt) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {rect.rectificationMethod || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
