import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import {
  ShoppingCartOutlined,
  GiftOutlined,
  CloseCircleOutlined,
  SplitCellsOutlined,
  RefundOutlined,
  UserOutlined
} from '@ant-design/icons';
const StatsCard = ({ stats }) => {
  return (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={4}>
        <Card>
          <Statistic
            title="总订单数"
            value={stats.total_orders || 0}
            prefix={<ShoppingCartOutlined />}
            valueStyle={{ color: '#3f8600' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="获赠订单"
            value={stats.gift_qualified_orders || 0}
            prefix={<GiftOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="未达标订单"
            value={stats.gift_not_qualified_orders || 0}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: '#cf1322' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="拆单数"
            value={stats.split_orders || 0}
            prefix={<SplitCellsOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="退款数"
            value={stats.refunds || 0}
            prefix={<RefundOutlined />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="人工补赠"
            value={stats.manual_gifts || 0}
            prefix={<UserOutlined />}
            valueStyle={{ color: '#eb2f96' }}
          />
        </Card>
      </Col>
    </Row>
  );
};
export default StatsCard;
