import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { FileText, Download, Users, ArrowRightLeft, AlertTriangle, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateCSVReport, generateJSONReport, downloadFile } from '@/utils/report';
import { calculateSeatDistance } from '@/algorithm/seatSwap';
import { cn } from '@/lib/utils';

export default function ReportPage() {
  const navigate = useNavigate();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const {
    passengers,
    paidSeats,
    companionGroups,
    weightConfig,
    swapSchemes,
    selectedSchemeId,
  } = useAppStore();

  const selectedScheme = swapSchemes.find((s) => s.schemeId === selectedSchemeId);

  const toggleRow = (passengerId: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(passengerId)) {
      newSet.delete(passengerId);
    } else {
      newSet.add(passengerId);
    }
    setExpandedRows(newSet);
  };

  const handleExportCSV = () => {
    if (!selectedScheme) return;
    const csv = generateCSVReport(selectedScheme, passengers, paidSeats, companionGroups);
    downloadFile(csv, `seat-swap-report-${selectedScheme.schemeId}.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    if (!selectedScheme) return;
    const json = generateJSONReport(selectedScheme, passengers, paidSeats, companionGroups, weightConfig);
    downloadFile(json, `seat-swap-report-${selectedScheme.schemeId}.json`, 'application/json');
  };

  const stats = selectedScheme
    ? {
        totalPassengers: passengers.length,
        totalSwaps: selectedScheme.actions.length,
        totalConflicts: selectedScheme.conflicts.length,
        paidDisplaced: selectedScheme.conflicts.filter((c) => c.conflictType === 'paid_displaced').length,
        companionSplit: selectedScheme.conflicts.filter((c) => c.conflictType === 'companion_split').length,
        overbooked: selectedScheme.conflicts.filter((c) => c.conflictType === 'overbooked_duplicate').length,
        avgDistance:
          selectedScheme.actions.length > 0
            ? Math.round(
                selectedScheme.actions.reduce((sum, a) => sum + calculateSeatDistance(a.fromSeat, a.toSeat), 0) /
                  selectedScheme.actions.length
              )
            : 0,
      }
    : null;

  const actionMap = new Map(selectedScheme?.actions.map((a) => [a.passengerId, a]) || []);

  const conflictsByPassenger: Record<string, typeof selectedScheme.conflicts> = {};
  if (selectedScheme) {
    selectedScheme.conflicts.forEach((c) => {
      if (!conflictsByPassenger[c.affectedPassengerId]) {
        conflictsByPassenger[c.affectedPassengerId] = [];
      }
      conflictsByPassenger[c.affectedPassengerId].push(c);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-primary-800">调座报告</h1>
          <p className="text-primary-600 mt-1">完整的调座方案统计与详细记录</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            disabled={!selectedScheme}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
          <button
            onClick={handleExportJSON}
            disabled={!selectedScheme}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            导出 JSON
          </button>
        </div>
      </div>

      {!selectedScheme ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">尚未选择调座方案</h3>
          <p className="text-gray-500 mb-4">请先前往调座计算页面生成并选择一个方案</p>
          <button
            onClick={() => navigate('/compute')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            前往计算
          </button>
        </div>
      ) : (
          <></>
      )}

      {stats && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-primary-700">统计概览</h3>
            <div className="flex items-center gap-2">
              {selectedScheme?.isRecommended && (
                <span className="flex items-center gap-1 px-3 py-1 bg-accent-100 text-accent-700 rounded-full text-sm">
                  <Star className="w-4 h-4" />
                  推荐方案
                </span>
              )}
              <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                方案 {selectedScheme.schemeId.split('-')[1]}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-primary-50 rounded-xl p-5 border border-primary-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary-700">{stats.totalPassengers}</div>
                  <div className="text-sm text-primary-600">总乘客数</div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700">{stats.totalSwaps}</div>
                  <div className="text-sm text-blue-600">调座人数</div>
                </div>
              </div>
            </div>

            <div className="bg-warning-50 rounded-xl p-5 border border-warning-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning-700">{stats.totalConflicts}</div>
                  <div className="text-sm text-warning-600">冲突总数</div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-5 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">{stats.avgDistance}</div>
                  <div className="text-sm text-green-600">平均移动距离</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-amber-700">付费座位变更</span>
              <span className="text-2xl font-bold text-amber-700">{stats.paidDisplaced}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
              <span className="text-orange-700">同行拆分</span>
              <span className="text-2xl font-bold text-orange-700">{stats.companionSplit}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <span className="text-red-700">超售重复</span>
              <span className="text-2xl font-bold text-red-700">{stats.overbooked}</span>
            </div>
          </div>
        </div>
      )}

      {selectedScheme && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-primary-700">调座详情</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600"></th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">乘客ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">姓名</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">原座位</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">新座位</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">舱位</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">冲突</th>
                </tr>
              </thead>
              <tbody>
                {passengers.map((p) => {
                  const action = actionMap.get(p.id);
                  const newSeat = action ? action.toSeat : p.currentSeat;
                  const conflicts = conflictsByPassenger[p.id] || [];
                  const isPaid = paidSeats.some((ps) => ps.passengerId === p.id);
                  const companion = companionGroups.find((g) => g.passengerIds.includes(p.id));
                  const hasConflict = conflicts.length > 0;
                  const isExpanded = expandedRows.has(p.id);
                  const distance = action ? calculateSeatDistance(action.fromSeat, action.toSeat) : 0;

                  return (
                    <>
                      <tr
                        key={p.id}
                        className={cn(
                          'border-b border-gray-100 cursor-pointer hover:bg-gray-50',
                          isExpanded && 'bg-primary-50'
                        )}
                        onClick={() => toggleRow(p.id)}
                      >
                        <td className="py-3 px-4">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-primary-600">{p.id}</td>
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded font-mono">
                            {p.currentSeat}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'px-2 py-1 rounded font-mono',
                              action ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700'
                            )}
                          >
                            {newSeat}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{p.cabinClass}</td>
                        <td className="py-3 px-4">
                          {hasConflict ? (
                            <span className="px-2 py-1 bg-warning-100 text-warning-700 rounded text-xs">
                              {conflicts.length} 个
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              无
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-primary-50">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-gray-600 mb-2">基本信息</div>
                                <div className="space-y-1 text-sm text-gray-700">
                                  <div className="flex gap-2">
                                    <span className="text-gray-500">付费座位：</span>
                                    <span>{isPaid ? '是' : '否'}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-gray-500">同行组：</span>
                                    <span>{companion?.groupId || '-'}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-gray-500">移动距离：</span>
                                    <span>{distance} 排</span>
                                  </div>
                                </div>
                              </div>
                              {hasConflict && (
                                <div>
                                  <div className="text-sm font-medium text-gray-600 mb-2">冲突详情</div>
                                  <div className="space-y-2">
                                    {conflicts.map((c, idx) => (
                                      <div key={idx} className="p-2 bg-warning-50 rounded text-sm">
                                        <div className="font-medium text-warning-700">
                                          {c.conflictType === 'paid_displaced'
                                            ? '付费座位变更'
                                            : c.conflictType === 'companion_split'
                                            ? '同行拆分'
                                            : '超售重复'}
                                        </div>
                                        <div className="text-warning-600">{c.description}</div>
                                        <div className="text-xs text-warning-500 mt-1">{c.reason}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
