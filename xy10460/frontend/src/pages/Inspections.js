import React, { useState, useEffect } from 'react';
import { 
  Table, Typography, Tag, Space, Button, Modal, message
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, MessageOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;

const Inspections = () => {
  const [abnormalInspections, setAbnormalInspections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [complaintModalVisible, setComplaintModalVisible] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [complaintReason, setComplaintReason] = useState('');
  const [residents, setResidents] = useState([]);

  useEffect(() => {
    fetchAbnormalInspections();
    fetchResidents();
  }, []);

  const fetchAbnormalInspections = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard/abnormal-inspections');
      setAbnormalInspections(res.data);
    } catch (error) {
      message.error('获取抽检异常记录失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchResidents = async () => {
    try {
      const res = await axios.get('/api/residents');
      setResidents(res.data);
    } catch (error) {
      message.error('获取居民列表失败');
    }
  };

  const handleComplaint = (record) => {
    setSelectedInspection(record);
    setComplaintReason('');
    setComplaintModalVisible(true);
  };

  const submitComplaint = async () => {
    if (!complaintReason.trim()) {
      message.error('请填写申诉理由');
      return;
    }

    try {
      const resident = residents.find(r => r.phone === selectedInspection.resident_phone);
      if (!resident) {
        message.error('未找到对应居民');
        return;
      }

      await axios.post('/api/complaints', {
        resident_id: resident.id,
        related_id: selectedInspection.id,
        related_type: 'inspection',
        reason: complaintReason
      });
      message.success('申诉已提交');
      setComplaintModalVisible(false);
    } catch (error) {
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  const columns = [
    { title: '抽检ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '居民姓名', dataIndex: 'resident_name', key: 'resident_name' },
    { title: '联系电话', dataIndex: 'resident_phone', key: 'resident_phone' },
    { title: '垃圾类型', dataIndex: 'garbage_type', key: 'garbage_type' },
    { title: '重量(kg)', dataIndex: 'weight', key: 'weight' },
    { title: '获得积分', dataIndex: 'points', key: 'points' },
    { 
      title: '抽检结果', 
      dataIndex: 'is_qualified', 
      key: 'is_qualified',
      render: (qualified) => qualified 
        ? <Tag color="green" icon={<CheckCircleOutlined />}>合格</Tag>
        : <Tag color="red" icon={<CloseCircleOutlined />}>不合格</Tag>
    },
    { title: '问题描述', dataIndex: 'problem_description', key: 'problem_description' },
    { 
      title: '抽检时间', 
      dataIndex: 'inspect_time', 
      key: 'inspect_time',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {!record.is_qualified && (
            <Button 
              type="link" 
              icon={<MessageOutlined />}
              onClick={() => handleComplaint(record)}
            >
              申诉
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>抽检结果</Title>
      
      <div style={{ marginBottom: 16, color: '#666' }}>
        <strong>注意：</strong>此页面显示所有抽检不合格记录，可进行申诉处理
      </div>

      <Table
        columns={columns}
        dataSource={abnormalInspections}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="提交申诉"
        open={complaintModalVisible}
        onCancel={() => setComplaintModalVisible(false)}
        onOk={submitComplaint}
        okText="提交申诉"
        cancelText="取消"
      >
        {selectedInspection && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>居民：</strong>{selectedInspection.resident_name}</p>
            <p><strong>抽检ID：</strong>{selectedInspection.id}</p>
            <p><strong>问题描述：</strong>{selectedInspection.problem_description}</p>
          </div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>申诉理由：</label>
          <textarea
            value={complaintReason}
            onChange={(e) => setComplaintReason(e.target.value)}
            placeholder="请详细描述申诉理由..."
            rows={4}
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9' }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default Inspections;
