import React, { useEffect, useState } from 'react';
import { Table, message, Select, Space } from 'antd';
import { historyApi } from '../api';
import { StatusHistory } from '../types';

const HistoryPage: React.FC = () => {
  const [histories, setHistories] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState<string | undefined>();

  useEffect(() => {
    loadData();
  }, [entityType]);

  const loadData = async () => {
    try {
      const res: any = await historyApi.getAll({ entityType });
      setHistories(res.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getEntityTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      student: '学员',
      attendance: '出勤',
      examScore: '考试成绩',
      retake: '补考记录',
      certificate: '证书'
    };
    return typeMap[type] || type;
  };

  const columns = [
    { title: '实体类型', dataIndex: 'entityType', key: 'entityType', render: getEntityTypeText },
    { title: '字段名', dataIndex: 'fieldName', key: 'fieldName' },
    { title: '旧值', dataIndex: 'oldValue', key: 'oldValue' },
    { title: '新值', dataIndex: 'newValue', key: 'newValue' },
    { title: '操作人', dataIndex: 'changedBy', key: 'changedBy' },
    { title: '操作时间', dataIndex: 'changedAt', key: 'changedAt' },
    { title: '备注', dataIndex: 'remark', key: 'remark' }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>变更历史</h2>
        <Space>
          <span>筛选类型：</span>
          <Select
            style={{ width: 150 }}
            allowClear
            placeholder="选择类型"
            onChange={(value) => setEntityType(value)}
          >
            <Select.Option value="student">学员</Select.Option>
            <Select.Option value="attendance">出勤</Select.Option>
            <Select.Option value="examScore">考试成绩</Select.Option>
            <Select.Option value="retake">补考记录</Select.Option>
            <Select.Option value="certificate">证书</Select.Option>
          </Select>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={histories}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default HistoryPage;
