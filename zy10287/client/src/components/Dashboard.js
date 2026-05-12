import React from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, Select } from 'antd';
import { UserOutlined, WarningOutlined, SafetyCertificateOutlined, EnterOutlined } from '@ant-design/icons';

const { Option } = Select;

function Dashboard({ data, onSelectPerson, selectedProject, onProjectChange }) {
  if (!data) return <div>加载中...</div>;

  const noTrainingColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '身份证', dataIndex: 'id_card', key: 'id_card' },
    { title: '外包公司', dataIndex: 'outsourcing_company', key: 'outsourcing_company' },
    { title: '项目', dataIndex: 'project', key: 'project' },
    {
      title: '操作',
      render: (_, record) => (
        <Button type="link" onClick={() => onSelectPerson(record)}>查看详情</Button>
      )
    }
  ];

  const noBadgeReturnColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '工牌号', dataIndex: 'badge_number', key: 'badge_number' },
    { title: '发放日期', dataIndex: 'issue_date', key: 'issue_date' },
    { title: '项目', dataIndex: 'project', key: 'project' },
    {
      title: '操作',
      render: (_, record) => (
        <Button type="link" onClick={() => onSelectPerson(record)}>查看详情</Button>
      )
    }
  ];

  const recentEntriesColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '项目', dataIndex: 'project', key: 'project' },
    { title: '入场日期', dataIndex: 'entry_date', key: 'entry_date' },
    { title: '岗位', dataIndex: 'position', key: 'position' }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总人数"
              value={data.totalPersons}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未培训人员"
              value={data.noTrainingPersons.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未回收工牌"
              value={data.noBadgeReturnPersons.length}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已离场未收工牌"
              value={data.exitedWithBadge.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16, display: 'flex' }}>
        <span>项目筛选：</span>
        <Select 
          style={{ width: 200 }} 
          placeholder="选择项目"
          value={selectedProject || undefined}
          onChange={onProjectChange}
        >
          <Option value="">全部</Option>
          {data.projects.map(project => (
            <Option key={project} value={project}>{project}</Option>
          ))}
        </Select>
      </Space>

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title={
              <Space>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                <span>未培训人员列表</span>
                <Tag color="red">{data.noTrainingPersons.length}人</Tag>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Table
              dataSource={data.noTrainingPersons}
              columns={noTrainingColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#faad14' }} />
                <span>未回收工牌列表</span>
                <Tag color="orange">{data.noBadgeReturnPersons.length}个</Tag>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Table
              dataSource={data.noBadgeReturnPersons}
              columns={noBadgeReturnColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title={
          <Space>
            <EnterOutlined />
            <span>最近入场记录</span>
          </Space>
        }
      >
        <Table
          dataSource={data.recentEntries}
          columns={recentEntriesColumns}
          rowKey={(record, index) => index}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}

export default Dashboard;
