import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Course, Student, Toast } from '../types';

interface CoursesPageProps {
  onToast: (type: Toast['type'], message: string) => void;
}

export default function CoursesPage({ onToast }: CoursesPageProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [filterDay, setFilterDay] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [coursesRes, studentsRes] = await Promise.all([
      api.getCourses(),
      api.getStudents(),
    ]);
    
    if (coursesRes.success && coursesRes.data) {
      setCourses(coursesRes.data);
    } else {
      onToast('error', coursesRes.message || '加载课程列表失败');
    }
    
    if (studentsRes.success && studentsRes.data) {
      setStudents(studentsRes.data);
    } else {
      onToast('error', studentsRes.message || '加载学生列表失败');
    }
    
    setLoading(false);
  };

  const handleEnroll = async (courseId: string) => {
    if (!selectedStudent) {
      onToast('warning', '请先选择学生');
      return;
    }
    
    setEnrolling(courseId);
    const result = await api.enroll(selectedStudent, courseId);
    
    if (result.success) {
      onToast(result.message?.includes('候补') ? 'warning' : 'success', result.message || '报名成功');
      loadData();
    } else {
      onToast('error', result.message || '报名失败');
    }
    
    setEnrolling(null);
  };

  const filteredCourses = courses.filter(course => {
    if (filterDay && course.dayOfWeek !== filterDay) return false;
    if (filterGrade) {
      const grade = parseInt(filterGrade);
      if (!course.allowedGrades.includes(grade)) return false;
    }
    return true;
  });

  const days = ['周一', '周二', '周三', '周四', '周五'];
  const grades = [1, 2, 3, 4, 5, 6];

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
        <h2 className="text-xl font-bold text-gray-800 mb-4">📚 课程列表</h2>
        
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">选择学生</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择要报名的学生</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.className} ({student.grade}年级)
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">按星期筛选</label>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">按年级筛选</label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部</option>
                {grades.map(grade => (
                  <option key={grade} value={grade}>{grade}年级</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              🔄 刷新
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCourses.map(course => (
          <div
            key={course.id}
            className={`bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${
              course.isFull ? 'border-orange-300' : 'border-gray-200'
            }`}
          >
            <div className={`p-4 border-b ${
              course.isFull ? 'bg-orange-50' : 'bg-blue-50'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">{course.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                </div>
                {course.isFull && (
                  <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded-full">
                    已满
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4 space-y-2">
              <div className="flex items-center text-sm">
                <span className="text-gray-500 w-20">👨‍🏫 老师：</span>
                <span className="text-gray-800">{course.teacherName}</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="text-gray-500 w-20">📅 时间：</span>
                <span className="text-gray-800">{course.dayOfWeek} {course.timeSlot}</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="text-gray-500 w-20">📝 年级：</span>
                <span className="text-gray-800">
                  {course.allowedGrades.map(g => `${g}年级`).join('、')}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="text-gray-500 w-20">👥 名额：</span>
                <span className={`font-medium ${
                  course.availableSeats > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {course.currentCount}/{course.maxCapacity}
                  {course.availableSeats > 0 ? ` (剩余${course.availableSeats}个)` : ''}
                </span>
              </div>
              {course.waitlistCount > 0 && (
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-20">⏳ 候补：</span>
                  <span className="text-yellow-600">{course.waitlistCount}人</span>
                </div>
              )}
            </div>
            
            <div className="px-4 pb-4">
              <button
                onClick={() => handleEnroll(course.id)}
                disabled={enrolling === course.id || !selectedStudent}
                className={`w-full py-2 rounded-md font-medium transition-colors ${
                  enrolling === course.id
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : !selectedStudent
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : course.isFull
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {enrolling === course.id
                  ? '处理中...'
                  : course.isFull
                  ? '加入候补队列'
                  : '立即报名'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCourses.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          暂无符合条件的课程
        </div>
      )}
    </div>
  );
}
