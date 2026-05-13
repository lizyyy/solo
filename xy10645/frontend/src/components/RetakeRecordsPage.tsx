import React, { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import { retakeRecordApi, studentApi } from '../api';
import { RetakeRecord, Student } from '../types';

const RetakeRecordsPage: React.FC = () => {
  const [retakeRecords, setRetakeRecords] = useState<RetakeRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [retakeRes, stuRes]: any = await Promise.all([
        retakeRecordApi.getAll(),
        studentApi.getAll()
      ]);
      setRetakeRecords(retakeRes.data);
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

  const columns = [
    { title: '学员姓名', dataIndex: 'studentId', key: 'studentId', render: getStudentName },
    { title: '第几次补考', dataIndex: 'retakeCount', key: 'retakeCount' },
    { title: '补考日期', dataIndex: 'retakeDate', key: 'retakeDate' },
    { title: '补考成绩', dataIndex: 'score', key: 'score' },
    { 
      title: '是否通过', 
      dataIndex: 'isPassed', 
      key: 'isPassed',
      render: (isPassed: boolean) => (
        <Tag color={isPassed ? 'success' : 'error'}>
          {isPassed ? '通过' : '未通过'}
        </Tag>
      )
    },
    { title: '录入人', dataIndex: 'createdBy', key: 'createdBy' }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>补考记录</h2>
      <Table
        columns={columns}
        dataSource={retakeRecords}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default RetakeRecordsPage;
