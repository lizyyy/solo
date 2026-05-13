import React, { useEffect, useState } from 'react';
import { Table, Tag, message, Progress } from 'antd';
import { examScoreApi, studentApi } from '../api';
import { ExamScore, Student } from '../types';

const ExamScoresPage: React.FC = () => {
  const [examScores, setExamScores] = useState<ExamScore[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [scoreRes, stuRes]: any = await Promise.all([
        examScoreApi.getAll(),
        studentApi.getAll()
      ]);
      setExamScores(scoreRes.data);
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

  const getExamTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      final: '期末考试',
      midterm: '期中考试',
      quiz: '小测'
    };
    return typeMap[type] || type;
  };

  const columns = [
    { title: '学员姓名', dataIndex: 'studentId', key: 'studentId', render: getStudentName },
    { title: '考试类型', dataIndex: 'examType', key: 'examType', render: getExamTypeText },
    { 
      title: '成绩', 
      dataIndex: 'score', 
      key: 'score',
      render: (score: number, record: ExamScore) => {
        const percent = (score / record.fullScore) * 100;
        return (
          <div>
            <Progress 
              percent={percent} 
              size="small" 
              status={record.isPassed ? 'success' : 'exception'}
              format={() => `${score}/${record.fullScore}`}
            />
          </div>
        );
      }
    },
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
    { title: '及格线', dataIndex: 'passScore', key: 'passScore' },
    { title: '考试日期', dataIndex: 'examDate', key: 'examDate' },
    { title: '录入人', dataIndex: 'createdBy', key: 'createdBy' }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>考试成绩</h2>
      <Table
        columns={columns}
        dataSource={examScores}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default ExamScoresPage;
