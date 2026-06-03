import { CheckCircle2, AlertTriangle, RefreshCw, ArrowRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

const scenarioConfig = {
  smooth: {
    label: '顺利记录',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50 border-emerald-200',
    desc: '数据完整无误，顺利通过',
  },
  missing_row: {
    label: '缺行记录',
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 border-amber-200',
    desc: '照片有点位但坐标表缺一行，待安全员复核',
  },
  old_calibration: {
    label: '补录记录',
    icon: RefreshCw,
    color: 'text-sky-500',
    bgColor: 'bg-sky-50 border-sky-200',
    desc: '从坐标原点说明补录旧口径数据',
  },
};

export default function Home() {
  const navigate = useNavigate();
  const { pointRecords, selectRecord, setStep } = useAppStore();

  const handleSelectRecord = (recordId: string) => {
    selectRecord(recordId);
    setStep(1);
    navigate('/safety-radius');
  };

  const stats = {
    normal: pointRecords.filter(r => r.status === 'normal').length,
    pending: pointRecords.filter(r => r.status === 'pending_review').length,
    supplemented: pointRecords.filter(r => r.status === 'supplemented').length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">工作台</h2>
        <p className="text-slate-500 mt-1">演示安全半径表导入 → 坐标原点说明补看 → 遮挡点清单更新完整流程</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-700 mb-6">处理流程</h3>
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: '导入安全半径表', desc: '导入数据并检测完整性' },
            { step: 2, label: '补看坐标原点说明', desc: '查看原点定义，补录旧口径' },
            { step: 3, label: '更新遮挡点清单', desc: '计算并更新遮挡点结果' },
          ].map((item, index) => (
            <div key={item.step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-sky-50 border-2 border-sky-200 flex items-center justify-center">
                  <span className="text-lg font-bold text-sky-600">{item.step}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">{item.label}</p>
                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
              </div>
              {index < 2 && <ArrowRight className="mx-8 text-slate-300" size={20} />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" size={20} />
            <span className="text-sm font-medium text-emerald-700">顺利通过</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-3">{stats.normal}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            <span className="text-sm font-medium text-amber-700">待安全员复核</span>
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-3">{stats.pending}</p>
          <p className="text-xs text-amber-500 mt-1">照片有点位但坐标表缺一行，不归正常</p>
        </div>
        <div className="bg-sky-50 rounded-xl p-5 border border-sky-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="text-sky-500" size={20} />
            <span className="text-sm font-medium text-sky-700">已补录</span>
          </div>
          <p className="text-3xl font-bold text-sky-600 mt-3">{stats.supplemented}</p>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-700 mb-4">演示数据</h3>
        <p className="text-sm text-slate-500 mb-6">选择一条记录开始演示完整流程，三种场景处理结果各不相同</p>
        <div className="grid grid-cols-3 gap-6">
          {pointRecords.map((record) => {
            const config = scenarioConfig[record.scenarioType];
            const Icon = config.icon;
            return (
              <div
                key={record.id}
                className={cn(
                  'rounded-xl p-6 border cursor-pointer transition-all hover:shadow-md',
                  config.bgColor
                )}
                onClick={() => handleSelectRecord(record.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={config.color} size={24} />
                    <div>
                      <h4 className="font-semibold text-slate-800">{config.label}</h4>
                      <p className="text-sm text-slate-500">点位 {record.pointCode}</p>
                    </div>
                  </div>
                  <button
                    className="p-2 rounded-lg bg-white shadow-sm hover:shadow transition-shadow"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectRecord(record.id);
                    }}
                  >
                    <Play size={16} className="text-slate-600" />
                  </button>
                </div>
                <p className="mt-4 text-sm text-slate-600">{config.desc}</p>
                <div className="mt-4 pt-4 border-t border-slate-200/50 flex items-center justify-between text-sm">
                  <span className="text-slate-500">照片 {record.photoPointCount} 点位</span>
                  <span className="text-slate-500">坐标表 {record.coordinateRowCount} 行</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 text-white">
        <h3 className="text-base font-semibold mb-4">操作提示</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li>• <span className="text-amber-400">重点</span>：照片有点位但坐标表缺一行时，别急着归正常，留给安全员复核</li>
          <li>• 从坐标原点说明可以补录旧口径数据，补录后遮挡点清单会更新</li>
          <li>• 三条记录跑完后去历史记录可以对比三种处理结果的不同</li>
        </ul>
      </div>
    </div>
  );
}
