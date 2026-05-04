import React from 'react';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileCode,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  User,
  Clock,
  MapPin
} from 'lucide-react';

const Reports = () => {
  const [plans, setPlans] = React.useState([]);
  const [selectedPlan, setSelectedPlan] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    const loadPlans = async () => {
      try {
        const { plansApi } = await import('../utils/api');
        const res = await plansApi.getAll();
        const allPlans = res.data?.data || [];
        setPlans(allPlans);
        
        const active = allPlans.find(p => p.isActive);
        if (active) {
          setSelectedPlan(active);
        }
      } catch (error) {
        console.error('加载方案失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPlans();
  }, []);

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportDispatchTable = async (format) => {
    if (!selectedPlan) {
      alert('请先选择一个方案');
      return;
    }

    setExporting(true);
    try {
      const { exportApi } = await import('../utils/api');
      const res = await exportApi.getDispatchTable(selectedPlan.id, format);
      
      const timestamp = new Date().toISOString().split('T')[0];
      if (format === 'csv') {
        downloadBlob(res.data, `派单表-${selectedPlan.name}-${timestamp}.csv`);
      } else {
        const jsonStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        downloadBlob(blob, `派单表-${selectedPlan.name}-${timestamp}.json`);
      }
    } catch (error) {
      alert('导出失败: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const exportReport = async (format) => {
    if (!selectedPlan) {
      alert('请先选择一个方案');
      return;
    }

    setExporting(true);
    try {
      const { exportApi } = await import('../utils/api');
      const res = await exportApi.getReport(selectedPlan.id, format);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const extensions = {
        markdown: 'md',
        html: 'html',
        csv: 'csv',
        json: 'json'
      };
      
      const ext = extensions[format] || 'json';
      
      if (format === 'json') {
        const jsonStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        downloadBlob(blob, `复盘报告-${selectedPlan.name}-${timestamp}.${ext}`);
      } else {
        downloadBlob(res.data, `复盘报告-${selectedPlan.name}-${timestamp}.${ext}`);
      }
    } catch (error) {
      alert('导出失败: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">选择方案</h2>
          {exporting && (
            <div className="flex items-center gap-2 text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>导出中...</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无方案可导出</p>
            <p className="text-sm mt-1">请先在"路线规划"页面生成方案</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">{plan.name}</h3>
                    {plan.isActive && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        已激活
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    创建时间: {new Date(plan.createdAt).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-sm text-gray-500">
                    师傅数: {plan.routes?.length || 0} | 
                    任务数: {plan.routes?.reduce((acc, r) => acc + (r.stops?.filter(s => s.type === 'job').length || 0), 0) || 0}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              派单表导出
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              导出给师傅查看的派单表，包含每个师傅的任务列表、时间、地点等信息
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => exportDispatchTable('csv')}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出 CSV 格式
              </button>
              
              <button
                onClick={() => exportDispatchTable('json')}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                <FileCode className="w-4 h-4" />
                导出 JSON 格式
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              复盘报告导出
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              导出给老板查看的复盘报告，包含概览、风险评估、问题列表等
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => exportReport('html')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                HTML
              </button>
              
              <button
                onClick={() => exportReport('markdown')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Markdown
              </button>
              
              <button
                onClick={() => exportReport('csv')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </button>
              
              <button
                onClick={() => exportReport('json')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <FileCode className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPlan && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">方案预览</h3>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">总任务数</p>
              <p className="text-2xl font-bold text-blue-600">
                {selectedPlan.routes?.reduce((acc, r) => acc + (r.stops?.filter(s => s.type === 'job').length || 0), 0) || 0}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500">师傅数量</p>
              <p className="text-2xl font-bold text-green-600">
                {selectedPlan.routes?.length || 0}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-500">总距离</p>
              <p className="text-2xl font-bold text-orange-600">
                {(selectedPlan.routes?.reduce((acc, r) => acc + (r.totalDistance || 0), 0) || 0).toFixed(1)}km
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-500">风险数量</p>
              <p className="text-2xl font-bold text-red-600">
                {selectedPlan.routes?.reduce((acc, r) => acc + (r.risks?.length || 0), 0) || 0}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {selectedPlan.routes?.map((route, routeIndex) => {
              const jobStops = route.stops?.filter(s => s.type === 'job') || [];
              const hasRisks = route.risks && route.risks.length > 0;

              return (
                <div key={routeIndex} className={`border rounded-lg p-4 ${
                  hasRisks ? 'border-red-200 bg-red-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800">{route.workerName}</h4>
                        <p className="text-sm text-gray-500">
                          {route.workerSkills?.join('、') || ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Clock className="w-4 h-4" />
                        {Math.floor(route.totalMinutes / 60)}时{route.totalMinutes % 60}分
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {(route.totalDistance || 0).toFixed(1)}km
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        {jobStops.length} 个任务
                      </div>
                    </div>
                  </div>

                  {hasRisks && (
                    <div className="mb-3 p-2 bg-red-100 rounded flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-700">
                        存在 {route.risks.length} 个风险点，建议查看详细报告
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {jobStops.map((stop, stopIndex) => {
                      const stopHasRisk = stop.risks && stop.risks.length > 0;
                      
                      return (
                        <div key={stopIndex} className={`flex items-center gap-3 p-2 rounded ${
                          stopHasRisk ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                        }`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                            stopHasRisk ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                          }`}>
                            {stopIndex + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800 text-sm">{stop.locationName}</p>
                            <p className="text-xs text-gray-500">
                              {stop.serviceType} | {stop.serviceDurationMinutes}分钟
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-800">
                              {stop.etaMinutes ? `${String(Math.floor(stop.etaMinutes / 60)).padStart(2, '0')}:${String(stop.etaMinutes % 60).padStart(2, '0')}` : '-'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {stop.timeWindowStart} - {stop.timeWindowEnd}
                            </p>
                          </div>
                          {stopHasRisk && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
