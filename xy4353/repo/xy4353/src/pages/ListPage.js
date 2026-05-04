import React, { useState } from 'react';
import { Table, Card, Input, Button, Tag, Space, Modal, Form, InputNumber, Select, Popconfirm, message, Row, Col, Statistic } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { usePhotoScan, REPAIR_STATUS, REPAIR_STATUS_LABELS } from '../context/PhotoScanContext';
import DataService from '../services/DataService';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

function ListPage() {
  const { state, addRecord, updateRecord, deleteRecord } = usePhotoScan();
  const [searchText, setSearchText] = useState('');
  const [filterBoxId, setFilterBoxId] = useState('');
  const [filterRepairStatus, setFilterRepairStatus] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  const boxIdOptions = [...new Set(state.records.map(r => r.boxId).filter(Boolean)];

  const filteredRecords = state.records.filter(record => {
    const matchSearch = !searchText || 
      record.boxId?.toLowerCase().includes(searchText.toLowerCase()) ||
      record.frameNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
      record.scanFile?.toLowerCase().includes(searchText.toLowerCase()) ||
      record.responsiblePerson?.toLowerCase().includes(searchText.toLowerCase());
    
    const matchBoxId = !filterBoxId || record.boxId === filterBoxId;
    const matchRepairStatus = !filterRepairStatus || record.repairStatus === filterRepairStatus;
    
    return matchSearch && matchBoxId && matchRepairStatus;
  });

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      scanResolution: record.scanResolution || undefined
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    deleteRecord(id);
    message.success('记录已删除');
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingRecord) {
        updateRecord({ ...editingRecord, ...values });
        message.success('记录已更新');
      } else {
        addRecord(values);
        message.success('记录已添加');
      }
      setIsModalOpen(false);
    });
  };

  const getRepairStatusTag = (status) => {
    const colorMap = {
      [REPAIR_STATUS.NOT_REPAIRED]: 'default',
      [REPAIR_STATUS.IN_PROGRESS]: 'processing',
      [REPAIR_STATUS.REPAIRED]: 'success'
    };
    return (
      <Tag color={colorMap[status] || 'default'}>
        {REPAIR_STATUS_LABELS[status] || status}
      </Tag>
    );
  };

  const getResolutionTag = (resolution) => {
    if (!resolution || resolution === 0) {
      return <Tag color="default">未知</Tag>;
    }
    if (resolution < state.settings.minResolution) {
      return <Tag color="error">{resolution} DPI</Tag>;
    }
    return <Tag color="success">{resolution} DPI</Tag>;
  };

  const columns = [
    {
      title: '底片盒',
      dataIndex: 'boxId',
      key: 'boxId',
      width: 100,
      fixed: 'left',
      render: (text) => <strong>{text || '-'}</strong>
    },
    {
      title: '张号',
      dataIndex: 'frameNumber',
      key: 'frameNumber',
      width: 80
    },
    {
      title: '扫描文件',
      dataIndex: 'scanFile',
      key: 'scanFile',
      width: 200,
      ellipsis: true
    },
    {
      title: '分辨率',
      dataIndex: 'scanResolution',
      key: 'scanResolution',
      width: 120,
      render: (text) => getResolutionTag(text)
    },
    {
      title: '修复状态',
      dataIndex: 'repairStatus',
      key: 'repairStatus',
      width: 100,
      render: (text) => getRepairStatusTag(text)
    },
    {
      title: '修复备注',
      dataIndex: 'repairNotes',
      key: 'repairNotes',
      width: 150,
      ellipsis: true
    },
    {
      title: '交付图',
      dataIndex: 'deliveryFile',
      key: 'deliveryFile',
      width: 150,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '责任人',
      dataIndex: 'responsiblePerson',
      key: 'responsiblePerson',
      width: 100
    },
    {
      title: '复核状态',
      dataIndex: 'reviewed',
      key: 'reviewed',
      width: 100,
      render: (reviewed, record) => {
        if (!reviewed) {
          return <Tag color="warning">未复核</Tag>;
        }
        return record.reviewStatus === 'pass' 
          ? <Tag color="success">通过</Tag>
          : <Tag color="error">有问题</Tag>;
      }
    },
    {
      title: '更新时间',
      dataIndex: 'updatedTime',
      key: 'updatedTime',
      width: 160
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />} 
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const stats = {
    total: state.records.length,
    notRepaired: state.records.filter(r => r.repairStatus === REPAIR_STATUS.NOT_REPAIRED).length,
    inProgress: state.records.filter(r => r.repairStatus === REPAIR_STATUS.IN_PROGRESS).length,
    repaired: state.records.filter(r => r.repairStatus === REPAIR_STATUS.REPAIRED).length,
    reviewed: state.records.filter(r => r.reviewed).length
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}>
            <Statistic title="总记录数" value={stats.total} suffix="条" />
          </Col>
          <Col span={4}>
            <Statistic title="未修复" value={stats.notRepaired} valueStyle={{ color: '#999' }} />
          </Col>
          <Col span={4}>
            <Statistic title="修复中" value={stats.inProgress} valueStyle={{ color: '#1890ff' }} />
          </Col>
          <Col span={4}>
            <Statistic title="已修复" value={stats.repaired} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={4}>
            <Statistic title="已复核" value={stats.reviewed} />
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加记录
            </Button>
          </Col>
        </Row>
      </Card>

      <Card 
        size="small"
        title={
          <Space>
            <span>记录列表</span>
            <Tag color="blue">{filteredRecords.length} 条记录</Tag>
          </Space>
        }
        extra={
          <Space>
            <Search
              placeholder="搜索盒号、张号、文件、责任人"
              allowClear
              enterButton={<SearchOutlined />}
              style={{ width: 300 }}
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select
              placeholder="筛选底片盒"
              allowClear
              style={{ width: 120 }}
              value={filterBoxId || undefined}
              onChange={setFilterBoxId}
            >
              {boxIdOptions.map(boxId => (
                <Option key={boxId} value={boxId}>{boxId}</Option>
              ))}
            </Select>
            <Select
              placeholder="筛选修复状态"
              allowClear
              style={{ width: 120 }}
              value={filterRepairStatus || undefined}
              onChange={setFilterRepairStatus}
            >
              <Option value={REPAIR_STATUS.NOT_REPAIRED}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.NOT_REPAIRED]}</Option>
              <Option value={REPAIR_STATUS.IN_PROGRESS}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.IN_PROGRESS]}</Option>
              <Option value={REPAIR_STATUS.REPAIRED}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.REPAIRED]}</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => {
              setSearchText('');
              setFilterBoxId('');
              setFilterRepairStatus('');
            }}>
              重置
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          scroll={{ x: 1400 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            defaultPageSize: 20
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑记录' : '添加记录'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            repairStatus: REPAIR_STATUS.NOT_REPAIRED
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="底片盒号"
                name="boxId"
                rules={[{ required: true, message: '请输入底片盒号' }]}
              >
                <Input placeholder="如: A001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="张号"
                name="frameNumber"
                rules={[{ required: true, message: '请输入张号' }]}
              >
                <Input placeholder="如: 1, 001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                label="扫描文件名"
                name="scanFile"
              >
                <Input placeholder="如: A001_001.tif" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="分辨率 (DPI)"
                name="scanResolution"
              >
                <InputNumber min={0} max={1200} style={{ width: '100%' }} placeholder="如: 300" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="修复状态"
                name="repairStatus"
              >
                <Select>
                  <Option value={REPAIR_STATUS.NOT_REPAIRED}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.NOT_REPAIRED]}</Option>
                  <Option value={REPAIR_STATUS.IN_PROGRESS}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.IN_PROGRESS]}</Option>
                  <Option value={REPAIR_STATUS.REPAIRED}>{REPAIR_STATUS_LABELS[REPAIR_STATUS.REPAIRED]}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="责任人"
                name="responsiblePerson"
              >
                <Input placeholder="如: 张三" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="交付文件名"
                name="deliveryFile"
              >
                <Input placeholder="如: A001_001.jpg" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="修复备注"
            name="repairNotes"
          >
            <TextArea rows={3} placeholder="记录修复过程中的问题、处理方式等备注信息" />
          </Form.Item>
          <Form.Item
            label="备注"
            name="remarks"
          >
            <TextArea rows={2} placeholder="其他备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ListPage;
