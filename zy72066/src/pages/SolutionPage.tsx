import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  GitCompare,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Solution } from '../types';

const statusConfig: Record<Solution['status'], { label: string; color: string; bgColor: string }> = {
  draft: { label: '草稿', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  reviewing: { label: '评审中', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  approved: { label: '已通过', color: 'text-green-600', bgColor: 'bg-green-100' },
  rework: { label: '需返工', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export default function SolutionPage() {
  const navigate = useNavigate();
  const solutions = useAppStore((state) => state.solutions);
  const currentSolution = useAppStore((state) => state.currentSolution);
  const setCurrentSolution = useAppStore((state) => state.setCurrentSolution);
  const updateSolution = useAppStore((state) => state.updateSolution);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const handleLoadSolution = (solution: Solution) => {
    setCurrentSolution(solution);
    navigate('/parameter');
  };

  const handleToggleCompare = (id: string) => {
    if (selectedForCompare.includes(id)) {
      setSelectedForCompare(selectedForCompare.filter((s) => s !== id));
    } else if (selectedForCompare.length < 2) {
      setSelectedForCompare([...selectedForCompare, id]);
    }
  };

  const handleStatusChange = (id: string, status: Solution['status']) => {
    updateSolution(id, { status });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">方案管理</h1>
          <p className="text-gray-500 mt-1">管理所有能耗校验方案，支持版本对比</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              compareMode
                ? 'bg-primary-100 border-primary-500 text-primary-700'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            {compareMode ? `对比中 (${selectedForCompare.length}/2)` : '版本对比'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            新建方案
          </button>
        </div>
      </div>

      {compareMode && selectedForCompare.length === 2 && (
        <CompareView
          solution1={solutions.find((s) => s.id === selectedForCompare[0])!}
          solution2={solutions.find((s) => s.id === selectedForCompare[1])!}
          onClose={() => {
            setCompareMode(false);
            setSelectedForCompare([]);
          }}
        />
      )}

      <div className="space-y-4">
        {solutions.length > 0 ? (
          solutions.map((solution) => {
            const unresolvedAnomalies = solution.anomalies.filter((a) => !a.resolved).length;
            const isSelected = currentSolution?.id === solution.id;
            const isInCompare = selectedForCompare.includes(solution.id);

            return (
              <div
                key={solution.id}
                className={`bg-white rounded-2xl shadow-sm border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500'
                    : isInCompare
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {compareMode && (
                        <input
                          type="checkbox"
                          checked={isInCompare}
                          onChange={() => handleToggleCompare(solution.id)}
                          className="mt-1 w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                        />
                      )}
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                        <FolderKanban className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-800">{solution.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[solution.status].bgColor} ${statusConfig[solution.status].color}`}>
                            {statusConfig[solution.status].label}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                              当前方案
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {solution.operator}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(solution.updatedAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!compareMode && (
                        <>
                          <select
                            value={solution.status}
                            onChange={(e) => handleStatusChange(solution.id, e.target.value as Solution['status'])}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="draft">草稿</option>
                            <option value="reviewing">评审中</option>
                            <option value="approved">已通过</option>
                            <option value="rework">需返工</option>
                          </select>
                          <button
                            onClick={() => handleLoadSolution(solution)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                          >
                            <Eye className="w-4 h-4" />
                            查看
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">{solution.devices.length}</p>
                      <p className="text-sm text-gray-500">设备数量</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">
                        {solution.devices.reduce((sum, d) => sum + d.energyConsumption, 0)}kWh
                      </p>
                      <p className="text-sm text-gray-500">总能耗</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">{solution.anomalies.length}</p>
                      <p className="text-sm text-gray-500">异常总数</p>
                    </div>
                    <div className={`rounded-xl p-4 text-center ${
                      unresolvedAnomalies > 0 ? 'bg-red-50' : 'bg-green-50'
                    }`}>
                      <p className={`text-2xl font-bold ${
                        unresolvedAnomalies > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {unresolvedAnomalies}
                      </p>
                      <p className={`text-sm ${
                        unresolvedAnomalies > 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        待处理异常
                      </p>
                    </div>
                  </div>

                  {solution.remarks.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                      <p className="text-sm text-blue-800">
                        <strong>备注:</strong> {solution.remarks[solution.remarks.length - 1]}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">暂无方案</h3>
            <p className="text-gray-400 mb-6">创建新的能耗校验方案开始使用</p>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              创建第一个方案
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareView({ solution1, solution2, onClose }: { solution1: Solution; solution2: Solution; onClose: () => void }) {
  const diffDevices = Math.abs(solution1.devices.length - solution2.devices.length);
  const diffAnomalies = Math.abs(solution1.anomalies.length - solution2.anomalies.length);
  const diffEnergy = Math.abs(
    solution1.devices.reduce((sum, d) => sum + d.energyConsumption, 0) -
    solution2.devices.reduce((sum, d) => sum + d.energyConsumption, 0)
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-400 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-blue-600" />
          版本对比
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Trash2 className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-800 mb-2">{solution1.name}</h4>
          <p className="text-xs text-gray-500">{new Date(solution1.updatedAt).toLocaleString('zh-CN')}</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-xl text-center">
          <p className="text-sm text-blue-600 font-medium">差异</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-800 mb-2">{solution2.name}</h4>
          <p className="text-xs text-gray-500">{new Date(solution2.updatedAt).toLocaleString('zh-CN')}</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-800">{solution1.devices.length}</p>
          <p className="text-sm text-gray-500">设备数量</p>
        </div>
        <div className={`p-4 rounded-xl text-center ${diffDevices > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
          <p className={`text-2xl font-bold ${diffDevices > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {diffDevices > 0 ? `+${diffDevices}` : '无差异'}
          </p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-800">{solution2.devices.length}</p>
          <p className="text-sm text-gray-500">设备数量</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-800">{solution1.anomalies.length}</p>
          <p className="text-sm text-gray-500">异常数量</p>
        </div>
        <div className={`p-4 rounded-xl text-center ${diffAnomalies > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className={`text-2xl font-bold ${diffAnomalies > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {diffAnomalies > 0 ? `+${diffAnomalies}` : '无差异'}
          </p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-800">{solution2.anomalies.length}</p>
          <p className="text-sm text-gray-500">异常数量</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-800">
            {solution1.devices.reduce((sum, d) => sum + d.energyConsumption, 0)}kWh
          </p>
          <p className="text-sm text-gray-500">总能耗</p>
        </div>
        <div className={`p-4 rounded-xl text-center ${diffEnergy > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
          <p className={`text-2xl font-bold ${diffEnergy > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {diffEnergy > 0 ? `+${diffEnergy}kWh` : '无差异'}
          </p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-800">
            {solution2.devices.reduce((sum, d) => sum + d.energyConsumption, 0)}kWh
          </p>
          <p className="text-sm text-gray-500">总能耗</p>
        </div>
      </div>
    </div>
  );
}
