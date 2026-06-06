import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  X,
  CheckCircle,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { formatDate } from '@/utils/helpers';
import type { Equipment } from '@/types';
import { useState } from 'react';

const statusConfig = {
  active: { label: '运行中', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  maintenance: { label: '维护中', color: 'bg-amber-100 text-amber-700', icon: Wrench },
  inactive: { label: '停用', color: 'bg-gray-100 text-gray-600', icon: X },
};

export function Equipment() {
  const navigate = useNavigate();
  const equipment = useEquipmentStore(state => state.equipment);
  const deleteEquipment = useEquipmentStore(state => state.deleteEquipment);
  const resetToMock = useEquipmentStore(state => state.resetToMock);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">设备铭牌参数</h1>
          <p className="text-gray-500 mt-1">管理温度采集设备信息，支持参数溯源和关联阈值表</p>
        </div>
        <button
          onClick={resetToMock}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重置数据
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<Cpu className="w-5 h-5 text-primary-500" />}
          label="设备总数"
          value={equipment.length}
          bgColor="bg-blue-50"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-industry-success" />}
          label="运行中"
          value={equipment.filter(e => e.status === 'active').length}
          bgColor="bg-green-50"
        />
        <StatCard
          icon={<Wrench className="w-5 h-5 text-amber-600" />}
          label="维护中"
          value={equipment.filter(e => e.status === 'maintenance').length}
          bgColor="bg-amber-50"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                设备编号
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                设备名称
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                型号
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                精度
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                制造商
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                安装日期
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {equipment.map((eq) => {
              const status = statusConfig[eq.status];
              const StatusIcon = status.icon;
              return (
                <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {eq.equipmentCode}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700">{eq.equipmentName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-gray-600">{eq.model}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-mono text-primary-600">
                      ±{eq.accuracy}°C
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{eq.manufacturer}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">{eq.installDate}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedEquipment(eq)}
                        className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-gray-400 hover:text-industry-warning hover:bg-amber-50 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteEquipment(eq.id)}
                        className="p-2 text-gray-400 hover:text-industry-danger hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">设备铭牌详情</h2>
              <button
                onClick={() => setSelectedEquipment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{selectedEquipment.equipmentName}</h3>
                  <p className="text-sm text-gray-500 font-mono">{selectedEquipment.equipmentCode}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="设备型号" value={selectedEquipment.model} />
                <DetailItem label="测量精度" value={`±${selectedEquipment.accuracy}°C`} />
                <DetailItem label="制造商" value={selectedEquipment.manufacturer} />
                <DetailItem label="安装日期" value={selectedEquipment.installDate} />
              </div>

              <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">溯源信息</p>
                    <p className="text-xs text-amber-600 mt-1">
                      该设备关联了 3 条温度记录，点击下方按钮查看关联的阈值表和测温记录
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setSelectedEquipment(null);
                          navigate('/tracking');
                        }}
                        className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                      >
                        查看温度记录
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEquipment(null);
                          navigate('/thresholds');
                        }}
                        className="text-xs px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        关联阈值表
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setSelectedEquipment(null)}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-5`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
