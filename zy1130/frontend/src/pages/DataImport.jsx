import React from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  FileJson, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Trash2,
  Download,
  Info
} from 'lucide-react';

const DataImport = () => {
  const [files, setFiles] = React.useState({
    jobs: null,
    workers: null,
    travelTimes: null,
    roadRules: null
  });
  const [uploading, setUploading] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState({});
  const [clearExisting, setClearExisting] = React.useState(false);
  const [jobs, setJobs] = React.useState([]);
  const [workers, setWorkers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const { jobsApi, workersApi } = await import('../utils/api');
      const [jobsRes, workersRes] = await Promise.all([
        jobsApi.getAll(),
        workersApi.getAll()
      ]);
      setJobs(jobsRes.data?.data || []);
      setWorkers(workersRes.data?.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const fileTypes = [
    {
      key: 'jobs',
      label: '任务数据',
      description: 'jobs.csv - 客户任务信息，包括时间窗、服务类型等',
      icon: FileSpreadsheet,
      format: '.csv',
      example: `id,location_name,address,lat,lng,service_type,time_window_start,time_window_end,service_duration_minutes,priority,notes
1,阳光花园1号楼101,阳光路88号,31.234,121.456,维修,09:00,11:00,30,1,空调维修`
    },
    {
      key: 'workers',
      label: '师傅数据',
      description: 'workers.csv - 师傅信息，包括技能、起终点、工作时间等',
      icon: FileSpreadsheet,
      format: '.csv',
      example: `id,name,phone,skills,start_location_name,start_lat,start_lng,end_location_name,end_lat,end_lng,work_start_time,work_end_time,max_jobs,vehicle_type
1,张师傅,13800138001,"维修,保洁",站点A,31.230,121.450,站点A,31.230,121.450,08:00,18:00,6,电动车`
    },
    {
      key: 'travelTimes',
      label: '行程时间矩阵',
      description: 'travel-times.json - 地点间的行程时间矩阵',
      icon: FileJson,
      format: '.json',
      example: `{
  "locations": ["站点A", "站点B", "阳光花园1号楼"],
  "timeMatrix": [[0, 15, 10], [15, 0, 20], [10, 20, 0]],
  "distanceMatrix": [[0, 5, 3], [5, 0, 7], [3, 7, 0]]
}`
    },
    {
      key: 'roadRules',
      label: '限行规则',
      description: 'road-rules.json - 限行区域、午休规则等',
      icon: FileJson,
      format: '.json',
      example: `{
  "restrictedAreas": [],
  "lunchBreak": {
    "enabled": true,
    "startTime": "12:00",
    "endTime": "13:00",
    "durationMinutes": 60
  }
}`
    }
  ];

  const handleFileSelect = (key, file) => {
    setFiles(prev => ({ ...prev, [key]: file }));
    setImportStatus(prev => ({ ...prev, [key]: null }));
  };

  const handleUpload = async (key) => {
    const file = files[key];
    if (!file) return;

    setUploading(true);
    setImportStatus(prev => ({ ...prev, [key]: { status: 'uploading', message: '正在上传...' } }));

    try {
      const { importApi } = await import('../utils/api');
      const formData = new FormData();
      formData.append('file', file);

      let result;
      switch (key) {
        case 'jobs':
          result = await importApi.importJobs(formData, { clearExisting });
          break;
        case 'workers':
          result = await importApi.importWorkers(formData, { clearExisting });
          break;
        case 'travelTimes':
          result = await importApi.importTravelTimes(formData);
          break;
        case 'roadRules':
          result = await importApi.importRoadRules(formData);
          break;
      }

      setImportStatus(prev => ({
        ...prev,
        [key]: {
          status: 'success',
          message: `导入成功，共 ${result.data?.data?.imported || 0} 条记录`
        }
      }));

      if (key === 'jobs' || key === 'workers') {
        loadData();
      }
    } catch (error) {
      setImportStatus(prev => ({
        ...prev,
        [key]: {
          status: 'error',
          message: error.message || '导入失败'
        }
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleClearAll = async (type) => {
    if (!window.confirm(`确定要清空所有${type === 'jobs' ? '任务' : '师傅'}数据吗？`)) {
      return;
    }

    try {
      const api = type === 'jobs' ? (await import('../utils/api')).jobsApi : (await import('../utils/api')).workersApi;
      const res = type === 'jobs' ? await api.getAll() : await api.getAll();
      const items = res.data?.data || [];
      
      for (const item of items) {
        await api.delete(item.id);
      }
      
      loadData();
    } catch (error) {
      console.error('清空数据失败:', error);
      alert('清空数据失败: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">数据导入</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="rounded"
            />
            导入时清空现有数据
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {fileTypes.map((type) => {
            const Icon = type.icon;
            const status = importStatus[type.key];
            const file = files[type.key];

            return (
              <div key={type.key} className="border-2 border-dashed border-gray-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{type.label}</h3>
                    <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                    <p className="text-xs text-gray-400 mt-1">格式: {type.format}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="file"
                    id={`file-${type.key}`}
                    accept={type.format}
                    className="hidden"
                    onChange={(e) => handleFileSelect(type.key, e.target.files?.[0])}
                  />
                  <label
                    htmlFor={`file-${type.key}`}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 cursor-pointer transition-colors w-full"
                  >
                    <Upload className="w-4 h-4" />
                    {file ? file.name : '选择文件'}
                  </label>

                  {file && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        已选择: {file.name}
                      </span>
                      <button
                        onClick={() => handleUpload(type.key)}
                        disabled={uploading}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                      >
                        {uploading && <RefreshCw className="w-4 h-4 animate-spin" />}
                        导入
                      </button>
                    </div>
                  )}

                  {status && (
                    <div className={`mt-3 flex items-center gap-2 text-sm ${
                      status.status === 'success' ? 'text-green-600' : 
                      status.status === 'error' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {status.status === 'success' && <CheckCircle className="w-4 h-4" />}
                      {status.status === 'error' && <AlertCircle className="w-4 h-4" />}
                      {status.status === 'uploading' && <RefreshCw className="w-4 h-4 animate-spin" />}
                      {status.message}
                    </div>
                  )}
                </div>

                <details className="mt-4">
                  <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-700 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    查看格式示例
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 overflow-x-auto">
                    {type.example}
                  </pre>
                </details>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">已导入的任务</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleClearAll('jobs')}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="清空所有任务"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={loadData}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无任务数据，请先导入</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">地点</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">类型</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">时间窗</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">时长</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.slice(0, 10).map((job) => (
                    <tr key={job.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <div className="font-medium text-gray-800">{job.locationName}</div>
                        <div className="text-xs text-gray-500">{job.address}</div>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          job.serviceType === '维修' ? 'bg-blue-100 text-blue-700' :
                          job.serviceType === '保洁' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {job.serviceType}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-600">
                        {job.timeWindowStart} - {job.timeWindowEnd}
                      </td>
                      <td className="py-2 px-2 text-gray-600">
                        {job.serviceDurationMinutes}分钟
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {jobs.length > 10 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  显示前 10 条，共 {jobs.length} 条
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">已导入的师傅</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleClearAll('workers')}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="清空所有师傅"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={loadData}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : workers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无师傅数据，请先导入</div>
          ) : (
            <div className="space-y-3">
              {workers.map((worker) => (
                <div key={worker.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">{worker.name?.[0]}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{worker.name}</p>
                        <p className="text-xs text-gray-500">{worker.phone}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-600">最大任务: {worker.maxJobs}</div>
                      <div className="text-gray-500">{worker.vehicleType}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {worker.skills?.map((skill, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataImport;
