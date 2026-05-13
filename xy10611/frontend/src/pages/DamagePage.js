import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Modal, Form, Select, Input, Upload, message, Space, Row, Col } from 'antd';
import { PlusOutlined, UploadOutlined, AuditOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

function DamagePage() {
  const [data, setData] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [compensationModalVisible, setCompensationModalVisible] = useState(false);
  const [selectedDamage, setSelectedDamage] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/damage');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const response = await axios.get('/api/compensation/rules');
      setRules(response.data);
    } catch (error) {
      message.error('获取赔付规则失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchRules();
  }, []);

  const handleCreateDamage = async (values) => {
    try {
      const formData = new FormData();
      Object.keys(values).forEach(key => {
        if (key === 'photo' && values[key] && values[key][0] && values[key][0].originFileObj) {
          formData.append('photo', values[key][0].originFileObj);
        } else if (values[key] !== undefined && values[key] !== null) {
          formData.append(key, values[key]);
        }
      });

      await axios.post('/api/damage', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('破损记录创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleReview = async (values) => {
    try {
      await axios.post(`/api/damage/${selectedDamage.id}/review`, values);
      message.success('审核完成');
      setReviewModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('审核失败');
    }
  };

  const handleCreateCompensation = async (values) => {
    try {
      await axios.post('/api/compensation/records', {
        ...values,
        damage_photo_id: selectedDamage.id
      });
      message.success('赔付记录创建成功');
      setCompensationModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const columns = [
    {
      title: '标签编号',
      dataIndex: 'tag_code',
      key: 'tag_code',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '布草类型',
      dataIndex: 'linen_type',
      key: 'linen_type',
    },
    {
      title: '破损类型',
      dataIndex: 'damage_type',
      key: 'damage_type',
    },
    {
      title: '破损程度',
      dataIndex: 'damage_level',
      key: 'damage_level',
      render: (level) => {
        const colorMap = { '轻微': 'green', '中度': 'orange', '严重': 'red' };
        return <Tag color={colorMap[level]}>{level}</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '上报人',
      dataIndex: 'reported_by',
      key: 'reported_by',
    },
    {
      title: '上报时间',
      dataIndex: 'reported_at',
      key: 'reported_at',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '审核状态',
      dataIndex: 'is_reviewed',
      key: 'is_reviewed',
      render: (reviewed) => reviewed ? 
        <Tag color="green">已审核</Tag> : 
        <Tag color="orange">待审核</Tag>,
    },
    {
      title: '审核结果',
      dataIndex: 'review_result',
      key: 'review_result',
      render: (result) => {
        if (!result) return '-';
        const resultMap = {
          'compensation': '需赔付',
          'no_compensation': '无需赔付'
        };
        return <Tag color={result === 'compensation' ? 'red' : 'green'}>
          {resultMap[result] || result}
        </Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {!record.is_reviewed && (
            <Button 
              type="link" 
              icon={<AuditOutlined />}
              onClick={() => {
                setSelectedDamage(record);
                setReviewModalVisible(true);
              }}
            >
              审核
            </Button>
          )}
          {record.is_reviewed && record.review_result === 'compensation' && (
            <Button 
              type="link" 
              onClick={() => {
                setSelectedDamage(record);
                setCompensationModalVisible(true);
              }}
            >
              创建赔付
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 className="page-title">破损管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          上报破损
        </Button>
      </div>
      
      <div className="card-content">
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <Modal
        title="上报破损"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} onFinish={handleCreateDamage} layout="vertical">
          <Form.Item name="tag_code" label="布草标签编号" rules={[{ required: true }]}>
            <Input placeholder="请输入布草标签编号" />
          </Form.Item>
          <Form.Item name="damage_type" label="破损类型" rules={[{ required: true }]}>
            <Select placeholder="请选择破损类型">
              <Option value="破损">破损</Option>
              <Option value="污渍">污渍</Option>
              <Option value="丢失">丢失</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="damage_level" label="破损程度" rules={[{ required: true }]}>
            <Select placeholder="请选择破损程度">
              <Option value="轻微">轻微</Option>
              <Option value="中度">中度</Option>
              <Option value="严重">严重</Option>
            </Select>
          </Form.Item>
          <Form.Item 
            name="photo" 
            label="破损照片" 
            rules={[{ required: true }]}
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e && e.fileList;
            }}
          >
            <Upload 
              listType="picture" 
              beforeUpload={() => false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>上传照片</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请描述破损情况" />
          </Form.Item>
          <Form.Item name="reported_by" label="上报人" rules={[{ required: true }]}>
            <Input placeholder="请输入上报人" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审核破损"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleReview} layout="vertical">
          <Form.Item name="review_result" label="审核结果" rules={[{ required: true }]}>
            <Select placeholder="请选择审核结果">
              <Option value="compensation">需赔付</Option>
              <Option value="no_compensation">无需赔付</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reviewed_by" label="审核人" rules={[{ required: true }]}>
            <Input placeholder="请输入审核人" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认审核
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建赔付记录"
        open={compensationModalVisible}
        onCancel={() => setCompensationModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCreateCompensation} layout="vertical">
          <Form.Item name="rule_id" label="赔付规则" rules={[{ required: true }]}>
            <Select placeholder="请选择赔付规则">
              {rules.map(rule => (
                <Option key={rule.id} value={rule.id}>
                  {rule.rule_name} - ¥{rule.compensation_amount}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="responsible_party" label="责任方" rules={[{ required: true }]}>
            <Select placeholder="请选择责任方">
              <Option value="洗涤厂">洗涤厂</Option>
              <Option value="酒店">酒店</Option>
              <Option value="客人">客人</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="responsible_person" label="责任人">
            <Input placeholder="请输入责任人" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建赔付
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default DamagePage;