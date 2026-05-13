import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Modal, Input, Select, message } from 'antd';
import {
  WarningOutlined,
  BlockOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { TextArea } = Input;
const { Option } = Select;

function Dashboard() {
  const [stats, setStats] = useState({});
  const [exceptions, setExceptions] = useState([]);
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [selectedException, setSelectedException] = useState(null);
  const [handleForm, setHandleForm] = useState({
    handler: '',
    handleResult: '',
    returnStatus: 'handled'
  });

  useEffect(() => {
    loadStats();
    loadExceptions();
  }, []);

  const loadStats = async () => {
    try {
      const res = await axios.get('/api/dashboard/stats');
      setStats(res.data);
    } catch (err) {
      message.error('加载统计数据失败');
    }
  };

  const loadExceptions = async () => {
    try {
      const res = await axios.get('/api/dashboard/exceptions');
      setExceptions(res.data);
    } catch (err) {
      message.error('加载异常列表失败');
    }
  };

  const handleException = (record) => {
    setSelectedException(record);
    setHandleModalVisible(true);
  };

  const submitHandle = async () => {
    try {
      await axios.put(`/api/refunds/${selectedException.id}/handle`, {
        ...handleForm,
        operator: '管理员'
      });
      message.success('处理成功');
      setHandleModalVisible(false);
      loadExceptions();
      loadStats();
    } catch (err) {
      message.error('处理失败');
    }
  };

  const exceptionColumns = [
    { title: '退款单号', dataIndex: 'refund_no', key: 'refund_no' },
    { title: '会员号', dataIndex: 'member_no', key: 'member_no' },
    { title: '会员姓名', dataIndex: 'member_name', key: 'member_name' },
    { title: '门店', dataIndex: 'store_name', key: 'store_name' },
    { title: '券号', dataIndex: 'coupon_no', key: 'coupon_no' },
    { title: '退款金额', dataIndex: 'refund_amount', key: 'refund_amount' },
    { title: '异常类型', dataIndex: 'exception_type', key: 'exception_type',
      render: (type) => {
        const typeMap = {
          'coupon_expired': '券已过期',
          'suspicious_activity': '疑似刷单',
          'system_error': '系统错误'
        };
        return <Tag color="orange">{typeMap[type] || type}</Tag>;
      }
    },
    { title: '异常说明', dataIndex: 'exception_note', key: 'exception_note' },
    { title: '退款时间', dataIndex: 'refund_time', key: 'refund_time',
      render: (time) => moment(time).format('YYYY-MM-DD HH:mm')
    },
    { title: '状态', dataIndex: 'return_status', key: 'return_status',
      render: (status) => {
        const statusMap = {
          'pending': { color: 'default', text: '待处理' },
          'exception': { color: 'red', text: '异常' },
          'handling': { color: 'orange', text: '处理中' },
          'handled': { color: 'green', text: '已处理' },
          'success': { color: 'green', text: '成功' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    { title: '操作', key: 'action',
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => handleException(record)}>
          处理
        </Button>
      )
    }
  ];

  return (
    <div>
      <h2>异常看板</h2>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="待处理异常"
              value={stats.pendingExceptions || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="拦截核销"
              value={stats.blockedVerifications || 0}
              prefix={<BlockOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日退款"
              value={stats.todayRefunds || 0}
              prefix={<RollbackOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日核销"
              value={stats.todayVerifications || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="会员总数"
              value={stats.totalMembers || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="可用券数"
              value={stats.availableCoupons || 0}
              prefix={<GiftOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="异常退款列表">
        <Table
          columns={exceptionColumns}
          dataSource={exceptions}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="处理异常"
        visible={handleModalVisible}
        onOk={submitHandle}
        onCancel={() => setHandleModalVisible(false)}
        width={600}
      >
        {selectedException && (
          <div>
            <p><strong>退款单号：</strong>{selectedException.refund_no}</p>
            <p><strong>会员：</strong>{selectedException.member_name} ({selectedException.member_no})</p>
            <p><strong>异常类型：</strong>{selectedException.exception_type}</p>
            <p><strong>异常说明：</strong>{selectedException.exception_note}</p>
            
            <div style={{ marginTop: 16 }}>
              <label>处理人：</label>
              <Input
                value={handleForm.handler}
                onChange={(e) => setHandleForm({ ...handleForm, handler: e.target.value })}
                placeholder="请输入处理人姓名"
                style={{ marginTop: 8 }}
              />
            </div>
            
            <div style={{ marginTop: 16 }}>
              <label>处理结果：</label>
              <TextArea
                rows={4}
                value={handleForm.handleResult}
                onChange={(e) => setHandleForm({ ...handleForm, handleResult: e.target.value })}
                placeholder="请输入处理结果说明"
                style={{ marginTop: 8 }}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label>状态设置：</label>
              <Select
                value={handleForm.returnStatus}
                onChange={(value) => setHandleForm({ ...handleForm, returnStatus: value })}
                style={{ width: '100%', marginTop: 8 }}
              >
                <Option value="handling">处理中</Option>
                <Option value="handled">已处理</Option>
                <Option value="success">已解决</Option>
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Dashboard;
