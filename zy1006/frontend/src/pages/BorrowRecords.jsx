import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  InputNumber
} from 'antd';
import {
  ReloadOutlined,
  UndoOutlined,
  FileTextOutlined,
  WarningOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { api, SampleStatusMap, BorrowStatusMap } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

function BorrowRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isReturnModalVisible, setIsReturnModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [returnForm] = Form.useForm();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (borrowerName) params.borrowerName = borrowerName;
      
      const data = await api.getBorrowRecords(params);
      setRecords(data);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const showReturnModal = (record) => {
    setSelectedRecord(record);
    returnForm.resetFields();
    returnForm.setFieldsValue({
      actualReturnDate: dayjs()
    });
    setIsReturnModalVisible(true);
  };

  const handleReturnOk = async () => {
    try {
      const values = await returnForm.validateFields();
      await api.returnBorrowRecord(selectedRecord.id, {
        actualReturnDate: values.actualReturnDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        damageNote: values.damageNote || ''
      });
      message.success('归还操作成功');
      setIsReturnModalVisible(false);
      fetchRecords();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message);
    }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      await api.exportBorrowRecords(params);
      message.success('导出成功');
    } catch (error) {
      message.error(error.message);
    }
  };

  const columns = [
    {
      title: '样品信息',
      dataIndex: 'sample',
      key: 'sample',
      render: (sample) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{sample?.name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>编号: {sample?.code}</div>
        </div>
      ),
    },
    {
      title: '借用人',
      dataIndex: 'borrowerName',
      key: 'borrowerName',
    },
    {
      title: '联系方式',
      dataIndex: 'borrowerContact',
      key: 'borrowerContact',
      render: (text) => text || '-',
    },
    {
      title: '借用日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '预计归还日期',
      dataIndex: 'expectedReturnDate',
      key: 'expectedReturnDate',
      render: (date, record) => {
        const isOverdue = record.status === 'OVERDUE' || 
          (record.status === 'BORROWED' && dayjs().isAfter(dayjs(date)));
        return (
          <span style={{ color: isOverdue ? '#ff4d4f' : 'inherit' }}>
            {dayjs(date).format('YYYY-MM-DD')}
            {isOverdue && record.status !== 'RETURNED' && (
              <Tag color="error" style={{ marginLeft: 8 }}>已逾期</Tag>
            )}
          </span>
        );
      },
    },
    {
      title: '实际归还日期',
      dataIndex: 'actualReturnDate',
      key: 'actualReturnDate',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: '借用中', value: 'BORROWED' },
        { text: '已归还', value: 'RETURNED' },
        { text: '已逾期', value: 'OVERDUE' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const statusInfo = BorrowStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
      },
    },
    {
      title: '损坏/缺件说明',
      dataIndex: 'damageNote',
      key: 'damageNote',
      render: (text) => text ? (
        <span style={{ color: '#ff4d4f' }}>{text}</span>
      ) : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          {(record.status === 'BORROWED' || record.status === 'OVERDUE') && (
            <Button
              type="primary"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => showReturnModal(record)}
            >
              归还
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const borrowedCount = records.filter(r => r.status === 'BORROWED').length;
  const overdueCount = records.filter(r => r.status === 'OVERDUE').length;
  const returnedCount = records.filter(r => r.status === 'RETURNED').length;
  const totalCount = records.length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, marginBottom: 16 }}>借用记录</h2>
        
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总记录数"
                value={totalCount}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="借用中"
                value={borrowedCount}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已逾期"
                value={overdueCount}
                valueStyle={{ color: '#cf1322' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已归还"
                value={returnedCount}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Input
              placeholder="搜索借用人姓名"
              allowClear
              style={{ width: 200 }}
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              onPressEnter={() => fetchRecords()}
            />
            <Select
              placeholder="按状态筛选"
              allowClear
              style={{ width: 150 }}
              value={statusFilter || undefined}
              onChange={(value) => {
                setStatusFilter(value);
                setTimeout(() => fetchRecords(), 100);
              }}
            >
              <Option value="BORROWED">借用中</Option>
              <Option value="RETURNED">已归还</Option>
              <Option value="OVERDUE">已逾期</Option>
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              value={dateRange}
              onChange={setDateRange}
              style={{ width: 300 }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchRecords}>
              刷新
            </Button>
          </Space>
          <Button type="primary" onClick={handleExport}>
            导出 CSV
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title="归还样品"
        open={isReturnModalVisible}
        onOk={handleReturnOk}
        onCancel={() => setIsReturnModalVisible(false)}
        okText="确认归还"
        cancelText="取消"
      >
        {selectedRecord && (
          <div style={{ marginBottom: 20 }}>
            <Card size="small" title="借用信息">
              <p><strong>样品：</strong>{selectedRecord.sample?.name}（{selectedRecord.sample?.code}）</p>
              <p><strong>借用人：</strong>{selectedRecord.borrowerName}</p>
              <p><strong>借用日期：</strong>{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD')}</p>
              <p><strong>预计归还日期：</strong>{dayjs(selectedRecord.expectedReturnDate).format('YYYY-MM-DD')}</p>
              {dayjs().isAfter(dayjs(selectedRecord.expectedReturnDate)) && (
                <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  ⚠️ 已逾期 {dayjs().diff(dayjs(selectedRecord.expectedReturnDate), 'day')} 天
                </p>
              )}
            </Card>
          </div>
        )}
        <Form
          form={returnForm}
          layout="vertical"
        >
          <Form.Item
            name="actualReturnDate"
            label="实际归还日期"
            rules={[{ required: true, message: '请选择归还日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="请选择实际归还日期"
            />
          </Form.Item>
          <Form.Item
            name="damageNote"
            label="损坏/缺件说明"
            help="如有损坏或缺件请填写，填写后样品状态将标记为「损坏」"
          >
            <TextArea
              rows={4}
              placeholder="请填写损坏或缺件情况，如：镜头有划痕、缺少电池等。若无损坏请留空。"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BorrowRecords;
