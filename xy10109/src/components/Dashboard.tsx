import { useAppContext } from '../context';

export function Dashboard() {
  const { getStatistics, refreshStatuses } = useAppContext();
  const stats = getStatistics();

  const typeStats = [
    { type: 'store_license' as const, name: '门店许可证', count: stats.byType.store_license },
    { type: 'health_certificate' as const, name: '员工健康证', count: stats.byType.health_certificate },
    { type: 'supplier_qualification' as const, name: '供应商资质', count: stats.byType.supplier_qualification },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">数据概览</h2>
        <button
          onClick={refreshStatuses}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-2"
        >
          <span>🔄</span>
          刷新状态
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">证照总数</p>
          <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <p className="text-sm text-gray-500">有效证照</p>
          <p className="text-3xl font-bold text-green-600">{stats.valid}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">即将过期</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.expiringSoon}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <p className="text-sm text-gray-500">已过期</p>
          <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">证照类型分布</h3>
          <div className="space-y-3">
            {typeStats.map(item => (
              <div key={item.type} className="flex items-center justify-between">
                <span className="text-gray-600">{item.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all"
                      style={{ 
                        width: stats.total > 0 ? `${(item.count / stats.total) * 100}%` : '0%' 
                      }}
                    />
                  </div>
                  <span className="font-semibold w-12 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">复核状态</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">待复核</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all"
                    style={{ 
                      width: stats.total > 0 ? `${(stats.notReviewed / stats.total) * 100}%` : '0%' 
                    }}
                  />
                </div>
                <span className="font-semibold w-12 text-right text-orange-600">{stats.notReviewed}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">已复核</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all"
                    style={{ 
                      width: stats.total > 0 ? `${((stats.total - stats.notReviewed) / stats.total) * 100}%` : '0%' 
                    }}
                  />
                </div>
                <span className="font-semibold w-12 text-right text-green-600">{stats.total - stats.notReviewed}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(stats.expiringSoon > 0 || stats.expired > 0) && (
        <div className={`rounded-lg p-4 ${
          stats.expired > 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <h3 className={`font-semibold mb-2 ${
            stats.expired > 0 ? 'text-red-700' : 'text-yellow-700'
          }`}>
            ⚠️ 注意事项
          </h3>
          <ul className={`text-sm space-y-1 ${
            stats.expired > 0 ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {stats.expired > 0 && (
              <li>• 有 {stats.expired} 个证照已过期，请及时处理</li>
            )}
            {stats.expiringSoon > 0 && (
              <li>• 有 {stats.expiringSoon} 个证照将在 30 天内到期，请提前续期</li>
            )}
            {stats.notReviewed > 0 && (
              <li>• 有 {stats.notReviewed} 个证照需要人工复核</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
