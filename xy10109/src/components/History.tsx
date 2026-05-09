import { useMemo } from 'react';
import { useAppContext } from '../context';

export function History() {
  const { history } = useAppContext();

  const getActionIcon = (action: string) => {
    if (action.includes('添加')) return '➕';
    if (action.includes('更新')) return '✏️';
    if (action.includes('删除')) return '🗑️';
    if (action.includes('复核')) return '✓';
    if (action.includes('导入')) return '📥';
    if (action.includes('导出')) return '📤';
    if (action.includes('刷新')) return '🔄';
    return '📝';
  };

  const getActionColor = (action: string) => {
    if (action.includes('删除')) return 'bg-red-100 text-red-700';
    if (action.includes('导入')) return 'bg-blue-100 text-blue-700';
    if (action.includes('导出')) return 'bg-green-100 text-green-700';
    if (action.includes('添加')) return 'bg-purple-100 text-purple-700';
    if (action.includes('复核')) return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-700';
  };

  const formatTime = (isoStr: string) => {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupedHistory = useMemo(() => {
    const groups: Record<string, typeof history> = {};
    
    for (const record of history) {
      const dateKey = new Date(record.timestamp).toLocaleDateString('zh-CN');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(record);
    }
    
    return Object.entries(groups).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [history]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">操作历史</h2>
        <span className="text-sm text-gray-500">
          共 {history.length} 条记录
        </span>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          <p className="text-5xl mb-4">📜</p>
          <p className="text-lg">暂无操作记录</p>
          <p className="text-sm mt-2">添加、编辑或导入证照后，操作记录将显示在这里</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedHistory.map(([date, records]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <span>📅</span>
                {date}
                <span className="text-gray-400">({records.length}条)</span>
              </h3>
              <div className="bg-white rounded-lg shadow divide-y">
                {records.map((record) => (
                  <div 
                    key={record.id} 
                    className="flex items-start gap-4 p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex-shrink-0">
                      <span className="text-2xl">{getActionIcon(record.action)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(record.action)}`}>
                          {record.action}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(record.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{record.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-700 mb-2">💡 历史记录说明</h4>
          <ul className="text-sm text-blue-600 space-y-1 list-disc list-inside">
            <li>历史记录会自动记录所有证照相关操作</li>
            <li>记录包含操作类型、详情和时间戳</li>
            <li>数据保存在本地浏览器中，不会上传到服务器</li>
          </ul>
        </div>
      )}
    </div>
  );
}
