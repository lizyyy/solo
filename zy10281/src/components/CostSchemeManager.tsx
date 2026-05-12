import React, { useState } from 'react';
import type { CostScheme, BuildingVersion } from '../types';

interface CostSchemeManagerProps {
  schemes: CostScheme[];
  currentVersion: BuildingVersion;
  buildingId: string;
  onSave: (scheme: Omit<CostScheme, 'id' | 'createdAt'>) => void;
}

const allocationMethods = {
  area: '按面积分摊',
  floor: '按楼层系数分摊',
  equal: '平均分摊',
};

export const CostSchemeManager: React.FC<CostSchemeManagerProps> = ({
  schemes,
  currentVersion,
  buildingId,
  onSave,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [totalCost, setTotalCost] = useState(450000);
  const [allocationMethod, setAllocationMethod] = useState<'area' | 'floor' | 'equal'>('floor');
  const [paymentSchedule, setPaymentSchedule] = useState('');

  const currentScheme = schemes.find(s => s.versionId === currentVersion.id);

  const handleSave = () => {
    if (name.trim()) {
      onSave({
        buildingId,
        versionId: currentVersion.id,
        name,
        description,
        totalCost,
        allocationMethod,
        floorCoefficients: { 1: 0.5, 2: 0.7, 3: 0.9, 4: 1.1, 5: 1.3, 6: 1.5 },
        paymentSchedule,
        createdBy: '当前用户',
      });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setTotalCost(450000);
      setAllocationMethod('floor');
      setPaymentSchedule('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">费用方案</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
        >
          编辑方案
        </button>
      </div>

      {currentScheme ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800 text-lg">{currentScheme.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{currentScheme.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">总费用</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">
                ¥{currentScheme.totalCost.toLocaleString()}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">分摊方式</div>
              <div className="text-lg font-semibold text-gray-800 mt-1">
                {allocationMethods[currentScheme.allocationMethod]}
              </div>
            </div>
          </div>

          {currentScheme.allocationMethod === 'floor' && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-2">楼层系数</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(currentScheme.floorCoefficients).map(([floor, coeff]) => (
                  <span key={floor} className="px-2 py-1 bg-white rounded text-sm">
                    {floor}层: {coeff}
                  </span>
                ))}
              </div>
            </div>
          )}

          {currentScheme.paymentSchedule && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">付款计划</div>
              <div className="text-sm text-gray-700 mt-1">{currentScheme.paymentSchedule}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          当前版本暂无费用方案
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">编辑费用方案</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">方案名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="费用方案名称"
                  defaultValue={currentScheme?.name}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">方案描述</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="简要描述"
                  defaultValue={currentScheme?.description}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">总费用 (元)</label>
                <input
                  type="number"
                  value={totalCost}
                  onChange={(e) => setTotalCost(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  defaultValue={currentScheme?.totalCost}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">分摊方式</label>
                <select
                  value={allocationMethod}
                  onChange={(e) => setAllocationMethod(e.target.value as 'area' | 'floor' | 'equal')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  defaultValue={currentScheme?.allocationMethod}
                >
                  {Object.entries(allocationMethods).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">付款计划</label>
                <textarea
                  value={paymentSchedule}
                  onChange={(e) => setPaymentSchedule(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  rows={2}
                  placeholder="例如: 首付30%，安装完成付50%，验收后付20%"
                  defaultValue={currentScheme?.paymentSchedule}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
