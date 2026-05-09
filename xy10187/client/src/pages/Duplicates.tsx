import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Collapse,
  List,
  Spin,
  message,
  Statistic,
  Row,
  Col,
} from 'antd';
import { EyeOutlined, CopyOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { DuplicateGroup } from '../types';
import { getDuplicates } from '../services/api';
import { formatMoney, formatDate, getReceiptStatusTag } from '../utils';

const Duplicates: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DuplicateGroup[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getDuplicates();
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      message.error('加载重复小票数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  const totalGroups = data.length;
  const totalDuplicates = data.reduce((sum, group) => sum + group.count, 0);

  const columns = [
    {
      title: '小票编号',
      dataIndex: 'receipt_no',
      key: 'receipt_no',
      render: (text: string) => (
        <Space>
          <CopyOutlined style={{ color: '#fa8c16' }} />
          <span style={{ fontWeight: 'bold' }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '商户',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
    },
    {
      title: '重复次数',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => (
        <Tag color="red" style={{ fontSize: '14px', padding: '4px 12px' }}>
          {count} 次
        </Tag>
      ),
    },
    {
      title: '发现时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDate,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DuplicateGroup) => (
        <Space>
          {record.receipts.length > 0 && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/receipts/${record.receipts[0].id}`)}
            >
              查看详情
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: DuplicateGroup) => (
    <Card size="small" title="重复小票详情">
      <List
        dataSource={record.receipts}
        renderItem={(item, index) => {
          const statusTag = getReceiptStatusTag(item.status);
          return (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={index === 0 ? 'green' : 'orange'}>
                      {index === 0 ? '原始小票' : `第 ${index + 1} 次重复`}
                    </Tag>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/receipts/${item.id}`)}
                    >
                      {item.employee_name} - {formatMoney(item.amount)}
                    </Button>
                    <Tag color={statusTag.color}>{statusTag.text}</Tag>
                  </Space>
                }
                description={
                  <Space>
                    <span>部门：{item.employee_department}</span>
                    <span>上传日期：{formatDate(item.upload_date)}</span>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );

  return (
    <div>
      <div className="page-header">
        <h2>重复识别</h2>
        <p>系统自动检测到的重复小票记录，防止重复核销</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={8}>
          <Card className="stats-card">
            <Statistic
              title="重复组别数"
              value={totalGroups}
              prefix={<CopyOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={8}>
          <Card className="stats-card">
            <Statistic
              title="重复小票总数"
              value={totalDuplicates}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={8}>
          <Card className="stats-card">
            <Statistic
              title="涉嫌金额"
              value={data.reduce((sum, group) => {
                return sum + group.receipts.reduce((s, r) => s + r.amount, 0) - 
                       (group.receipts[0]?.amount || 0);
              }, 0)}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="重复小票列表">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 组`,
          }}
          expandable={{
            expandedRowRender,
            defaultExpandAllRows: false,
            rowExpandable: (record) => record.receipts.length > 0,
          }}
          locale={{
            emptyText: '暂无重复小票数据，系统检测正常！',
          }}
        />
      </Card>
    </div>
  );
};

export default Duplicates;
