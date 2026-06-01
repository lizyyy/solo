import { Link } from 'react-router-dom';
import { mockRecords } from '../data/mockRecords';
import { RecordStatus } from '../types';
import { CheckCircle, AlertTriangle, Clock, Zap, Cpu, Timer } from 'lucide-react';

const statusConfig: Record<
  RecordStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  success: {
    label: '顺利',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/30',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  pending: {
    label: '待确认',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 border-orange-500/30',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  legacy: {
    label: '旧口径',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10 border-gray-500/30',
    icon: <Clock className="w-4 h-4" />,
  },
};

const Home = () => {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-3xl font-bold mb-2 text-blue-400">
            无人车避障训练场
          </h1>
          <p className="text-zinc-400">
            选择练习记录开始训练，每次操作都会影响资源、分数和风险
          </p>
        </header>

        <div className="grid gap-6">
          {mockRecords.map((record) => {
            const config = statusConfig[record.status];
            return (
              <div
                key={record.id}
                className={`p-6 rounded-lg border ${config.bgColor} backdrop-blur-sm transition-all hover:scale-[1.01] hover:shadow-lg`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-semibold">{record.title}</h2>
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${config.color} ${config.bgColor}`}
                      >
                        {config.icon}
                        {config.label}
                      </span>
                      {record.source === 'student_import' && (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-purple-500/10 border border-purple-500/30 text-purple-400">
                          学生导入
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm mb-4">
                      {record.description}
                    </p>
                  </div>
                  <span className="text-zinc-500 text-xs">
                    {record.createdAt}
                  </span>
                </div>

                <div className="flex items-center gap-6 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-zinc-400">能源:</span>
                    <span className="font-mono">
                      {record.initialResources.energy}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span className="text-zinc-400">算力:</span>
                    <span className="font-mono">
                      {record.initialResources.compute}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-green-400" />
                    <span className="text-zinc-400">时间:</span>
                    <span className="font-mono">
                      {record.initialResources.time}
                    </span>
                  </div>
                  <div className="text-zinc-400">
                    障碍物: <span className="font-mono text-white">{record.obstacles.length}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/train/${record.id}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors"
                  >
                    开始训练
                  </Link>
                  <Link
                    to={`/report/${record.id}`}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm font-medium transition-colors"
                  >
                    查看报告
                  </Link>
                  {record.status === 'pending' && (
                    <Link
                      to={`/conflict/${record.id}`}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm font-medium transition-colors"
                    >
                      处理冲突
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;
