import { StoreType } from '../store/useStore';
import { BarChart3, Film, RefreshCw, AlertTriangle, Printer, CheckCircle, XCircle } from 'lucide-react';

interface StatisticsPageProps {
  store: StoreType;
}

const StatisticsPage = ({ store }: StatisticsPageProps) => {
  const { getStatistics, state } = store;
  const stats = getStatistics();

  const abnormalTypeCounts = state.abnormalRecords.reduce((acc, record) => {
    acc[record.type] = (acc[record.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getAbnormalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      code_invalid: '取片码无效',
      code_expired: '取片码过期',
      code_used: '取片码已使用',
      mismatch: '信息不匹配',
      printer_error: '打印机错误',
      other: '其他异常'
    };
    return labels[type] || type;
  };

  const printTypeCounts = state.printRecords.reduce((acc, record) => {
    acc[record.printType] = (acc[record.printType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-teal-100 p-2 rounded-lg">
            <BarChart3 className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">统计分析</h2>
            <p className="text-sm text-gray-500">取片、打印、补打和异常数据统计</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <Film className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-sm text-blue-600 mb-1">总取片码</p>
            <p className="text-3xl font-bold text-blue-900">{stats.totalPickups}</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <Printer className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-sm text-green-600 mb-1">总打印次数</p>
            <p className="text-3xl font-bold text-green-900">{stats.totalPrints}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <RefreshCw className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-sm text-purple-600 mb-1">补打申请总数</p>
            <p className="text-3xl font-bold text-purple-900">{stats.reprintRequests}</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-sm text-red-600 mb-1">异常记录总数</p>
            <p className="text-3xl font-bold text-red-900">{stats.abnormalRecords}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 text-purple-600" />
              <span>补打申请统计</span>
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-gray-600">待审核</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{stats.pendingReprints}</span>
                  <span className="text-sm text-gray-500">
                    ({stats.reprintRequests > 0 ? Math.round((stats.pendingReprints / stats.reprintRequests) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-yellow-500 h-3 rounded-full" 
                  style={{ 
                    width: `${stats.reprintRequests > 0 ? (stats.pendingReprints / stats.reprintRequests) * 100 : 0}%` 
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-600">已批准</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{stats.approvedReprints}</span>
                  <span className="text-sm text-gray-500">
                    ({stats.reprintRequests > 0 ? Math.round((stats.approvedReprints / stats.reprintRequests) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full" 
                  style={{ 
                    width: `${stats.reprintRequests > 0 ? (stats.approvedReprints / stats.reprintRequests) * 100 : 0}%` 
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-600">已拒绝</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{stats.rejectedReprints}</span>
                  <span className="text-sm text-gray-500">
                    ({stats.reprintRequests > 0 ? Math.round((stats.rejectedReprints / stats.reprintRequests) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-red-500 h-3 rounded-full" 
                  style={{ 
                    width: `${stats.reprintRequests > 0 ? (stats.rejectedReprints / stats.reprintRequests) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>异常记录统计</span>
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-600">已处理</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{stats.resolvedAbnormals}</span>
                  <span className="text-sm text-gray-500">
                    ({stats.abnormalRecords > 0 ? Math.round((stats.resolvedAbnormals / stats.abnormalRecords) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full" 
                  style={{ 
                    width: `${stats.abnormalRecords > 0 ? (stats.resolvedAbnormals / stats.abnormalRecords) * 100 : 0}%` 
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-gray-600">待处理</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {stats.abnormalRecords - stats.resolvedAbnormals}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({stats.abnormalRecords > 0 ? Math.round(((stats.abnormalRecords - stats.resolvedAbnormals) / stats.abnormalRecords) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-yellow-500 h-3 rounded-full" 
                  style={{ 
                    width: `${stats.abnormalRecords > 0 ? ((stats.abnormalRecords - stats.resolvedAbnormals) / stats.abnormalRecords) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">异常类型分布</h3>
          {Object.keys(abnormalTypeCounts).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(abnormalTypeCounts).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{getAbnormalTypeLabel(type)}</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ 
                          width: `${(count / stats.abnormalRecords) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">暂无异常记录</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">打印类型分布</h3>
          {Object.keys(printTypeCounts).length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">原始打印</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ 
                        width: `${stats.totalPrints > 0 ? ((printTypeCounts.original || 0) / stats.totalPrints) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">
                    {printTypeCounts.original || 0}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">补打</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ 
                        width: `${stats.totalPrints > 0 ? ((printTypeCounts.reprint || 0) / stats.totalPrints) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">
                    {printTypeCounts.reprint || 0}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">暂无打印记录</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">最近打印记录</h3>
        {state.printRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">患者</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">检查号</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">打印类型</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">胶片数量</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">打印机</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">打印时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {state.printRecords.slice(0, 10).map(record => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-gray-900">{record.patientName}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{record.examNo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        record.printType === 'original' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {record.printType === 'original' ? '原始打印' : '补打'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{record.filmCount} 张</td>
                    <td className="px-4 py-3 text-gray-600">{record.printerName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(record.printedAt).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">暂无打印记录</p>
        )}
      </div>
    </div>
  );
};

export default StatisticsPage;
