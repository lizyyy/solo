import React from 'react';
import { Search, Download, FileX, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';

const LedgerPage: React.FC = () => {
  const {
    reissueRequests,
    certificates,
    searchQuery,
    setSearchQuery,
    getStudentById,
    getAwardById,
    getCertificateById,
    getCompetitionById
  } = useStore();

  const completedCount = reissueRequests.filter(r => r.status === 'completed').length;
  const pendingCount = reissueRequests.filter(r => r.status === 'pending').length;
  const blockedCount = reissueRequests.filter(r => r.status === 'blocked').length;
  const totalCertificates = certificates.length;

  const exportToExcel = () => {
    const data = reissueRequests.map(req => {
      const student = getStudentById(req.studentId);
      const award = getAwardById(req.awardId);
      const competition = award ? getCompetitionById(award.competitionId) : null;
      const oldCert = getCertificateById(req.certificateId);
      const newCert = req.newCertificateId ? getCertificateById(req.newCertificateId) : null;

      return {
        '申请日期': req.createdAt,
        '学生姓名': req.originalName,
        '学号': student?.studentId || '',
        '班级': student?.className || '',
        '竞赛名称': competition?.name || '',
        '奖项等级': award?.awardLevel || '',
        '原证书编号': oldCert?.certificateNo || '',
        '新证书编号': newCert?.certificateNo || '',
        '更正后姓名': req.correctedName || '',
        '补发原因': req.reason,
        '领取人': req.receiver,
        '领取人类型': req.receiverType,
        '状态': req.status,
        '完成日期': req.completedAt || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '证书补发台账');
    XLSX.writeFile(wb, `证书补发台账_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getRequestDetail = (request: typeof reissueRequests[0]) => {
    const student = getStudentById(request.studentId);
    const award = getAwardById(request.awardId);
    const competition = award ? getCompetitionById(award.competitionId) : null;
    const oldCert = getCertificateById(request.certificateId);
    const newCert = request.newCertificateId ? getCertificateById(request.newCertificateId) : null;

    return { student, award, competition, oldCert, newCert };
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="证书总数"
          value={totalCertificates}
          icon={FileX}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <StatsCard
          title="待处理申请"
          value={pendingCount}
          icon={Clock}
          color="text-yellow-600"
          bgColor="bg-yellow-100"
        />
        <StatsCard
          title="被拦截申请"
          value={blockedCount}
          icon={AlertTriangle}
          color="text-orange-600"
          bgColor="bg-orange-100"
        />
        <StatsCard
          title="已完成补发"
          value={completedCount}
          icon={CheckCircle}
          color="text-green-600"
          bgColor="bg-green-100"
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">补发台账</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索学生姓名、学号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={exportToExcel}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  申请日期
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  学生信息
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  竞赛奖项
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  证书信息
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  领取人
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  拦截原因
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reissueRequests.map(request => {
                const { student, competition, oldCert, newCert } = getRequestDetail(request);
                return (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="table-cell">{request.createdAt}</td>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium">{request.originalName}</p>
                        <p className="text-xs text-gray-500">{student?.studentId}</p>
                        <p className="text-xs text-gray-500">{student?.className}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="text-sm">{competition?.name}</p>
                        <p className="text-xs text-gray-500">{request.awardId}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="text-sm font-mono">{oldCert?.certificateNo}</p>
                        {newCert && (
                          <p className="text-xs text-green-600 font-mono">→ {newCert.certificateNo}</p>
                        )}
                        {request.correctedName && (
                          <p className="text-xs text-blue-600">
                            {request.originalName} → {request.correctedName}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="text-sm">{request.receiver}</p>
                        <p className="text-xs text-gray-500">
                          {request.receiverType === 'student' ? '学生本人' :
                           request.receiverType === 'class_teacher' ? '班主任代领' :
                           request.receiverType === 'parent' ? '家长代领' : '其他'}
                        </p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="table-cell">
                      {request.blockerReason ? (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                          {request.blockerReason}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LedgerPage;
