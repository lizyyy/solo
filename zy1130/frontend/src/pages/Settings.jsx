import React from 'react';
import { 
  Settings, 
  Info, 
  Trash2, 
  RefreshCw,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

const Settings = () => {
  const [systemInfo, setSystemInfo] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [clearing, setClearing] = React.useState(false);

  const loadSystemInfo = React.useCallback(async () => {
    setLoading(true);
    try {
      const { systemApi } = await import('../utils/api');
      const [healthRes, statsRes, sampleRes] = await Promise.all([
        systemApi.health(),
        systemApi.stats(),
        systemApi.sampleData()
      ]);
      
      setSystemInfo({
        health: healthRes.data,
        stats: statsRes.data?.data,
        sampleData: sampleRes.data?.data
      });
    } catch (error) {
      console.error('加载系统信息失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  const handleClearAllData = async () => {
    if (!window.confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      return;
    }

    setClearing(true);
    try {
      const { jobsApi, workersApi, plansApi } = await import('../utils/api');
      
      const [jobsRes, workersRes, plansRes] = await Promise.all([
        jobsApi.getAll(),
        workersApi.getAll(),
        plansApi.getAll()
      ]);

      const jobs = jobsRes.data?.data || [];
      const workers = workersRes.data?.data || [];
      const plans = plansRes.data?.data || [];

      for (const job of jobs) {
        await jobsApi.delete(job.id);
      }

      for (const worker of workers) {
        await workersApi.delete(worker.id);
      }

      for (const plan of plans) {
        await plansApi.delete(plan.id);
      }

      loadSystemInfo();
      alert('数据已清空');
    } catch (error) {
      alert('清空数据失败: ' + error.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          系统设置
        </h2>

        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-3">系统状态</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {systemInfo?.health?.success ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-gray-500">服务状态</span>
                  </div>
                  <p className="font-medium text-gray-800">
                    {systemInfo?.health?.success ? '正常' : '异常'}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-500">任务数量</span>
                  </div>
                  <p className="font-medium text-gray-800">
                    {systemInfo?.stats?.jobs || 0}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-500">师傅数量</span>
                  </div>
                  <p className="font-medium text-gray-800">
                    {systemInfo?.stats?.workers || 0}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-gray-500">最后更新</span>
                  </div>
                  <p className="font-medium text-gray-800 text-sm">
                    {systemInfo?.stats?.timestamp 
                      ? new Date(systemInfo.stats.timestamp).toLocaleTimeString('zh-CN')
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-3">样例数据文件</h3>
              <div className="space-y-2">
                {[
                  { name: 'jobs.csv', desc: '任务数据（客户信息、时间窗等）' },
                  { name: 'workers.csv', desc: '师傅数据（技能、起终点等）' },
                  { name: 'travel-times.json', desc: '行程时间矩阵' },
                  { name: 'road-rules.json', desc: '限行规则、午休规则等' }
                ].map((file) => {
                  const available = systemInfo?.sampleData?.availableSampleFiles?.includes(file.name);
                  return (
                    <div key={file.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {available ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium text-gray-800">{file.name}</p>
                          <p className="text-sm text-gray-500">{file.desc}</p>
                        </div>
                      </div>
                      <span className={`text-sm ${available ? 'text-green-600' : 'text-red-600'}`}>
                        {available ? '已就绪' : '缺失'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                危险操作
              </h3>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-3">
                  清空所有数据将删除所有任务、师傅和派单方案。此操作不可恢复，请谨慎操作。
                </p>
                <button
                  onClick={handleClearAllData}
                  disabled={clearing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {clearing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {clearing ? '清空中...' : '清空所有数据'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600" />
          使用说明
        </h2>

        <div className="space-y-4 text-gray-600">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-800 mb-2">1. 数据准备</h3>
            <p className="text-sm">
              准备以下四个数据文件：
            </p>
            <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
              <li><code className="bg-white px-1 rounded">jobs.csv</code> - 客户任务信息</li>
              <li><code className="bg-white px-1 rounded">workers.csv</code> - 师傅信息</li>
              <li><code className="bg-white px-1 rounded">travel-times.json</code> - 行程时间矩阵</li>
              <li><code className="bg-white px-1 rounded">road-rules.json</code> - 限行和午休规则</li>
            </ul>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-green-800 mb-2">2. 生成方案</h3>
            <p className="text-sm">
              导入数据后，在"路线规划"页面点击"生成方案"，系统将自动根据以下约束条件优化路线：
            </p>
            <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
              <li>客户时间窗要求</li>
              <li>师傅技能匹配</li>
              <li>午休时间安排</li>
              <li>限行规则规避</li>
              <li>最短总距离和总时间</li>
            </ul>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <h3 className="font-medium text-purple-800 mb-2">3. 方案管理</h3>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>支持临时加单并重排</li>
              <li>支持多方案对比（最多3个）</li>
              <li>支持方案版本管理</li>
              <li>支持激活指定方案</li>
            </ul>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg">
            <h3 className="font-medium text-orange-800 mb-2">4. 导出报告</h3>
            <p className="text-sm">支持以下导出格式：</p>
            <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
              <li><strong>派单表</strong>: CSV、JSON 格式（给师傅）</li>
              <li><strong>复盘报告</strong>: HTML、Markdown、CSV、JSON 格式（给老板）</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">风险类型说明</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800">迟到风险</span>
            </div>
            <p className="text-sm text-red-700">
              预计到达时间晚于客户时间窗开始时间，可能导致客户等待或投诉
            </p>
          </div>

          <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-800">超时风险</span>
            </div>
            <p className="text-sm text-orange-700">
              预计结束时间晚于师傅工作时间限制，可能导致加班
            </p>
          </div>

          <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">技能不匹配</span>
            </div>
            <p className="text-sm text-yellow-700">
              师傅技能与任务服务类型不匹配，可能影响服务质量
            </p>
          </div>

          <div className="p-4 border border-purple-200 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-800">限行冲突</span>
            </div>
            <p className="text-sm text-purple-700">
              任务区域或时间存在限行规则冲突，可能导致无法通行
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
