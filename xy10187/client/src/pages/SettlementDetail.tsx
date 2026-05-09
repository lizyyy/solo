import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Table,
  Tag,
  Button,
  Space,
  Spin,
  Statistic,
  Row,
  Col,
  message,
} from 'antd';
import { ArrowLeftOutlined, ExportOutlined } from '@ant-design/icons';
import { SettlementDetail as SettlementDetailType } from '../types';
import { getSettlementDetail, exportSettlement } from '../services/api';
import { formatMoney, formatDateTime, getSettlementStatusTag } from '../utils';

const SettlementDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SettlementDetailType | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getSettlementDetail(id!);
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      message.error('加载结算单详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    exportSettlement(id!);
    message.success('正在导出Excel...');
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  if (!data) return null;

  const statusTag = getSettlementStatusTag(data.status);

  const columns = [
    {
      title: '小票编号',
      dataIndex: 'receipt_no',
      key: 'receipt_no',
    },
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      key: 'employee_name',
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '消费日期',
      dataIndex: 'consumption_date',
      key: 'consumption_date',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: formatMoney,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/settlements')}>
            返回列表
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出Excel
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card>
            <Statistic
              title="结算总金额"
              value={data.total_amount}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#1890ff', fontSize: '28px' }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color={statusTag.color}>{statusTag.text}</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="基本信息">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="结算月份">{data.settlement_month}</Descriptions.Item>
              <Descriptions.Item label="商户名称">{data.merchant_name}</Descriptions.Item>
              <Descriptions.Item label="联系人">{data.contact_person}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{data.phone}</Descriptions.Item>
              <Descriptions.Item label="商户地址" span={2}>
                {data.address}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(data.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTime(data.updated_at)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title={`结算明细 (共 ${data.items.length} 张)`} style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={data.items}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>
    </div>
  );
};

export default SettlementDetail;
