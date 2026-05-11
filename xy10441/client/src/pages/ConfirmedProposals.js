import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Typography,
  Space,
  Alert,
  Descriptions,
  Modal,
  Empty,
  Input,
  Select
} from 'antd';
import {
  FileDoneOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  SearchOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Option } = Select;

const ConfirmedProposals = () => {
  const [proposals, setProposals] = useState([]);
  const [filteredProposals, setFilteredProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    api.get('/proposals/confirmed-proposals')
      .then(res => {
        setProposals(res.data);
        setFilteredProposals(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let filtered = proposals;
    
    if (searchText) {
      filtered = filtered.filter(p => 
        p.project_name?.includes(searchText) ||
        p.customer_name?.includes(searchText) ||
        p.version_name?.includes(searchText)
      );
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => {
        const categories = (p.quotation_items || []).map(item => item.category);
        return categories.includes(categoryFilter);
      });
    }
    
    setFilteredProposals(filtered);
  }, [searchText, categoryFilter, proposals]);

  const exportToExcel = () => {
    const exportData = filteredProposals.map(p => ({
      '客户名称': p.customer_name,
      '项目名称': p.project_name,
      '版本号': p.version_number,
      '版本名称': p.version_name,
      '报价总额': parseFloat(p.total_amount),
      '折扣金额': parseFloat(p.discount_amount) || 0,
      '最终金额': parseFloat(p.final_amount),
      '客户确认人': p.latest_confirmation?.[0]?.confirmer_name || '',
      '确认方式': p.latest_confirmation?.[0]?.confirmation_method || '',
      '确认日期': p.latest_confirmation?.[0]?.confirmation_date ? dayjs(p.latest_confirmation[0].confirmation_date).format('YYYY-MM-DD') : '',
      '创建人': p.created_by_name,
      '确认时间': p.confirmed_at ? dayjs(p.confirmed_at).format('YYYY-MM-DD HH:mm') : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    const colWidths = [
      { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 30 },
      { wch: 15 }, { wch: 12 }, { wch: 15 },
      { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, '有效方案清单');
    XLSX.writeFile(wb, `有效方案清单_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const columns = [
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      key: 'project_name'
    },
    {
      title: '版本信息',
      key: 'version',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>版本 {record.version_number}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.version_name}</Text>
        </Space>
      )
    },
    {
      title: '报价总额',
      dataIndex: 'final_amount',
      key: 'final_amount',
      render: (amount, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
            ¥{parseFloat(amount).toLocaleString()}
          </Text>
          {parseFloat(record.discount_amount) > 0 && (
            <Text delete type="secondary" style={{ fontSize: 12 }}>
              原价 ¥{parseFloat(record.total_amount).toLocaleString()}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '报价类别',
      key: 'categories',
      render: (_, record) => {
        const categories = [...new Set((record.quotation_items || []).map(item => item.category))];
        return (
          <Space wrap>
            {categories.map((cat, idx) => (
              <Tag key={idx}>{cat}</Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: '客户确认',
      key: 'confirmation',
      render: (_, record) => {
        const conf = record.latest_confirmation?.[0];
        if (!conf) return '-';
        return (
          <Space direction="vertical" size={0}>
            <Tag color="green" icon={<CheckCircleOutlined />}>
              {conf.confirmer_name}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {conf.confirmation_method} · {dayjs(conf.confirmation_date).format('YYYY-MM-DD')}
            </Text>
          </Space>
        );
      }
    },
    {
      title: '创建人',
      dataIndex: 'created_by_name',
      key: 'created_by_name'
    },
    {
      title: '确认时间',
      dataIndex: 'confirmed_at',
      key: 'confirmed_at',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedProposal(record);
            setDetailModalVisible(true);
          }}
        >
          查看详情
        </Button>
      )
    }
  ];

  const totalAmount = filteredProposals.reduce((sum, p) => sum + parseFloat(p.final_amount), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileDoneOutlined style={{ marginRight: 8 }} />
          有效方案清单
          <Tag color="green" style={{ marginLeft: 8 }}>
            共 {filteredProposals.length} 个有效方案
          </Tag>
        </Title>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={exportToExcel}
          disabled={filteredProposals.length === 0}
        >
          导出Excel
        </Button>
      </div>

      {filteredProposals.length > 0 && (
        <Alert
          message={`已确认有效方案总金额：¥${totalAmount.toLocaleString()}`}
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索客户、项目或版本名称"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={setSearchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            placeholder="按类别筛选"
            style={{ width: 150 }}
            value={categoryFilter}
            onChange={setCategoryFilter}
            allowClear
          >
            <Option value="all">全部类别</Option>
            <Option value="软件实施">软件实施</Option>
            <Option value="运维服务">运维服务</Option>
            <Option value="培训服务">培训服务</Option>
            <Option value="技术支持">技术支持</Option>
            <Option value="咨询服务">咨询服务</Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredProposals}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <Empty description="暂无已确认的有效方案" />
          }}
        />
      </Card>

      <Modal
        title="方案详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedProposal && (
          <div>
            <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="客户名称" span={2}>
                <Text strong>{selectedProposal.customer_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="项目名称" span={2}>
                {selectedProposal.project_name}
              </Descriptions.Item>
              <Descriptions.Item label="版本号">
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  {selectedProposal.version_number}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本名称">
                {selectedProposal.version_name}
              </Descriptions.Item>
              <Descriptions.Item label="报价总额">
                <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                  ¥{parseFloat(selectedProposal.final_amount).toLocaleString()}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="折扣">
                {selectedProposal.discount_amount > 0 
                  ? `¥${parseFloat(selectedProposal.discount_amount).toLocaleString()}` 
                  : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {selectedProposal.created_by_name}
              </Descriptions.Item>
              <Descriptions.Item label="确认时间">
                {dayjs(selectedProposal.confirmed_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>报价明细</Title>
            <Table
              columns={[
                { title: '类别', dataIndex: 'category', key: 'category' },
                { title: '项目名称', dataIndex: 'item_name', key: 'item_name' },
                { title: '描述', dataIndex: 'description', key: 'description' },
                { 
                  title: '数量', 
                  dataIndex: 'quantity', 
                  key: 'quantity',
                  render: (v, record) => `${v} ${record.unit}`
                },
                { 
                  title: '单价', 
                  dataIndex: 'unit_price', 
                  key: 'unit_price',
                  render: v => `¥${parseFloat(v).toLocaleString()}`
                },
                { 
                  title: '金额', 
                  dataIndex: 'amount', 
                  key: 'amount',
                  render: v => `¥${parseFloat(v).toLocaleString()}`
                }
              ]}
              dataSource={selectedProposal.quotation_items || []}
              rowKey="id"
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      合计：
                    </Table.Summary.Cell>
                    <Table.Summary.Cell style={{ fontWeight: 'bold', color: '#1890ff' }}>
                      ¥{parseFloat(selectedProposal.total_amount).toLocaleString()}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />

            {selectedProposal.latest_confirmation?.[0] && (
              <>
                <Title level={5} style={{ marginTop: 24 }}>客户确认信息</Title>
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="确认人">
                    {selectedProposal.latest_confirmation[0].confirmer_name}
                  </Descriptions.Item>
                  <Descriptions.Item label="公司">
                    {selectedProposal.latest_confirmation[0].confirmer_company || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="确认方式">
                    {selectedProposal.latest_confirmation[0].confirmation_method}
                  </Descriptions.Item>
                  <Descriptions.Item label="确认日期">
                    {dayjs(selectedProposal.latest_confirmation[0].confirmation_date).format('YYYY-MM-DD')}
                  </Descriptions.Item>
                  <Descriptions.Item label="备注" span={2}>
                    {selectedProposal.latest_confirmation[0].notes || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ConfirmedProposals;
