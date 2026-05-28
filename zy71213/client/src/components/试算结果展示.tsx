import React from 'react';
import { Card, Row, Col, Descriptions, Tag, Button, Space } from 'antd';
import { FilePdfOutlined, SaveOutlined } from '@ant-design/icons';
import { 试算结果 as 试算结果类型 } from '../types';
import 边界提示面板 from './边界提示面板';

interface Props {
  结果: 试算结果类型 | null;
  onExportPDF: () => void;
  onSaveScheme: () => void;
}

const 试算结果展示: React.FC<Props> = ({ 结果, onExportPDF, onSaveScheme }) => {
  if (!结果) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          请填写完所有信息后点击"开始试算"按钮
        </div>
      </Card>
    );
  }

  const 获取严重程度颜色 = (数量: number) => {
    if (数量 === 0) return 'green';
    if (数量 < 3) return 'orange';
    return 'red';
  };

  return (
    <div>
      <Card
        title="养老金试算结果"
        extra={
          <Space>
            <Button icon={<SaveOutlined />} onClick={onSaveScheme}>
              保存方案
            </Button>
            <Button type="primary" icon={<FilePdfOutlined />} onClick={onExportPDF}>
              导出PDF
            </Button>
          </Space>
        }
      >
        <Row gutter={[24, 24]}>
          <Col span={24}>
            <Card title="基本信息" size="small">
              <Descriptions column={3} size="small">
                <Descriptions.Item label="姓名">{结果.参保人信息.姓名}</Descriptions.Item>
                <Descriptions.Item label="身份证号">{结果.参保人信息.身份证号}</Descriptions.Item>
                <Descriptions.Item label="最终领取地">{结果.领取地信息.最终领取地}</Descriptions.Item>
                <Descriptions.Item label="法定退休年龄">{结果.年龄校验.法定退休年龄}岁</Descriptions.Item>
                <Descriptions.Item label="实际退休年龄">{结果.年龄校验.实际退休年龄}岁</Descriptions.Item>
                <Descriptions.Item label="计发基数">¥{结果.领取地信息.计发基数?.toLocaleString()}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={24}>
            <Card title="缴费明细" size="small">
              <Descriptions column={4} size="small">
                <Descriptions.Item label="累计缴费年限">
                  <Tag color="blue">{结果.缴费明细.累计缴费年限}年</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="实际缴费年限">{结果.缴费明细.实际缴费年限}年</Descriptions.Item>
                <Descriptions.Item label="视同缴费年限">{结果.缴费明细.视同缴费年限}年</Descriptions.Item>
                <Descriptions.Item label="实际缴费月数">{结果.缴费明细.实际缴费月数}月</Descriptions.Item>
                <Descriptions.Item label="平均缴费指数" span={4}>
                  <Tag color="purple">{结果.缴费明细.平均缴费指数}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={24}>
            <Card title="账户信息" size="small">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="个人账户储存额">
                  <span style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
                    ¥{parseFloat(结果.账户信息.个人账户储存额).toLocaleString()}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="计发月数">{结果.账户信息.计发月数}个月</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={24}>
            <Card 
              title={
                <span>
                  养老金构成
                  <Tag color={获取严重程度颜色(结果.边界提示?.length || 0)} style={{ marginLeft: 12 }}>
                    {结果.边界提示?.length || 0} 条提示
                  </Tag>
                </span>
              } 
              size="small"
            >
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ padding: 16, background: '#f0f5ff', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>每月领取总额</div>
                    <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff' }}>
                      ¥{parseFloat(结果.养老金构成.每月领取总额).toLocaleString()}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="基础养老金">
                      ¥{parseFloat(结果.养老金构成.基础养老金).toLocaleString()}/月
                    </Descriptions.Item>
                    <Descriptions.Item label="个人账户养老金">
                      ¥{parseFloat(结果.养老金构成.个人账户养老金).toLocaleString()}/月
                    </Descriptions.Item>
                    <Descriptions.Item label="过渡性养老金">
                      ¥{parseFloat(结果.养老金构成.过渡性养老金).toLocaleString()}/月
                    </Descriptions.Item>
                    <Descriptions.Item label="过渡性调节金">
                      ¥{parseFloat(结果.养老金构成.过渡性调节金).toLocaleString()}/月
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Row style={{ marginTop: 24 }}>
          <Col span={24}>
            <边界提示面板 边界提示列表={结果.边界提示 || []} />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default 试算结果展示;
