import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Course, Student, ScheduleItem, Toast } from '../types';

interface EnrollmentsPageProps {
  onToast: (type: Toast['type'], message: string) => void;
}

export default function EnrollmentsPage({ onToast }: EnrollmentsPageProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromCourse, setTransferFromCourse] = useState<string>('');
  const [transferToCourse, setTransferToCourse] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadStudents();
    loadCourses();
  }, []);

  const loadStudents = async () => {
    const result = await api.getStudents();
    if (result.success && result.data) {
      setStudents(result.data);
    } else {
      onToast('error', result.message || '加载学生列表失败');
    }
  };

  const loadCourses = async () => {
    const result = await api.getCourses();
    if (result.success && result.data) {
      setCourses(result.data);
    }
  };

  const loadSchedule = async (studentId: string) => {
    if (!studentId) {
      setSchedule([]);
      return;
    }
    
    setLoading(true);
    const result = await api.getStudentSchedule(studentId);
    
    if (result.success && result.data) {
      setSchedule(result.data);
    } else {
      onToast('error', result.message || '加载学生课表失败');
    }
    
    setLoading(false);
  };

  const handleStudentChange = (studentId: string) => {
    setSelectedStudent(studentId);
    loadSchedule(studentId);
  };

  const handleWithdraw = async (enrollmentId: string, courseName: string) => {
    if (!confirm(`确定要退掉"${courseName}"吗？退课后，如果是正式报名的课程，候补的同学会按顺序补上。`)) {
      return;
    }
    
    const result = await api.withdraw(enrollmentId);
    
    if (result.success) {
      onToast('success', result.message || '退课成功');
      loadSchedule(selectedStudent);
      loadCourses();
    } else {
      onToast('error', result.message || '退课失败');
    }
  };

  const openTransferModal = (fromCourseId: string) => {
    setTransferFromCourse(fromCourseId);
    setTransferToCourse('');
    setShowTransferModal(true);
  };

  const handleTransferRequest = async () => {
    if (!transferToCourse) {
      onToast('warning', '请选择目标课程');
      return;
    }
    
    setProcessing(true);
    const result = await api.requestTransfer(selectedStudent, transferFromCourse, transferToCourse);
    
    if (result.success) {
      onToast('success', result.message || '改选申请已提交');
      setShowTransferModal(false);
      loadSchedule(selectedStudent);
    } else {
      onToast('error', result.message || '提交改选申请失败');
    }
    
    setProcessing(false);
  };

  const availableTransferCourses = courses.filter(course => {
    if (course.id === transferFromCourse) return false;
    const currentEnrollment = schedule.find(e => e.courseId === transferFromCourse);
    if (currentEnrollment) {
      const student = students.find(s => s.id === selectedStudent);
      if (student && !course.allowedGrades.includes(student.grade)) return false;
      if (currentEnrollment.dayOfWeek === course.dayOfWeek && currentEnrollment.timeSlot === course.timeSlot) return false;
    }
    const alreadyEnrolled = schedule.find(e => e.courseId === course.id && e.status === 'active');
    if (alreadyEnrolled) return false;
    return true;
  });

  const student = students.find(s => s.id === selectedStudent);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">📝 报名管理</h2>
        
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">选择学生查看报名</label>
              <select
                value={selectedStudent}
                onChange={(e) => handleStudentChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择学生</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} - {s.className} ({s.grade}年级)
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => loadSchedule(selectedStudent)}
              disabled={!selectedStudent}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🔄 刷新
            </button>
          </div>
        </div>
      </div>

      {!selectedStudent ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          👆 请选择一位学生，查看其报名情况
        </div>
      ) : loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          加载中...
        </div>
      ) : (
        <div>
          {student && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-gray-600">👤 学生：</span>
                  <span className="font-medium">{student.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">🎓 年级：</span>
                  <span className="font-medium">{student.grade}年级</span>
                </div>
                <div>
                  <span className="text-gray-600">🏫 班级：</span>
                  <span className="font-medium">{student.className}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-medium text-gray-700">当前报名</h3>
            </div>
            {schedule.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                该学生暂无任何报名
              </div>
            ) : (
              <div className="divide-y">
                {schedule.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-800">{item.courseName}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {item.status === 'active' ? '已报名' : `候补第${item.waitlistPosition}位`}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        <span className="mr-4">👨‍🏫 {item.teacherName}</span>
                        <span className="mr-4">📅 {item.dayOfWeek} {item.timeSlot}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {item.status === 'active' && (
                        <button
                          onClick={() => openTransferModal(item.courseId)}
                          className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                        >
                          🔄 改选
                        </button>
                      )}
                      <button
                        onClick={() => handleWithdraw(item.id, item.courseName)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        ❌ 退课
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-4 py-3 border-b">
              <h3 className="font-bold text-gray-800">提交改选申请</h3>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">原课程</label>
                <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
                  {courses.find(c => c.id === transferFromCourse)?.name}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">目标课程</label>
                <select
                  value={transferToCourse}
                  onChange={(e) => setTransferToCourse(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择目标课程</option>
                  {availableTransferCourses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name} - {course.dayOfWeek} {course.timeSlot} ({course.teacherName})
                      {course.isFull ? ' [已满]' : ` [剩余${course.availableSeats}个名额]`}
                    </option>
                  ))}
                </select>
                {availableTransferCourses.length === 0 && (
                  <p className="mt-1 text-sm text-orange-600">
                    暂无可改选的课程（已自动排除年级不符、时段冲突和已报名的课程）
                  </p>
                )}
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowTransferModal(false)}
                  disabled={processing}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleTransferRequest}
                  disabled={!transferToCourse || processing}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {processing ? '提交中...' : '提交申请'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
