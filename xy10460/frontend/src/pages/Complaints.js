import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Typography, Tag, Space, Input, message, Select
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const Complaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [processStatus, setProcessStatus] = useState('approved');
  const [processResult, setProcessResult] = useState('');

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/complaints');
      setComplaints(res.data);
    } catch (error) {
      message.error('获取申诉列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = (record) => {
    setSelectedComplaint(record);
    setProcessStatus('approved');
    setProcessResult('');
    setProcessModalVisible(true);
  };

  const handleProcessSubmit = async () => {
    try {
      await axios.put(`/api/complaints/${selectedComplaint.id}/process`, {
        status: processStatus,
        process_result: processResult
      });
      message.success('处理成功');
      setProcessModalVisible(false);
      fetchComplaints();
    } catch (error) {
      message.error(error.response?.data?.error || '处理失败');
    }
  };

  const statusMap = {
    'pending': { label: '待处理', color: 'orange', icon: <ClockCircleOutlined /> },
    'approved': { label: '申诉成功', color: 'green', icon: <CheckCircleOutlined /> },
    'rejected': { label: '申诉驳回', color: 'red', icon: <CloseCircleOutlined /> }
  };

  const typeMap = {
    'inspection': '抽检申诉',
    'exchange': '兑换申诉'
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '居民姓名', dataIndex: 'resident_name', key: 'resident_name' },
    { title: '联系电话', dataIndex: 'resident_phone', key: 'resident_phone' },
    { 
      title: '申诉类型', 
      dataIndex: 'related_type', 
      key: 'related_type',
      render: (type) => typeMap[type] || type
    },
    { title: '关联ID', dataIndex: 'related_id', key: 'related_id' },
    { title: '申诉理由', dataIndex: 'reason', key: 'reason' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        const info = statusMap[status] || { label: status, color: 'default', icon: null };
        return <Tag color={info.color} icon={info.icon}>{info.label}</Tag>;
      }
    },
    { title: '处理结果', dataIndex: 'process_result', key: 'process_result' },
    { 
      title: '申诉时间', 
      dataIndex: 'created_at', 
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button 
              type="link" 
              onClick={() => handleProcess(record)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>申诉处理</Title>
      
      <div style={{ marginBottom: 16, color: '#666' }}>
        <strong>说明：</strong>
        <ul style={{ marginTop: 8, marginLeft: 20 }}>
          <li>抽检申诉成功将返还已扣除的50%积分</li>
          <li>已处理的申诉不可再次修改</li>
        </ul>
      </div>

      <Table
        columns={columns}
        dataSource={complaints}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="处理申诉"
        open={processModalVisible}
        onCancel={() => setProcessModalVisible(false)}
        onOk={handleProcessSubmit}
        okText="确认处理"
        cancelText="取消"
      >
        {selectedComplaint && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>居民：</strong>{selectedComplaint.resident_name}</p>
            <p><strong>申诉类型：</strong>{typeMap[selectedComplaint.related_type] || selectedComplaint.related_type}</p>
            <p><strong>关联ID：</strong>{selectedComplaint.related_id}</p>
            <p><strong>申诉理由：</strong>{selectedComplaint.reason}</p>
            {selectedComplaint.related_type === 'inspection' && (
              <p style={{ color: '#52c41a', background: '#f6ffed', padding: 8, borderRadius: 4 }}>
                <strong>提示：</strong>抽检申诉成功将自动返还50%积分
              </p>
            )}
          </div>
        )}
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>处理结果：</label>
            <Select
              value={processStatus}
              onChange={setProcessStatus}
              style={{ width: '100%' }}
            >
              <Option value="approved">申诉成功</Option>
              <Option value="rejected">申诉驳回</Option>
            </Select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>处理说明：</label>
            <TextArea
              value={processResult}
              onChange={(e) => setProcessResult(e.target.value)}
              placeholder="请详细描述处理结果和说明"
              rows={4}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default Complaints;
