import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw, FileWarning, Hash, FileSpreadsheet, Database, UserCheck } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { selfCheckApi } from '../api/selfCheckApi';
import type { SelfCheckResult } from '../../shared/types';
import dayjs from 'dayjs';

export const SelfCheckPage: React.FC = () => {
  const { setLoading, setError } = useAppStore();
  const [checkResult, setCheckResult] = useState<SelfCheckResult | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  useEffect(() => {
    runSelfCheck();
  }, []);

  const runSelfCheck = async () => {
    try {
      setLoading(true);
      const res = await selfCheckApi.runSelfCheck();
      setCheckResult(res.data);
      setLastCheckTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getOverallStatus = () => {
    if (!checkResult) return 'pending';
    const allPassed = 
      checkResult.duplicateImport.passed &&
      checkResult.numberGap.passed &&
      checkResult.supplementRecalc.passed &&
      checkResult.exportConsistency.passed;
    return allPassed ? 'passed' : 'failed';
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">自检中心</h2>
          <p className="mt-1 text-sm text-gray-500">
            四项核心自检：重复导入、编号断档、补录重算、导出一致性，确保数据不出错
          </p>
        </div>
        <button
          onClick={runSelfCheck}
          className="inline-flex items-center px-4 py-2 bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          重新自检
        </button>
      </div>

      {lastCheckTime && (
        <div className="text-sm text-gray-500 flex items-center">
          <span className="mr-1">最后自检时间：</span>
          <span className="font-mono">{lastCheckTime}</span>
        </div>
      )}

      <div className={`rounded-lg border-2 p-6 ${
        overallStatus === 'passed' 
          ? 'bg-green-50 border-green-300' 
          : overallStatus === 'failed'
          ? 'bg-red-50 border-red-300'
          : 'bg-gray-50 border-gray-300'
      }`}>
        <div className="flex items-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            overallStatus === 'passed' ? 'bg-green-200' : overallStatus === 'failed' ? 'bg-red-200' : 'bg-gray-200'
          }`}>
            {overallStatus === 'passed' ? (
              <CheckCircle className="w-6 h-6 text-green-700" />
            ) : overallStatus === 'failed' ? (
              <XCircle className="w-6 h-6 text-red-700" />
            ) : (
              <Shield className="w-6 h-6 text-gray-600" />
            )}
          </div>
          <div className="ml-4">
            <h3 className={`font-serif text-xl font-bold ${
              overallStatus === 'passed' ? 'text-green-800' : overallStatus === 'failed' ? 'text-red-800' : 'text-gray-800'
            }`}>
              {overallStatus === 'passed' ? '全部自检通过' : overallStatus === 'failed' ? '存在待处理问题' : '自检进行中'}
            </h3>
            <p className={`mt-1 text-sm ${
              overallStatus === 'passed' ? 'text-green-700' : overallStatus === 'failed' ? 'text-red-700' : 'text-gray-600'
            }`}>
              {overallStatus === 'passed' 
                ? '四项检查全部通过，数据状态良好，可以放心交付教研组'
                : overallStatus === 'failed'
                ? '请逐项查看下方检查结果，处理完成后重新自检'
                : '正在执行自检，请稍候...'}
            </p>
          </div>
        </div>
      </div>

      {checkResult && (
        <div className="grid grid-cols-1 gap-4">
          <CheckCard
            icon={<FileWarning className="w-5 h-5" />}
            title="重复导入检测"
            description="检查是否有相同文件被重复导入，避免数据冗余"
            passed={checkResult.duplicateImport.passed}
            details={
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">总导入批次：</span>
                    <span className="font-medium text-gray-900 ml-1">{checkResult.duplicateImport.details.totalBatches}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">重复导入：</span>
                    <span className={`font-medium ml-1 ${checkResult.duplicateImport.details.duplicateCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {checkResult.duplicateImport.details.duplicateCount} 次
                    </span>
                  </div>
                </div>
                {checkResult.duplicateImport.details.duplicates.length > 0 && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm font-medium text-red-800 mb-2">重复导入记录：</p>
                    <div className="space-y-1">
                      {checkResult.duplicateImport.details.duplicates.map((dup, idx) => (
                        <div key={idx} className="text-sm text-red-700 flex items-center space-x-3">
                          <span className="font-mono text-xs">{dup.batchId.slice(0, 8)}...</span>
                          <span>{dup.fileName}</span>
                          <span className="text-gray-500">操作人：{dup.operator}</span>
                          <span className="text-gray-500">{dayjs(dup.time).format('YYYY-MM-DD HH:mm')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            }
          />

          <CheckCard
            icon={<Hash className="w-5 h-5" />}
            title="编号断档检测"
            description="检查人工删除后是否出现编号断档，断档记录保留待教研组复核"
            passed={checkResult.numberGap.passed}
            details={
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">总断档：</span>
                    <span className={`font-medium ml-1 ${checkResult.numberGap.details.gapCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {checkResult.numberGap.details.gapCount} 处
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">待复核：</span>
                    <span className={`font-medium ml-1 ${(checkResult.numberGap.details as any).openGapCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {(checkResult.numberGap.details as any).openGapCount ?? checkResult.numberGap.details.gapCount} 处
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">已复核：</span>
                    <span className="font-medium ml-1 text-indigo-600">
                      {(checkResult.numberGap.details as any).reviewedGapCount ?? 0} 处
                    </span>
                  </div>
                </div>
                {checkResult.numberGap.details.gaps.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {(checkResult.numberGap.details as any).openGapCount > 0 && (
                      <div className="bg-warning-50 border border-warning-300 rounded p-3">
                        <p className="text-sm font-medium text-warning-800 mb-2 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-1.5" />
                          待教研组复核：{(checkResult.numberGap.details as any).openGapCount} 处
                        </p>
                        <div className="space-y-1">
                          {checkResult.numberGap.details.gaps
                            .filter((g: any) => g.status === 'open')
                            .map((gap: any, idx: number) => (
                            <div key={idx} className="text-sm text-warning-700 flex items-start space-x-2 bg-white/60 p-2 rounded">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-mono">
                                  编号 #{gap.beforeLineNo} → #{gap.afterLineNo}，
                                  缺失 <span className="font-bold">{gap.missingCount}</span> 条
                                </span>
                                {gap.gapId && (
                                  <span className="ml-2 text-xs text-gray-500">[ID: {gap.gapId.slice(0, 8)}]</span>
                                )}
                                <div className="text-xs text-warning-600 mt-0.5">
                                  请在"拣货路线明细"页的黄色断档列表中点击"教研组复核"按钮
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(checkResult.numberGap.details as any).reviewedGapCount > 0 && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                        <p className="text-sm font-medium text-indigo-800 mb-2 flex items-center">
                          <UserCheck className="w-4 h-4 mr-1.5" />
                          已完成复核：{(checkResult.numberGap.details as any).reviewedGapCount} 处（保留变更证据，不自动归正常）
                        </p>
                        <div className="space-y-1">
                          {checkResult.numberGap.details.gaps
                            .filter((g: any) => g.status === 'reviewed')
                            .map((gap: any, idx: number) => (
                            <div key={idx} className="text-sm text-indigo-700 flex items-start space-x-2 bg-white/60 p-2 rounded">
                              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-500" />
                              <div>
                                <span className="font-mono">
                                  原断档 #{gap.beforeLineNo} → #{gap.afterLineNo}，
                                  缺 {gap.missingCount} 条
                                </span>
                                {gap.gapId && (
                                  <span className="ml-2 text-xs text-gray-500">[ID: {gap.gapId.slice(0, 8)}]</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      注意：编号断档不会自动修正，保留完整证据，必须由教研组在明细页执行"复核"动作
                    </p>
                  </div>
                )}
              </div>
            }
          />

          <CheckCard
            icon={<FileSpreadsheet className="w-5 h-5" />}
            title="补录重算检测"
            description="检查是否有补录后尚未重算的记录，确保数据完整性"
            passed={checkResult.supplementRecalc.passed}
            details={
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">总补录记录：</span>
                    <span className="font-medium text-gray-900 ml-1">{checkResult.supplementRecalc.details.supplementCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">待重算：</span>
                    <span className={`font-medium ml-1 ${checkResult.supplementRecalc.details.pendingRecalcCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {checkResult.supplementRecalc.details.pendingRecalcCount} 条
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">已重算：</span>
                    <span className="font-medium ml-1 text-purple-600">
                      {checkResult.supplementRecalc.details.supplementCount - checkResult.supplementRecalc.details.pendingRecalcCount} 条
                    </span>
                  </div>
                </div>
                {checkResult.supplementRecalc.details.items.length > 0 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2">待重算记录：</p>
                    <div className="space-y-1">
                      {checkResult.supplementRecalc.details.items.map((item, idx) => (
                        <div key={idx} className="text-sm text-amber-700 flex items-center space-x-3 bg-white/60 p-2 rounded">
                          <span className="font-mono text-xs">{item.id.slice(0, 8)}...</span>
                          <span>原始行号：补录</span>
                          <span>订单号：{item.orderNo || '-'}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-amber-100 font-medium">{item.status}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-amber-600">
                      请在"拣货路线明细"页点击顶部"补录后重算"按钮完成重算
                    </p>
                  </div>
                )}
              </div>
            }
          />

          <CheckCard
            icon={<Database className="w-5 h-5" />}
            title="导出一致性校验"
            description="确保页面展示、导出明细、接口返回读取同一份 picking_route + gap_record 数据源"
            passed={checkResult.exportConsistency.passed}
            details={
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">页面展示：</span>
                    <span className="font-medium text-gray-900 ml-1">{checkResult.exportConsistency.details.pageCount} 条</span>
                  </div>
                  <div>
                    <span className="text-gray-500">导出明细：</span>
                    <span className="font-medium text-gray-900 ml-1">{checkResult.exportConsistency.details.exportCount} 条</span>
                  </div>
                  <div>
                    <span className="text-gray-500">接口返回：</span>
                    <span className="font-medium text-gray-900 ml-1">{checkResult.exportConsistency.details.apiCount} 条</span>
                  </div>
                  <div>
                    <span className="text-gray-500">数据库实际：</span>
                    <span className="font-medium text-gray-900 ml-1">{(checkResult.exportConsistency.details as any).dbCount ?? checkResult.exportConsistency.details.pageCount} 条</span>
                  </div>
                </div>
                <div className={`mt-3 p-3 rounded border ${
                  checkResult.exportConsistency.details.isConsistent
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    {checkResult.exportConsistency.details.isConsistent ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      checkResult.exportConsistency.details.isConsistent ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {checkResult.exportConsistency.details.isConsistent
                        ? '✅ 数据一致性校验通过：页面/导出/接口/DB 四重读取同一份 picking_route + gap_record 数据'
                        : '❌ 数据不一致！请立即检查，确保单一数据源原则'}
                    </span>
                  </div>
                  {!checkResult.exportConsistency.details.isConsistent && (
                    <p className="mt-1 text-xs text-red-600">
                      这是严重问题，请立即联系技术人员，确保所有列表、接口、导出都读取同一份结果
                    </p>
                  )}
                </div>
              </div>
            }
          />
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">给教研组的说明</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>四项自检覆盖最容易出错的场景，每次操作后建议重新自检</li>
          <li>编号断档不会自动修正，保留原始证据，请在明细页的黄色断档列表点击"教研组复核"处理</li>
          <li>所有展示、导出、接口、自检均读取同一份 picking_route + gap_record 数据源，口径一致</li>
          <li>每条记录的变更历史均可追溯（含断档复核的全部信息），点击明细页的眼睛图标查看</li>
          <li>导出CSV末尾附带断档汇总表，便于教研组直接核对</li>
        </ul>
      </div>
    </div>
  );
};

interface CheckCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  passed: boolean;
  details: React.ReactNode;
}

const CheckCard: React.FC<CheckCardProps> = ({ icon, title, description, passed, details }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className={`px-6 py-4 border-b border-gray-100 ${passed ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded flex items-center justify-center ${passed ? 'bg-green-200' : 'bg-red-200'}`}>
              <div className={passed ? 'text-green-700' : 'text-red-700'}>{icon}</div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-lg font-bold text-gray-900">{title}</h3>
                {passed ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    通过
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                    <XCircle className="w-3 h-3 mr-1" />
                    未通过
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{description}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-4">
        {details}
      </div>
    </div>
  );
};
