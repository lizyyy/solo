import { useState, useEffect } from 'react';
import { api } from '../api';
import type { ClassSummary, ExportData, Toast } from '../types';
import * as XLSX from 'xlsx';

interface ClassSummaryPageProps {
  onToast: (type: Toast['type'], message: string) => void;
}

export default function ClassSummaryPage({ onToast }: ClassSummaryPageProps) {
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await api.getClassSummary();
    
    if (result.success && result.data) {
      setClassSummaries(result.data);
    } else {
      onToast('error', result.message || '加载班级汇总失败');
    }
    
    setLoading(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.getExportData();
      
      if (result.success && result.data) {
        exportToExcel(result.data);
        onToast('success', '导出成功！班主任报表已生成');
      } else {
        onToast('error', result.message || '导出失败');
      }
    } catch (error) {
      onToast('error', '导出失败，请稍后重试');
    }
    setExporting(false);
  };

  const exportToExcel = (data: ExportData[]) => {
    const wb = XLSX.utils.book_new();
    
    const summaryData = data.map(cls => ({
      '班级': cls.className,
      '学生总数': cls.totalStudents,
      '已报名人数': cls.enrolledCount,
      '报名率': cls.enrollmentRate,
      '未报名人数': cls.totalStudents - cls.enrolledCount,
    }));
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    ws1['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, '班级汇总');
    
    const detailData: any[] = [];
    data.forEach(cls => {
      cls.students.forEach((student, index) => {
        detailData.push({
          '班级': index === 0 ? cls.className : '',
          '姓名': student.name,
          '年级': student.grade,
          '报名情况': student.courses,
          '详细课程': student.courseDetails,
        });
      });
    });
    const ws2 = XLSX.utils.json_to_sheet(detailData);
    ws2['!cols'] = [
      { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 40 }, { wch: 60 }
    ];
    XLSX.utils.book_append_sheet(wb, ws2, '学生明细');
    
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `课后服务选课汇总_${dateStr}.xlsx`);
  };

  const totalStudents = classSummaries.reduce((sum, c) => sum + c.totalStudents, 0);
  const totalEnrolled = classSummaries.reduce((sum, c) => sum + c.enrolledCount, 0);
  const overallRate = totalStudents > 0 ? ((totalEnrolled / totalStudents) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">👥 班级汇总</h2>
        
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              <div>
                <span className="text-gray-500 text-sm">学生总数：</span>
                <span className="font-medium text-gray-800">{totalStudents}人</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">已报名：</span>
                <span className="font-medium text-green-600">{totalEnrolled}人</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">整体报名率：</span>
                <span className="font-medium text-blue-600">{overallRate}%</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadData}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                🔄 刷新
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {exporting ? '导出中...' : '📊 导出班主任报表'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {classSummaries.map(classSummary => (
          <div key={classSummary.className} className="bg-white rounded-lg shadow overflow-hidden">
            <div
              className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setExpandedClass(expandedClass === classSummary.className ? null : classSummary.className)}
            >
              <div className="flex items-center gap-6">
                <h3 className="font-medium text-gray-800">{classSummary.className}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  parseFloat(classSummary.enrollmentRate) >= 90 ? 'bg-green-100 text-green-700' :
                  parseFloat(classSummary.enrollmentRate) >= 70 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  报名率 {classSummary.enrollmentRate}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  已报名：{classSummary.enrolledCount}/{classSummary.totalStudents}
                </span>
                <span className="text-gray-400">
                  {expandedClass === classSummary.className ? '▲' : '▼'}
                </span>
              </div>
            </div>
            
            {expandedClass === classSummary.className && (
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-500 font-normal w-16">序号</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-normal w-24">姓名</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-normal w-20">年级</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-normal">报名课程</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-normal w-24">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classSummary.students.map((student, index) => (
                      <tr key={student.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-500">{index + 1}</td>
                        <td className="py-2 px-3 font-medium">{student.name}</td>
                        <td className="py-2 px-3">{student.grade}年级</td>
                        <td className="py-2 px-3">
                          {student.enrollments.length > 0 ? (
                            <div className="space-y-1">
                              {student.enrollments.map((enrollment, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-gray-800">{enrollment.courseName}</span>
                                  <span className="text-gray-400 text-xs">
                                    {enrollment.dayOfWeek} {enrollment.timeSlot}
                                  </span>
                                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                                    enrollment.status === '已报名' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {enrollment.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">未报名</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {student.enrollments.length > 0 ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                              已报名
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                              未报名
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
