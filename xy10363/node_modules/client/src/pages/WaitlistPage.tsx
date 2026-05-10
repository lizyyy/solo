import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Course, Toast } from '../types';

interface WaitlistPageProps {
  onToast: (type: Toast['type'], message: string) => void;
}

export default function WaitlistPage({ onToast }: WaitlistPageProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    const result = await api.getCourses();
    
    if (result.success && result.data) {
      setCourses(result.data);
    } else {
      onToast('error', result.message || '加载课程列表失败');
    }
    
    setLoading(false);
  };

  const coursesWithWaitlist = courses.filter(c => c.waitlistCount > 0);
  const totalWaitlistCount = coursesWithWaitlist.reduce((sum, c) => sum + c.waitlistCount, 0);

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
        <h2 className="text-xl font-bold text-gray-800 mb-4">⏳ 候补转入</h2>
        
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              说明：当有学生退课时，该课程的候补第一位同学会自动转入正式报名。您也可以在下方查看所有候补队列情况。
            </div>
            <button
              onClick={loadCourses}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              🔄 刷新
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">
              {coursesWithWaitlist.length}
            </div>
            <div className="text-sm text-yellow-600">有待补课程</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="text-2xl font-bold text-orange-700">
              {totalWaitlistCount}
            </div>
            <div className="text-sm text-orange-600">候补总人数</div>
          </div>
        </div>
      </div>

      {coursesWithWaitlist.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          🎉 目前没有任何课程有候补队列
        </div>
      ) : (
        <div className="space-y-4">
          {coursesWithWaitlist.map(course => (
            <div key={course.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div
                className="px-4 py-3 bg-orange-50 border-b flex items-center justify-between cursor-pointer hover:bg-orange-100 transition-colors"
                onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
              >
                <div className="flex items-center gap-4">
                  <h3 className="font-medium text-gray-800">{course.name}</h3>
                  <span className="px-2 py-0.5 bg-orange-200 text-orange-700 text-xs rounded-full">
                    {course.dayOfWeek} {course.timeSlot}
                  </span>
                  <span className="text-sm text-gray-500">👨‍🏫 {course.teacherName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    正式名额：{course.currentCount}/{course.maxCapacity}
                  </span>
                  <span className="text-sm font-medium text-orange-600">
                    候补：{course.waitlistCount}人
                  </span>
                  <span className="text-gray-400">
                    {expandedCourse === course.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>
              
              {expandedCourse === course.id && (
                <div className="p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">候补队列（按申请顺序排列）</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-gray-500 font-normal">顺序</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-normal">学生姓名</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-normal">年级</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-normal">班级</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-normal">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.waitlist.map((waitlistItem, index) => (
                        <tr key={waitlistItem.id} className="border-b last:border-b-0 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            {index === 0 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                {waitlistItem.waitlistPosition}
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                {waitlistItem.waitlistPosition}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-medium">{waitlistItem.studentName}</td>
                          <td className="py-2 px-3">{waitlistItem.studentGrade}年级</td>
                          <td className="py-2 px-3">{waitlistItem.studentClass}</td>
                          <td className="py-2 px-3">
                            {index === 0 ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                下一位转入
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                等待中
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {course.enrolledStudents.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">当前正式报名学生（{course.enrolledStudents.length}人）</h4>
                      <div className="flex flex-wrap gap-2">
                        {course.enrolledStudents.map(student => (
                          <span key={student.id} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {student.studentName} ({student.studentClass})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
