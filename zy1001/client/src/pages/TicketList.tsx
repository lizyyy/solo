import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Card,
  Row,
  Col,
  Modal,
  Upload,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  ExportOutlined,
  ImportOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Ticket, TicketStatus, TicketPriority, STATUS_LABELS, PRIORITY_LABELS, FilterParams, Metadata } from '../types';
import { ticketApi } from '../services/api';

const { Search } = Input;

const STATUS_COLOR_MAP: Record<TicketStatus, string> = {
  [TicketStatus.PENDING]: 'orange',
  [TicketStatus.IN_PROGRESS]: 'processing',
  [TicketStatus.PENDING_CONFIRMATION]: 'blue',
  [TicketStatus.CLOSED]: 'default',
};

const PRIORITY_COLOR_MAP: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'default',
  [TicketPriority.MEDIUM]: 'blue',
  [TicketPriority.HIGH]: 'orange',
  [TicketPriority.URGENT]: 'red',
};

const TicketList: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [filters, setFilters] = useState<FilterParams>({});
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const fetchMetadata = useCallback(async () => {
    try {
      const data = await ticketApi.getMetadata();
      setMetadata(data);
    } catch (error) {
      console.error('获取元数据失败:', error);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ticketApi.getTickets(filters);
      setTickets(data);
    } catch (error) {
      message.error('获取工单列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMetadata();
    fetchTickets();
  }, [fetchMetadata, fetchTickets]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, keyword: value || undefined }));
  };

  const handleFilterChange = (key: keyof FilterParams, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleReset = () => {
    setFilters({});
  };

  const handleExport = async () => {
    try {
      await ticketApi.exportCSV(filters);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
      console.error(error);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      message.warning('请先选择文件');
      return;
    }

    try {
      const result = await ticketApi.importCSV(importFile);
      if (result.success > 0) {
        message.success(`成功导入 ${result.success} 条工单`);
        fetchTickets();
        fetchMetadata();
      }
      if (result.failed > 0) {
        Modal.warning({
          title: '导入失败记录',
          content: (
            <div>
              <p>失败 {result.failed} 条:</p>
              <ul style={{ maxHeight: 300, overflow: 'auto' }}>
                {result.errors.map((error, index) => (
                  <li key={index}>
                    第 {error.row} 行: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ),
        });
      }
      setImportModalVisible(false);
      setImportFile(null);
    } catch (error: any) {
      message.error(error.message || '导入失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Ticket) => (
        <a onClick={() => navigate(`/ticket/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TicketStatus) => (
        <Tag color={STATUS_COLOR_MAP[status]}>
          {STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: TicketPriority) => (
        <Tag color={PRIORITY_COLOR_MAP[priority]}>
          {PRIORITY_LABELS[priority]}
        </Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: string) => {
        if (!tags) return '-';
        return tags.split(',').map((tag, index) => (
          <Tag key={index} style={{ margin: 2 }}>{tag.trim()}</Tag>
        ));
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Ticket) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/ticket/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Search
              placeholder="搜索标题、描述、客户名称"
              allowClear
              onSearch={handleSearch}
              style={{ maxWidth: 400 }}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={6}>
            <Select
              placeholder="选择负责人"
              allowClear
              style={{ width: '100%' }}
              value={filters.assignee}
              onChange={(value) => handleFilterChange('assignee', value)}
              options={metadata?.assignees?.map(a => ({ label: a, value: a })) || []}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="选择状态"
              allowClear
              style={{ width: '100%' }}
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              options={metadata?.statuses || []}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="选择优先级"
              allowClear
              style={{ width: '100%' }}
              value={filters.priority}
              onChange={(value) => handleFilterChange('priority', value)}
              options={metadata?.priorities || []}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="选择标签"
              allowClear
              style={{ width: '100%' }}
              value={filters.tags}
              onChange={(value) => handleFilterChange('tags', value)}
              options={metadata?.tags?.map(t => ({ label: t, value: t })) || []}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create')}>
            新建工单
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出CSV
          </Button>
          <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
            导入CSV
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={tickets}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="导入CSV"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setImportModalVisible(false);
          setImportFile(null);
        }}
        okText="导入"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#666', marginBottom: 8 }}>
            CSV文件格式要求：
          </p>
          <ul style={{ color: '#666', fontSize: 12 }}>
            <li>必需列：标题、客户名称、客户联系方式、问题描述</li>
            <li>可选列：优先级、负责人、标签</li>
            <li>优先级可选值：低/中/高/紧急</li>
          </ul>
        </div>
        <Upload
          beforeUpload={(file) => {
            const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
            if (!isCSV) {
              message.error('只能上传CSV文件');
              return false;
            }
            setImportFile(file);
            return false;
          }}
          fileList={importFile ? [{ uid: '1', name: importFile.name, status: 'done' as const }] : []}
        >
          <Button>选择文件</Button>
        </Upload>
      </Modal>
    </div>
  );
};

export default TicketList;
