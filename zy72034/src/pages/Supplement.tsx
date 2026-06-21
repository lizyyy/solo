import React, { useState } from 'react';
import { FileText, Save, Plus, History } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { calculateFarmStateDifference, formatFieldName } from '../utils/diff';
import { DiffTable } from '../components/DiffTable';
import { AlertBox } from '../components/AlertBox';
import { ToastContainer } from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import type { FarmState } from '../types';
import { getRoundFarmStates } from '../utils/snapshot';
import { cn } from '../lib/utils';

export const Supplement: React.FC = () => {
  const {
    farms,
    rounds,
    farmStates,
    supplementRecords,
    game,
    supplementData,
    isReplaying,
  } = useGameStore();

  const { toasts, showToast, removeToast } = useToast();

  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');

  React.useEffect(() => {
    if (game?.currentRound) {
      setSelectedRound(game.currentRound);
    }
  }, [game?.currentRound]);

  React.useEffect(() => {
    if (farms.length > 0 && !selectedFarmId) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);
  const [fieldName, setFieldName] = useState<string>('revenue');
  const [oldValue, setOldValue] = useState<string>('');
  const [newValue, setNewValue] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  if (!game || farms.length === 0 || rounds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-gray-500 mb-4">请先在主控台加载数据或开始游戏</p>
        </div>
      </div>
    );
  }

  const currentRoundStates = getRoundFarmStates(farmStates, selectedRound);
  const selectedFarmState = currentRoundStates.find(
    (fs) => fs.farmId === selectedFarmId
  );

  const handleOldValueAutoFill = () => {
    if (selectedFarmState && fieldName in selectedFarmState) {
      const value = String(
        (selectedFarmState as unknown as Record<string, unknown>)[fieldName]
      );
      setOldValue(value);
    }
  };

  const getOldState = (): FarmState | null => {
    if (!selectedFarmState) return null;
    return {
      ...selectedFarmState,
      [fieldName]: isNaN(Number(oldValue)) ? oldValue : Number(oldValue),
    };
  };

  const getNewState = (): FarmState | null => {
    if (!selectedFarmState) return null;
    return {
      ...selectedFarmState,
      [fieldName]: isNaN(Number(newValue)) ? newValue : Number(newValue),
    };
  };

  const diffReport =
    selectedFarmState && showPreview
      ? calculateFarmStateDifference(getOldState()!, getNewState()!)
      : { hasChanges: false, diffs: [] };

  const canSubmit =
    selectedRound > 0 &&
    selectedFarmId &&
    fieldName &&
    oldValue &&
    newValue &&
    remark;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const difference = diffReport.diffs
      .map(
        (d) =>
          `${formatFieldName(d.field)}: ${d.oldValue} → ${d.newValue}${
            d.delta !== undefined
              ? ` (${d.delta > 0 ? '+' : ''}${d.delta})`
              : ''
          }`
      )
      .join('; ');

    supplementData(
      selectedRound,
      selectedFarmId,
      fieldName,
      oldValue,
      newValue,
      difference,
      remark
    );

    showToast('success', '补录数据已保存');
    setShowPreview(false);
    setOldValue('');
    setNewValue('');
    setRemark('');
  };

  const fieldOptions = [
    { value: 'carbonQuota', label: '碳配额' },
    { value: 'revenue', label: '收益' },
    { value: 'landArea', label: '土地面积' },
    { value: 'cropType', label: '作物类型' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {isReplaying && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <AlertBox type="info" message="回放模式：无法进行补录操作" />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 pt-6">
        <h1
          className="text-2xl font-bold text-gray-800 mb-2"
          style={{ fontFamily: 'ZCOOL XiaoWei, serif' }}
        >
          📝 数据补录系统
        </h1>
        <p className="text-gray-600 mb-6">
          从课堂计分表补录旧口径数据，系统将自动计算差异并高亮显示
        </p>

        {supplementRecords.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-500" />
              历史补录记录
            </h3>
            <div className="space-y-2">
              {supplementRecords.map((record) => {
                const farm = farms.find((f) => f.id === record.farmId);
                return (
                  <div
                    key={record.id}
                    className="bg-white border-2 border-purple-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                          第{record.roundNumber}回合
                        </span>
                        <span className="font-medium text-gray-800">
                          {farm?.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(record.confirmedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">{formatFieldName(record.fieldName)}:</span>{' '}
                      <span className="line-through text-gray-500">
                        {record.oldValue}
                      </span>{' '}
                      → <span className="font-bold text-green-600">{record.newValue}</span>
                    </p>
                    <p className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                      差异: {record.difference}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      备注: {record.remark} | 操作人: {record.confirmedBy}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            新增补录记录
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                选择回合
              </label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(Number(e.target.value))}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                disabled={isReplaying}
              >
                {rounds.map((r) => (
                  <option key={r.roundNumber} value={r.roundNumber}>
                    第 {r.roundNumber} 回合
                    {r.isSupplemented && ' (已补录)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                选择农场
              </label>
              <select
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                disabled={isReplaying}
              >
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name} ({farm.owner})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                补录字段
              </label>
              <select
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                disabled={isReplaying}
              >
                {fieldOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                当前值（参考）
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedFarmState ? String((selectedFarmState as unknown as Record<string, unknown>)[fieldName]) : '-'}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-100 border-2 border-gray-200 rounded-lg text-gray-600"
                />
                <button
                  type="button"
                  onClick={handleOldValueAutoFill}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                  disabled={isReplaying}
                >
                  填充
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                原值（旧口径）
              </label>
              <input
                type="text"
                value={oldValue}
                onChange={(e) => setOldValue(e.target.value)}
                placeholder="例如：200"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500 bg-red-50"
                disabled={isReplaying}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新值（新口径）
              </label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="例如：225"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500 bg-green-50"
                disabled={isReplaying}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              补录备注 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="请说明补录原因，例如：从课堂计分表补录，原记录按40元/吨计算"
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
              rows={3}
              disabled={isReplaying}
            />
          </div>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                showPreview
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
              disabled={isReplaying}
            >
              <Plus className="w-4 h-4" />
              {showPreview ? '隐藏差异预览' : '预览差异'}
            </button>
          </div>

          {showPreview && (
            <div className="mb-4">
              {diffReport.hasChanges ? (
                <DiffTable
                  diffs={diffReport.diffs}
                  title="数据差异预览"
                />
              ) : (
                <AlertBox type="info" message="未发现数据差异，请检查输入值" />
              )}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isReplaying}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-white transition-all',
              canSubmit && !isReplaying
                ? 'bg-green-500 hover:bg-green-600 active:bg-green-700'
                : 'bg-gray-300 cursor-not-allowed'
            )}
          >
            <Save className="w-5 h-5" />
            确认补录
          </button>
        </div>

        <div className="mt-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <h4 className="font-bold text-yellow-800 mb-2">📌 补录说明</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 补录操作将永久保存，原数据不会被删除</li>
            <li>• 差异将被高亮显示，并记录在历史记录中</li>
            <li>• 建议在备注中详细说明补录原因和数据来源</li>
            <li>• 旧口径数据来自课堂计分表，新口径为当前系统标准</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
