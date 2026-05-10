import { useApp } from '../context/AppContext';
import { exportToCSV, getIssueTypeText, getStatusText } from '../utils/helpers';

export const Dashboard = () => {
  const { state, getIssuesByStall, getRectificationsByStall } = useApp();
  const { stalls, issues, rectifications, inspectionRecords } = state;

  const stats = {
    totalStalls: stalls.length,
    normalStalls: stalls.filter(s => s.status === 'normal').length,
    issueStalls: stalls.filter(s => s.status === 'has_issue').length,
    pendingRectStalls: stalls.filter(s => s.status === 'pending_rectification').length,
    rectifiedStalls: stalls.filter(s => s.status === 'rectified').length,
    totalIssues: issues.length,
    oilIssues: issues.filter(i => i.type === 'oil').length,
    fireIssues: issues.filter(i => i.type === 'fire').length,
    totalRectifications: rectifications.length,
    pendingRect: rectifications.filter(r => r.status === 'pending').length,
    inProgressRect: rectifications.filter(r => r.status === 'in_progress').length,
    completedRect: rectifications.filter(r => r.status === 'completed').length,
    verifiedRect: rectifications.filter(r => r.status === 'verified').length,
    totalInspections: inspectionRecords.length,
  };

  const exportStalls = () => {
    const data = stalls.map(stall => ({
      摊位编号: stall.id,
      摊位名称: stall.name,
      摊主: stall.owner,
      类别: stall.category,
      位置: `第${stall.row + 1}排第${stall.col + 1}位`,
      状态: getStatusText(stall.status),
    }));
    exportToCSV(data, `夜市摊位_${new Date().toISOString().split('T')[0]}`);
  };

  const exportIssues = () => {
    const data = issues.map(issue => {
      const stall = stalls.find(s => s.id === issue.stallId);
      return {
        问题编号: issue.id,
        摊位名称: stall?.name || '未知',
        问题类型: getIssueTypeText(issue.type),
        严重程度: issue.severity,
        描述: issue.description,
        发现时间: issue.discoveredAt,
        发现人: issue.discoveredBy,
      };
    });
    exportToCSV(data, `问题记录_${new Date().toISOString().split('T')[0]}`);
  };

  const exportRectifications = () => {
    const data = rectifications.map(rect => {
      const stall = stalls.find(s => s.id === rect.stallId);
      const issue = issues.find(i => i.id === rect.issueId);
      return {
        整改编号: rect.id,
        摊位名称: stall?.name || '未知',
        问题类型: issue ? getIssueTypeText(issue.type) : '未知',
        状态: rect.status,
        截止日期: rect.deadline,
        完成日期: rect.completedAt || '',
        验证日期: rect.verifiedAt || '',
        整改措施: rect.rectificationMethod || '',
        备注: rect.notes || '',
      };
    });
    exportToCSV(data, `整改记录_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">统计概览</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600 mb-2">摊位分布</h3>
            <div className="text-2xl font-bold text-gray-800 mb-2">{stats.totalStalls}</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">正常</span>
                <span className="font-medium text-green-600">{stats.normalStalls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">有问题</span>
                <span className="font-medium text-red-600">{stats.issueStalls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">整改中</span>
                <span className="font-medium text-yellow-600">{stats.pendingRectStalls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">已整改</span>
                <span className="font-medium text-blue-600">{stats.rectifiedStalls}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600 mb-2">问题统计</h3>
            <div className="text-2xl font-bold text-gray-800 mb-2">{stats.totalIssues}</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">油污问题</span>
                <span className="font-medium text-amber-600">{stats.oilIssues}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">明火问题</span>
                <span className="font-medium text-orange-600">{stats.fireIssues}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600 mb-2">整改情况</h3>
            <div className="text-2xl font-bold text-gray-800 mb-2">{stats.totalRectifications}</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">待整改</span>
                <span className="font-medium text-red-600">{stats.pendingRect}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">整改中</span>
                <span className="font-medium text-yellow-600">{stats.inProgressRect}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">已完成</span>
                <span className="font-medium text-green-600">{stats.completedRect}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">已验证</span>
                <span className="font-medium text-blue-600">{stats.verifiedRect}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600 mb-2">巡查记录</h3>
            <div className="text-2xl font-bold text-gray-800">{stats.totalInspections}</div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-600 mb-3">数据导出</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportStalls}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              导出摊位数据
            </button>
            <button
              onClick={exportIssues}
              className="px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
            >
              导出问题记录
            </button>
            <button
              onClick={exportRectifications}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              导出整改记录
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">摊位状态清单</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">摊位名称</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">摊主</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">类别</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">状态</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">问题数</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">整改数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stalls.map(stall => {
                const stallIssues = getIssuesByStall(stall.id);
                const stallRectifications = getRectificationsByStall(stall.id);
                return (
                  <tr key={stall.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{stall.name}</td>
                    <td className="px-4 py-3 text-gray-600">{stall.owner}</td>
                    <td className="px-4 py-3 text-gray-600">{stall.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        stall.status === 'normal' ? 'bg-green-100 text-green-800' :
                        stall.status === 'has_issue' ? 'bg-red-100 text-red-800' :
                        stall.status === 'pending_rectification' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {getStatusText(stall.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{stallIssues.length}</td>
                    <td className="px-4 py-3 text-gray-600">{stallRectifications.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
