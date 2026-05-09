import { useState, useEffect } from 'react';
import { X, Search, User, BookOpen, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { requestsApi } from '../api';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ onClose, onCreated }: Props) {
  const [keyword, setKeyword] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: students, isFetching: searching } = useQuery({
    queryKey: ['student-search', keyword],
    queryFn: () => requestsApi.searchStudents(keyword).then(res => res.data),
    enabled: keyword.length > 0,
    staleTime: 30 * 1000,
  });

  const handleSubmit = async () => {
    if (!selectedStudent || !selectedCourse || !reason.trim()) {
      setError('请填写完整信息');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await requestsApi.create({
        studentId: selectedStudent.id,
        courseCode: selectedCourse.course_code,
        courseName: selectedCourse.course_name,
        reason: reason.trim(),
      });
      onCreated();
    } catch (e: any) {
      setError(e.response?.data?.error || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">新建补发申请</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜索学员 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="输入姓名、手机号或身份证号搜索..."
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setSelectedStudent(null);
                  setSelectedCourse(null);
                }}
                className="input pl-10"
              />
            </div>

            {students && students.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => {
                      setSelectedStudent(student);
                      setSelectedCourse(null);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                      selectedStudent?.id === student.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium">{student.name}</div>
                      <div className="text-sm text-gray-500">{student.phone} · {student.id_card}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {keyword && students && students.length === 0 && !searching && (
              <p className="mt-2 text-sm text-gray-500">未找到匹配的学员</p>
            )}
          </div>

          {selectedStudent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择课程 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {students
                  ?.filter((s) => s.id === selectedStudent.id && s.course_code)
                  .map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedCourse(s)}
                      className={`w-full px-4 py-3 text-left border rounded-lg hover:border-primary-500 flex items-center space-x-3 ${
                        selectedCourse?.course_code === s.course_code
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <BookOpen className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium">{s.course_name}</div>
                        <div className="text-sm text-gray-500 flex items-center space-x-3">
                          <span>{s.course_code}</span>
                          <span className={s.completion_status === 'completed' ? 'text-green-600' : 'text-yellow-600'}>
                            {s.completion_status === 'completed' ? '✓ 已完成' : '○ 未完成'}
                          </span>
                          <span className={s.payment_status === 'paid' ? 'text-green-600' : 'text-red-600'}>
                            {s.payment_status === 'paid' ? '✓ 已缴费' : '○ 未缴费'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              补发原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入证书补发原因，例如：证书损坏、地址变更需要重新邮寄、证书丢失等..."
              rows={3}
              className="input resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-secondary" disabled={loading}>
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary"
            disabled={loading || !selectedStudent || !selectedCourse || !reason.trim()}
          >
            {loading ? '创建中...' : '创建申请'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateModal;
