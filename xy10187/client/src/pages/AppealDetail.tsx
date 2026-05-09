import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Spin,
  Timeline,
  message,
  Row,
  Col,
} from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { getAppealDetail } from '../services/api';
import { formatDateTime, getAppealStatusTag, getAppealTypeTag, getReceiptStatusTag } from '../utils';

const AppealDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getAppealDetail(id!);
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      message.error('加载申诉详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  if (!data) return null;

  const statusTag = getAppealStatusTag(data.status);
  const typeTag = getAppealTypeTag(data.appeal_type);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/appeals')}>
          返回列表
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="申诉信息">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="申诉人">{data.appellant}</Descriptions.Item>
              <Descriptions.Item label="申诉类型">
                <Tag color={typeTag.color}>{typeTag.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申诉状态">
                <Tag color={statusTag.color}>{statusTag.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="员工姓名">{data.employee_name}</Descriptions.Item>
              <Descriptions.Item label="部门">{data.department}</Descriptions.Item>
              <Descriptions.Item label="商户">{data.merchant_name}</Descriptions.Item>
              <Descriptions.Item label="小票编号">{data.receipt_no}</Descriptions.Item>
              <Descriptions.Item label="金额">
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>
                  ¥{data.amount?.toFixed(2)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="申诉原因" span={2}>
                {data.reason}
              </Descriptions.Item>
              <Descriptions.Item label="处理人">{data.handler || '-'}</Descriptions.Item>
              <Descriptions.Item label="处理结果">{data.handle_result || '-'}</Descriptions.Item>
              <Descriptions.Item label="申诉时间">{formatDateTime(data.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTime(data.updated_at)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="小票状态流转">
            <Timeline className="log-timeline">
              {data.receipt_logs?.map((log: any) => {
                const statusTag = getReceiptStatusTag(log.new_status as any);
                return (
                  <Timeline.Item key={log.id}>
                    <div>
                      <Space>
                        <Tag color={statusTag.color}>{statusTag.text}</Tag>
                        <span style={{ color: '#999' }}>操作人：{log.operator}</span>
                      </Space>
                      {log.reason && (
                        <div style={{ marginTop: 4, fontSize: '13px', color: '#666' }}>
                          {log.reason}
                        </div>
                      )}
                      <div style={{ marginTop: 2, fontSize: '12px', color: '#999' }}>
                        {formatDateTime(log.created_at)}
                      </div>
                    </div>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AppealDetail;
