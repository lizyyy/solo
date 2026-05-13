import React, { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import { attendanceApi, studentApi } from '../api';
import { Attendance, Student } from '../types';

const AttendancePage: React.FC = () => {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [attRes, stuRes]: any = await Promise.all([
        attendanceApi.getAll(),
        studentApi.getAll()
      ]);
      setAttendances(attRes.data);
      setStudents(stuRes.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getStudentName = (studentId: string) => {
    return students.find(s => s.id === studentId)?.name || studentId;
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      present: { color: 'success', text: '出勤' },
      absent: { color: 'error', text: '缺席' },
      late: { color: 'warning', text: '迟到' },
      leave: { color: 'default', text: '请假' }
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const columns = [
    { title: '学员姓名', dataIndex: 'studentId', key: 'studentId', render: getStudentName },
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy' }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>出勤记录</h2>
      <Table
        columns={columns}
        dataSource={attendances}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default AttendancePage;
