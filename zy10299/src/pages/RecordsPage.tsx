import React from 'react';
import { History, FileText, User, Calendar } from 'lucide-react';
import { useStore } from '../store/useStore';

const RecordsPage: React.FC = () => {
  const { correctionRecords, getStudentById, getCertificateById } = useStore();

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">更正记录</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <History className="w-4 h-4" />
            共 {correctionRecords.length} 条记录
          </div>
        </div>

        <div className="space-y-4">
          {correctionRecords.map(record => {
            const certificate = getCertificateById(record.certificateId);
            const student = getStudentById(certificate?.studentId || '');

            return (
              <div
                key={record.id}
                className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50 to-white"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <History className="w-6 h-6 text-blue-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">
                          证书更正
                        </span>
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {record.createdAt}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        操作员: {record.operatorId || '系统'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      {/* 学生信息 */}
                      <div className="bg-white rounded-lg p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">学生信息</span>
                        </div>
                        <p className="font-medium">{student?.name}</p>
                        <p className="text-sm text-gray-600">{student?.studentId}</p>
                        <p className="text-sm text-gray-600">{student?.className}</p>
                      </div>

                      {/* 姓名变更 */}
                      <div className="bg-white rounded-lg p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">姓名变更</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                            {record.oldName}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                            {record.newName}
                          </span>
                        </div>
                      </div>

                      {/* 证书变更 */}
                      <div className="bg-white rounded-lg p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">证书编号变更</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-mono">
                            {record.oldCertificateNo}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-mono">
                            {record.newCertificateNo}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 原因说明 */}
                    <div className="mt-4 bg-gray-50 rounded-lg p-3">
                      <span className="text-sm text-gray-500">更正原因: </span>
                      <span className="text-sm text-gray-700">{record.reason}</span>
                    </div>

                    {/* 证书状态说明 */}
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span className="text-gray-600">原证书已作废</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-gray-600">新证书已生效</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span className="text-gray-600">变更记录已存档</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {correctionRecords.length === 0 && (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无更正记录</p>
            </div>
          )}
        </div>
      </div>

      {/* 示例说明卡片 */}
      <div className="card bg-yellow-50 border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">📋 示例数据说明</h3>
        <div className="text-sm text-yellow-700 space-y-1">
          <p>• 王五 → 王伍：演示了姓名错误更正的完整流程，包含补发审批、证书作废、新证书生成</p>
          <p>• 系统拦截机制：奖项未复核、重复补发、班主任代领未登记等情况会自动拦截</p>
          <p>• 所有更正操作都留有完整的审计痕迹，可追溯更正前后的证书状态变化</p>
        </div>
      </div>
    </div>
  );
};

export default RecordsPage;
