import { useAppStore } from '@/store/useAppStore';
import { sampleSensorRecords } from '@/data/sampleData';
import {
  Activity,
  FileText,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

export function Dashboard() {
  const { snapshots, setSensorRecords, setCurrentPage } = useAppStore();

  const stats = [
    {
      label: '已保存快照',
      value: snapshots.length,
      icon: <FileText className="text-primary-400" />,
      change: '+2 本周',
    },
    {
      label: '传感器记录',
      value: sampleSensorRecords.length,
      icon: <Activity className="text-green-400" />,
      change: '示例数据',
    },
    {
      label: '待审核记录',
      value: 2,
      icon: <AlertTriangle className="text-amber-400" />,
      change: '需要确认',
    },
    {
      label: '定位精度',
      value: '95.2%',
      icon: <TrendingUp className="text-primary-400" />,
      change: '平均质量',
    },
  ];

  const loadSampleData = () => {
    setSensorRecords(sampleSensorRecords);
    setCurrentPage('workspace');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="card">
        <div className="card-body">
          <h3 className="text-xl font-bold text-white mb-2">
            欢迎使用地震波到时定位工具
          </h3>
          <p className="text-slate-400 mb-6">
            集成物理近似计算、单位换算、阈值提醒和报告生成的一体化工作流
          </p>
          <button
            onClick={loadSampleData}
            className="btn-primary inline-flex items-center gap-2"
          >
            加载示例数据并开始
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{stat.change}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  {stat.icon}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h4 className="font-semibold text-white">快速开始</h4>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                1
              </span>
              <div>
                <p className="font-medium text-white">导入数据</p>
                <p className="text-sm text-slate-400">
                  上传传感器记录或使用示例数据
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                2
              </span>
              <div>
                <p className="font-medium text-white">配置参数</p>
                <p className="text-sm text-slate-400">
                  设置波速、阈值和计算方法
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                3
              </span>
              <div>
                <p className="font-medium text-white">执行计算</p>
                <p className="text-sm text-slate-400">
                  运行定位算法，处理异常值
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                4
              </span>
              <div>
                <p className="font-medium text-white">生成报告</p>
                <p className="text-sm text-slate-400">
                  导出分析报告和定位结果
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h4 className="font-semibold text-white">最近快照</h4>
          </div>
          <div className="card-body">
            {snapshots.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                暂无历史记录快照
              </p>
            ) : (
              <div className="space-y-3">
                {snapshots.slice(0, 5).map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">
                        {snapshot.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(snapshot.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      操作员: {snapshot.operator}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
