import React, { useState } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Avatar, Button, Table, Space, Modal } from 'antd';
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { FollowupTask, Member } from '../types';

const Dashboard: React.FC = () => {
  const { getDashboardStats, getTodayPendingTasks, getHighRiskMembers, followupTasks, members, updateFollowupTask } = useStore();
  const stats = getDashboardStats();
  const todayPendingTasks = getTodayPendingTasks();
  const highRiskMembers = getHighRiskMembers();
  const [selectedTask, setSelectedTask] = useState<FollowupTask | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);

  const handleStartTask = (task: FollowupTask) => {
    updateFollowupTask(task.id, { status: 'in_progress' });
  };

  const handleCompleteTask = (task: FollowupTask) => {
    setSelectedTask(task);
    setTaskModalVisible(true);
  };

  const handleTaskModalOk = () => {
    if (selectedTask) {
      updateFollowupTask(selectedTask.id, {
        status: 'completed',
        actualDate: dayjs().format('YYYY-MM-DD'),
        completionStatus: 'full',
      });
    }
    setTaskModalVisible(false);
    setSelectedTask(null);
  };

  const exportToExcel = () => {
    const data = followupTasks.map((task) => ({
      '回访日期': task.scheduledDate,
      '回访时间': task.scheduledTime || '',
      '会员姓名': task.memberName,
      '联系电话': task.memberPhone,
      '回访类型': task.typeName,
      '优先级': task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低',
      '状态': task.status === 'pending' ? '待处理' : task.status === 'in_progress' ? '进行中' : task.status === 'completed' ? '已完成' : task.status === 'cancelled' ? '已取消' : '已关闭',
      '负责人': task.assignedTo,
      '相关药品': task.relatedMedicines.join(', '),
      '续方意向': task.refillIntention === 'yes' ? '是' : task.refillIntention === 'no' ? '否' : '待确认',
      '完成情况': task.completionStatus === 'full' ? '全部完成' : task.completionStatus === 'partial' ? '部分完成' : '未完成',
      '异常指标': task.hasAbnormalIndicator ? '有' : '无',
      '禁忌提醒': task.hasContraindicationReminder ? '已提醒' : '未提醒',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '回访任务');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `回访任务_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const taskColumns = [
    {
      title: '时间',
      dataIndex: 'scheduledTime',
      key: 'scheduledTime',
      width: 100,
      render: (time: string) => time || '--',
    },
    {
      title: '会员',
      dataIndex: 'memberName',
      key: 'memberName',
      width: 100,
    },
    {
      title: '类型',
      dataIndex: 'typeName',
      key: 'typeName',
      width: 100,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'green'}>
          {priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}
        </Tag>
      ),
    },
    {
      title: '异常',
      key: 'abnormal',
      width: 80,
      render: (_: unknown, record: FollowupTask) => (
        <>
          {record.hasAbnormalIndicator && <Tag color="red">指标异常</Tag>}
        </>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: FollowupTask) => (
        <Space>
          <Button size="small" icon={<PhoneOutlined />} onClick={() => handleStartTask(record)}>
            开始回访
          </Button>
          <Button size="small" type="primary" onClick={() => handleCompleteTask(record)}>
            完成
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>工作台</h2>
        <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>
          导出数据
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="今日待回访"
              value={stats.todayPendingTasks}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="今日已完成"
              value={stats.todayCompletedTasks}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="高风险会员"
              value={stats.highRiskMembers}
              prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="待处理异常"
              value={stats.abnormalIndicatorsPending}
              prefix={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="今日待回访任务" extra={<span style={{ color: '#999' }}>共 {todayPendingTasks.length} 项</span>}>
            <Table
              dataSource={todayPendingTasks}
              columns={taskColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="高风险会员" style={{ marginBottom: 16 }}>
            <List
              dataSource={highRiskMembers}
              renderItem={(member: Member) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#ff4d4f' }} />}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {member.name}
                        <Tag color="red">高风险</Tag>
                      </div>
                    }
                    description={
                      <div>
                        <div>{member.phone}</div>
                        <div>{member.chronicDiseases.join('、')}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
          <Card title="本周统计">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="本周任务数" value={stats.tasksThisWeek} />
              </Col>
              <Col span={12}>
                <Statistic title="已完成" value={stats.completedThisWeek} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Modal
        title="完成回访任务"
        open={taskModalVisible}
        onOk={handleTaskModalOk}
        onCancel={() => setTaskModalVisible(false)}
      >
        <p>确定要完成该回访任务吗？</p>
        {selectedTask && (
          <div>
            <p>会员：{selectedTask.memberName}</p>
            <p>类型：{selectedTask.typeName}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
