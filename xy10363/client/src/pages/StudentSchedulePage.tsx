import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Student, ScheduleItem, Toast } from '../types';

interface StudentSchedulePageProps {
  onToast: (type: Toast['type'], message: string) => void;
}

const DAYS = ['周一', '周二', '周三', '周四', '周五'];
const TIME_SLOTS = ['16:00-17:30', '17:40-19:00'];

export default function StudentSchedulePage({ onToast }: StudentSchedulePageProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    const result = await api.getStudents();
    if (result.success && result.data) {
      setStudents(result.data);
    } else {
      onToast('error', result.message || '加载学生列表失败');
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

  const getScheduleItem = (day: string, timeSlot: string) => {
    return schedule.find(s => s.dayOfWeek === day && s.timeSlot === timeSlot);
  };

  const student = students.find(s => s.id === selectedStudent);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🗓️ 学生课表</h2>
        
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">选择学生查看课表</label>
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
              disabled={!selectedStudent || loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🔄 刷新
            </button>
          </div>
        </div>
      </div>

      {!selectedStudent ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          👆 请选择一位学生，查看其课程表
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
                <div>
                  <span className="text-gray-600">📚 已报名课程：</span>
                  <span className="font-medium text-green-600">
                    {schedule.filter(s => s.status === 'active').length}门
                  </span>
                </div>
                {schedule.filter(s => s.status === 'waitlist').length > 0 && (
                  <div>
                    <span className="text-gray-600">⏳ 候补课程：</span>
                    <span className="font-medium text-yellow-600">
                      {schedule.filter(s => s.status === 'waitlist').length}门
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-medium text-gray-700">课程表</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4 text-left text-gray-500 font-normal w-32 bg-gray-50">时间</th>
                    {DAYS.map(day => (
                      <th key={day} className="py-3 px-4 text-center text-gray-700 font-medium min-w-[180px]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map(timeSlot => (
                    <tr key={timeSlot} className="border-b last:border-b-0">
                      <td className="py-4 px-4 text-gray-600 font-medium bg-gray-50">
                        {timeSlot}
                      </td>
                      {DAYS.map(day => {
                        const item = getScheduleItem(day, timeSlot);
                        return (
                          <td key={day} className="py-3 px-2 border-l first:border-l-0">
                            {item ? (
                              <div className={`p-3 rounded-lg ${
                                item.status === 'active' 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'bg-yellow-50 border border-yellow-200'
                              }`}>
                                <div className="font-medium text-gray-800">{item.courseName}</div>
                                <div className="text-xs text-gray-500 mt-1">👨‍🏫 {item.teacherName}</div>
                                {item.status === 'waitlist' && (
                                  <div className="text-xs text-yellow-600 mt-1">
                                    ⏳ 候补第{item.waitlistPosition}位
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="p-3 text-center text-gray-300">
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {schedule.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-700">报名列表</h3>
              </div>
              <div className="divide-y">
                {schedule.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{item.courseName}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          item.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {item.status === 'active' ? '已报名' : `候补第${item.waitlistPosition}位`}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        <span className="mr-4">👨‍🏫 {item.teacherName}</span>
                        <span className="mr-4">📅 {item.dayOfWeek} {item.timeSlot}</span>
                        {item.courseDescription && (
                          <span className="text-gray-400">{item.courseDescription}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
