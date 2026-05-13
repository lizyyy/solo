import React, { useState, useEffect } from 'react';
import {
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  message,
  Popover
} from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusMap = {
  sampled: { text: '已采样', color: 'blue' },
  transported: { text: '运输中', color: 'orange' },
  received: { text: '已接收', color: 'green' },
  testing: { text: '检测中', color: 'purple' },
  completed: { text: '已完成', color: 'success' },
  rejected: { text: '已拒收', color: 'red' }
};

const flowTypeMap = {
  sample: '采样',
  transport: '运输',
  receive: '接收',
  test: '检测',
  complete: '完成',
  reject: '拒收'
};

function SampleList() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({});
  const [detailModal, setDetailModal] = useState(false);
  const [currentSample, setCurrentSample] = useState(null);
  const [flowModal, setFlowModal] = useState(false);
  const [samplingPoints, setSamplingPoints] = useState([]);
  const [sampleBottles, setSampleBottles] = useState([]);
  const [form] = Form.useForm();

  const fetchSamples = async (params = {}) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/samples', {
        params: { ...filters, ...params, page: pagination.page, pageSize: pagination.pageSize }
      });
      setSamples(response.data.data);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (error) {
      message.error('获取样品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSamplingPoints = async () => {
    const response = await axios.get('/api/sampling-points');
    setSamplingPoints(response.data.data);
  };

  const fetchSampleBottles = async () => {
    const response = await axios.get('/api/sample-bottles');
    setSampleBottles(response.data.data);
  };

  useEffect(() => {
    fetchSamples();
    fetchSamplingPoints();
    fetchSampleBottles();
  }, [pagination.page, pagination.pageSize]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchSamples({ page: 1 });
  };

  const handleReset = () => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchSamples({ page: 1 });
  };

  const handleViewDetail = async (record) => {
    try {
      const response = await axios.get(`/api/samples/${record.id}`);
      setCurrentSample(response.data.data);
      setDetailModal(true);
    } catch (error) {
      message.error('获取样品详情失败');
    }
  };

  const handleAddFlow = () => {
    form.resetFields();
    setFlowModal(true);
  };

  const handleSubmitFlow = async (values) => {
    try {
      await axios.post('/api/flows', {
        ...values,
        sampleRecordId: currentSample.id,
        operationTime: values.operationTime.toISOString()
      });
      message.success('流转记录添加成功');
      setFlowModal(false);
      handleViewDetail(currentSample);
      fetchSamples();
    } catch (error) {
      message.error(error.response?.data?.message || '添加流转记录失败');
    }
  };

  const renderFlowTimeline = (flows) => {
    return flows.map((flow, index) => (
      <div key={flow.id} style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Tag color={flow.isTimeout ? 'red' : 'blue'}>
            {flowTypeMap[flow.flowType]}
          </Tag>
          <span style={{ color: '#666' }}>
            {dayjs(flow.operationTime).format('YYYY-MM-DD HH:mm')}
          </span>
        </div>
        <div style={{ fontSize: 14 }}>
          <span>操作人: {flow.operator}</span>
          {flow.fromLocation && <span style={{ marginLeft: 16 }}>从: {flow.fromLocation}</span>}
          {flow.toLocation && <span style={{ marginLeft: 16 }}>到: {flow.toLocation}</span>}
        </div>
        {flow.isTimeout && (
          <div style={{ color: 'red', marginTop: 8, fontSize: 12 }}>
            ⚠️ {flow.timeoutReason}
          </div>
        )}
        {flow.remarks && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            备注: {flow.remarks}
          </div>
        )}
      </div>
    ));
  };

  const columns = [
    {
      title: '样品编号',
      dataIndex: 'sampleCode',
      key: 'sampleCode',
      width: 180,
      render: (text) => <a>{text}</a>
    },
    {
      title: '采样点',
      dataIndex: 'SamplingPoint',
      key: 'samplingPoint',
      width: 150,
      render: (sp) => sp?.name || '-'
    },
    {
      title: '样瓶编号',
      dataIndex: 'SampleBottle',
      key: 'bottleNumber',
      width: 120,
      render: (b) => b?.bottleNumber || '-'
    },
    {
      title: '保存剂',
      dataIndex: 'preservative',
      key: 'preservative',
      width: 100
    },
    {
      title: '采样时间',
      dataIndex: 'samplingTime',
      key: 'samplingTime',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '采样人',
      dataIndex: 'sampler',
      key: 'sampler',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const info = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space wrap>
            <Input
              placeholder="搜索样品编号/采样人"
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
              value={filters.keyword}
              onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
              onPressEnter={handleSearch}
            />
            <Select
              placeholder="状态筛选"
              style={{ width: 150 }}
              allowClear
              value={filters.status}
              onChange={val => setFilters(prev => ({ ...prev, status: val }))}
            >
              {Object.entries(statusMap).map(([key, val]) => (
                <Option key={key} value={key}>{val.text}</Option>
              ))}
            </Select>
            <Select
              placeholder="采样点筛选"
              style={{ width: 180 }}
              allowClear
              value={filters.samplingPointId}
              onChange={val => setFilters(prev => ({ ...prev, samplingPointId: val }))}
            >
              {samplingPoints.map(sp => (
                <Option key={sp.id} value={sp.id}>{sp.name}</Option>
              ))}
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              value={filters.startDate ? [dayjs(filters.startDate), dayjs(filters.endDate)] : undefined}
              onChange={(dates) => {
                if (dates) {
                  setFilters(prev => ({
                    ...prev,
                    startDate: dates[0].format('YYYY-MM-DD'),
                    endDate: dates[1].format('YYYY-MM-DD')
                  }));
                } else {
                  setFilters(prev => {
                    const { startDate, endDate, ...rest } = prev;
                    return rest;
                  });
                }
              }}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={samples}
        loading={loading}
        rowKey="id"
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: total => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination({ page, pageSize, total: pagination.total })
        }}
      />

      <Modal
        title="样品详情"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        width={900}
        footer={[
          <Button key="flow" type="primary" onClick={handleAddFlow}>
            添加流转记录
          </Button>,
          <Button key="close" onClick={() => setDetailModal(false)}>
            关闭
          </Button>
        ]}
      >
        {currentSample && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h4>基本信息</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>样品编号: {currentSample.sampleCode}</div>
                <div>采样点: {currentSample.SamplingPoint?.name}</div>
                <div>样瓶: {currentSample.SampleBottle?.bottleNumber}</div>
                <div>保存剂: {currentSample.preservative}</div>
                <div>采样时间: {dayjs(currentSample.samplingTime).format('YYYY-MM-DD HH:mm')}</div>
                <div>采样人: {currentSample.sampler}</div>
                <div>温度: {currentSample.temperature}℃</div>
                <div>天气: {currentSample.weather}</div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4>检测项目</h4>
              <Table
                size="small"
                dataSource={currentSample.TestItems}
                columns={[
                  { title: '项目名称', dataIndex: 'itemName', key: 'itemName' },
                  { title: '标准值', dataIndex: 'expectedValue', key: 'expectedValue' },
                  { title: '检测结果', dataIndex: 'actualValue', key: 'actualValue' },
                  { title: '检测人', dataIndex: 'tester', key: 'tester' },
                  {
                    title: '异常',
                    dataIndex: 'isAbnormal',
                    key: 'isAbnormal',
                    render: val => val ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>
                  }
                ]}
                pagination={false}
                rowKey="id"
              />
            </div>

            <div>
              <h4>流转记录</h4>
              {renderFlowTimeline(currentSample.FlowRecords || [])}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="添加流转记录"
        open={flowModal}
        onCancel={() => setFlowModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="flowType"
            label="流转类型"
            rules={[{ required: true }]}
          >
            <Select>
              {Object.entries(flowTypeMap).map(([key, val]) => (
                <Option key={key} value={key}>{val}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="operator"
            label="操作人"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="operationTime"
            label="操作时间"
            rules={[{ required: true }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="fromLocation" label="来源地点">
            <Input />
          </Form.Item>
          <Form.Item name="toLocation" label="目标地点">
            <Input />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SampleList;
