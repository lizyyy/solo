import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  History,
  ArrowRight,
  Clock,
  User,
  Edit3,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import { useThresholdStore } from '@/store/useThresholdStore';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatDateShort } from '@/utils/helpers';
import type { RecordHistory, TemperatureRecord } from '@/types';

const fieldLabels: Record<string, string> = {
  remark: '备注',
  manualCoefficient: '人工系数',
  reviewReason: '复核原因',
  temperature: '温度值',
  tradeOffReason: '取舍理由',
  parameterVersion: '参数版本',
  status: '状态',
};

export function Playback() {
  const location = useLocation();
  const navigate = useNavigate();
  const records = useRecordStore(state => state.records);
  const getHistoryByRecordId = useRecordStore(state => state.getHistoryByRecordId);
  const getRecordById = useRecordStore(state => state.getRecordById);
  const getThresholdById = useThresholdStore(state => state.getThresholdById);
  const getEquipmentById = useEquipmentStore(state => state.getEquipmentById);

  const initialRecordId = (location.state as { recordId?: string })?.recordId || null;
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(initialRecordId);
  const [selectedHistory, setSelectedHistory] = useState<RecordHistory | null>(null);

  const selectedRecord = selectedRecordId ? getRecordById(selectedRecordId) : null;
  const recordHistory = selectedRecordId ? getHistoryByRecordId(selectedRecordId) : [];
  const selectedThreshold = selectedRecord ? getThresholdById(selectedRecord.thresholdId) : null;
  const selectedEquipment = selectedRecord ? getEquipmentById(selectedRecord.equipmentId) : null;

  useEffect(() => {
    if (recordHistory.length > 0 && !selectedHistory) {
      setSelectedHistory(recordHistory[0]);
    }
  }, [recordHistory, selectedHistory]);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">参数回放</h1>
        <p className="text-gray-500 mt-1">查看历史变更记录，对比改前改后差别，追踪决策轨迹</p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-80 flex flex-col gap-4 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-4 flex-1 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-primary-500" />
              温度记录列表
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {records.map((record) => (
                <button
                  key={record.id}
                  onClick={() => {
                    setSelectedRecordId(record.id);
                    setSelectedHistory(null);
                  }}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedRecordId === record.id
                      ? 'bg-primary-50 border-2 border-primary-200'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono text-gray-800">
                      {record.temperature}°C
                    </span>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{record.remark || '无备注'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateShort(record.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {selectedRecord ? (
            <>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      记录详情
                      <span className="ml-2 text-sm font-normal text-gray-500 font-mono">
                        {selectedRecord.id}
                      </span>
                    </h3>
                    <div className="flex items-center gap-4 mt-2">
                      <StatusBadge status={selectedRecord.status} />
                      <span className="text-sm text-gray-500">
                        创建于 {formatDate(selectedRecord.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate('/tracking')}
                      className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      返回看板 <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-6">
                  <InfoCard label="实测温度" value={`${selectedRecord.temperature}°C`} />
                  <InfoCard
                    label="人工系数"
                    value={selectedRecord.manualCoefficient ? `×${selectedRecord.manualCoefficient}` : '-'}
                    highlight={!!selectedRecord.manualCoefficient}
                  />
                  <InfoCard
                    label="参数版本"
                    value={selectedRecord.parameterVersion || '-'}
                  />
                  <InfoCard
                    label="变更次数"
                    value={recordHistory.length.toString()}
                  />
                </div>

                {selectedRecord.remark && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-1">备注</p>
                    <p className="text-sm text-blue-800">{selectedRecord.remark}</p>
                  </div>
                )}

                {selectedRecord.tradeOffReason && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 font-medium mb-1">取舍理由</p>
                    <p className="text-sm text-purple-800">{selectedRecord.tradeOffReason}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs text-amber-600 font-medium mb-1">关联阈值表</p>
                    <p className="text-sm font-mono text-amber-800">
                      {selectedThreshold?.thresholdCode || '未关联'}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      {selectedThreshold?.description}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 font-medium mb-1">关联设备</p>
                    <p className="text-sm text-green-800">
                      {selectedEquipment?.equipmentName || '未关联'}
                    </p>
                    <p className="text-xs text-green-600 mt-1 font-mono">
                      {selectedEquipment?.equipmentCode}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-white rounded-xl shadow-sm p-5 overflow-hidden flex flex-col">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary-500" />
                  历史变更时间线
                </h3>

                {recordHistory.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>暂无变更记录</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex gap-6 min-h-0">
                    <div className="w-64 flex-shrink-0 overflow-y-auto">
                      <div className="relative">
                        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
                        {recordHistory.map((history, idx) => (
                          <button
                            key={history.id}
                            onClick={() => setSelectedHistory(history)}
                            className={`relative w-full text-left mb-4 pl-8 ${
                              selectedHistory?.id === history.id ? '' : ''
                            }`}
                          >
                            <div
                              className={`absolute left-1.5 top-1.5 w-4 h-4 rounded-full border-2 ${
                                selectedHistory?.id === history.id
                                  ? 'border-primary-500 bg-primary-500'
                                  : 'border-gray-300 bg-white'
                              }`}
                            />
                            <div
                              className={`p-3 rounded-lg transition-all ${
                                selectedHistory?.id === history.id
                                  ? 'bg-primary-50 border border-primary-200'
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                <User className="w-3 h-3" />
                                {history.userName}
                              </div>
                              <p className="text-sm font-medium text-gray-800">
                                修改了 {fieldLabels[history.fieldName] || history.fieldName}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDateShort(history.createdAt)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      {selectedHistory && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <Edit3 className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">
                                {selectedHistory.userName}
                              </p>
                              <p className="text-sm text-gray-500">
                                修改了 {fieldLabels[selectedHistory.fieldName] || selectedHistory.fieldName}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatDate(selectedHistory.createdAt)}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-xs font-bold text-gray-500">旧</span>
                                </div>
                                <span className="text-sm font-medium text-gray-600">修改前</span>
                              </div>
                              <div className="p-3 bg-white rounded-lg border">
                                <p className="text-sm text-gray-700 font-mono">
                                  {selectedHistory.oldValue || '(空)'}
                                </p>
                              </div>
                            </div>

                            <div className="p-4 rounded-xl border-2 border-primary-200 bg-primary-50">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                                  <span className="text-xs font-bold text-white">新</span>
                                </div>
                                <span className="text-sm font-medium text-primary-700">修改后</span>
                              </div>
                              <div className="p-3 bg-white rounded-lg border border-primary-200">
                                <p className="text-sm text-primary-700 font-mono">
                                  {selectedHistory.newValue || '(空)'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {selectedHistory.changeReason ? (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                              <div className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-green-800">已填写修改原因</p>
                                  <p className="text-sm text-green-700 mt-1">
                                    {selectedHistory.changeReason}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                              <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-amber-800">未填写修改原因</p>
                                  <p className="text-sm text-amber-700 mt-1">
                                    该变更未说明原因，需要设备工程师复核确认
                                  </p>
                                  <button
                                    onClick={() => navigate('/review')}
                                    className="mt-2 text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                                  >
                                    前往复核
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <div className="text-center text-gray-500">
                <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">请选择一条记录查看历史</p>
                <p className="text-sm mt-1">从左侧列表选择温度记录</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
      <p className={`text-xs mb-1 ${highlight ? 'text-amber-600' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-lg font-semibold font-mono ${highlight ? 'text-amber-700' : 'text-gray-800'}`}>
        {value}
      </p>
    </div>
  );
}
