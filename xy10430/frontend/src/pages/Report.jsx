import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Space } from 'antd';
import { 
  FileTextOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  DollarOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { claimApi } from '../services/api';
import moment from 'moment';

function Report() {
  const [stats, setStats] = useState({});
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, claimsRes] = await Promise.all([
        claimApi.getStats(),
        claimApi.list({ page: 1, pageSize: 100 })
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (claimsRes.success) setClaims(claimsRes.data);
    } catch (error) {
      console.error('加载报表数据失败:', error);
    }
  };

  const getStatusPieOption = () => {
    const statusCounts = {
      '待处理': 0,
      '已批准': 0,
      '已驳回': 0,
      '已赔付': 0
    };

    claims.forEach(claim => {
      if (claim.status === 'draft' || claim.status === 'pending_review') {
        statusCounts['待处理']++;
      } else if (claim.status === 'approved') {
        statusCounts['已批准']++;
      } else if (claim.status === 'rejected') {
        statusCounts['已驳回']++;
      } else if (claim.status === 'paid') {
        statusCounts['已赔付']++;
      }
    });

    return {
      tooltip: {
        trigger: 'item'
      },
      legend: {
        bottom: '5%',
        left: 'center'
      },
      series: [
        {
          name: '索赔状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}: {c} ({d}%)'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          data: Object.entries(statusCounts).map(([name, value]) => ({
            value,
            name
          }))
        }
      ]
    };
  };

  const getFlagPieOption = () => {
    let duplicateCount = 0;
    let exemptCount = 0;
    let limitCount = 0;
    let normalCount = 0;

    claims.forEach(claim => {
      if (claim.isDuplicate) duplicateCount++;
      else if (claim.isExemptClaim) exemptCount++;
      else if (claim.exceedsLimit) limitCount++;
      else normalCount++;
    });

    return {
      tooltip: {
        trigger: 'item'
      },
      legend: {
        bottom: '5%',
        left: 'center'
      },
      series: [
        {
          name: '风险标记',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}: {c}'
          },
          data: [
            { value: normalCount, name: '正常', itemStyle: { color: '#52c41a' } },
            { value: duplicateCount, name: '重复索赔', itemStyle: { color: '#ff4d4f' } },
            { value: exemptCount, name: '签收免责', itemStyle: { color: '#faad14' } },
            { value: limitCount, name: '金额超限', itemStyle: { color: '#722ed1' } }
          ]
        }
      ]
    };
  };

  const columns = [
    {
      title: '索赔单号',
      dataIndex: 'claimNo',
      key: 'claimNo'
    },
    {
      title: '运单号',
      dataIndex: ['shipment', 'shipmentNo'],
      key: 'shipmentNo'
    },
    {
      title: '货物类型',
      dataIndex: ['shipment', 'cargoType', 'name'],
      key: 'cargoType'
    },
    {
      title: '索赔金额',
      dataIndex: 'claimAmount',
      key: 'claimAmount',
      render: (val) => `¥${val?.toLocaleString() || 0}`
    },
    {
      title: '批准金额',
      dataIndex: 'approvedAmount',
      key: 'approvedAmount',
      render: (val) => val ? `¥${val.toLocaleString()}` : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          'draft': <Tag color="default">草稿</Tag>,
          'pending_review': <Tag color="orange">待审批</Tag>,
          'approved': <Tag color="green">已批准</Tag>,
          'rejected': <Tag color="red">已驳回</Tag>,
          'paid': <Tag color="blue">已赔付</Tag>,
          'closed': <Tag color="gray">已关闭</Tag>
        };
        return statusMap[status] || status;
      }
    },
    {
      title: '风险标记',
      key: 'flags',
      render: (_, record) => {
        const flags = [];
        if (record.isDuplicate) flags.push(<Tag key="dup" color="red">重复</Tag>);
        if (record.isExemptClaim) flags.push(<Tag key="exempt" color="orange">免责</Tag>);
        if (record.exceedsLimit) flags.push(<Tag key="limit" color="purple">超限</Tag>);
        return flags.length > 0 ? <Space size={[4, 4]}>{flags}</Space> : '-';
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val) => moment(val).format('YYYY-MM-DD HH:mm')
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总索赔数"
              value={stats.totalClaims || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pendingClaims || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已批准"
              value={stats.approvedClaims || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已驳回"
              value={stats.rejectedClaims || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="总索赔金额"
              value={stats.totalClaimAmount || 0}
              prefix={<DollarOutlined />}
              precision={2}
              formatter={(value) => `¥${value?.toLocaleString() || 0}`}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已赔付金额"
              value={stats.totalApprovedAmount || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              precision={2}
              formatter={(value) => `¥${value?.toLocaleString() || 0}`}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="索赔状态分布">
            <ReactECharts option={getStatusPieOption()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="风险标记分布">
            <ReactECharts option={getFlagPieOption()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Card title="索赔明细" style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={claims}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
}

export default Report;
