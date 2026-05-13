import React from 'react';
import { Table, Button, Tag, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import moment from 'moment';

function MeetingList({ meetings, onSelectMeeting }) {
  const columns = [
    {
      title: '会议名称',
      dataIndex: 'title',
      key: 'title',
      width: 250
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => moment(date).format('MM-DD')
    },
    {
      title: '时间',
      key: 'time',
      width: 150,
      render: (_, record) => `${record.startTime} - ${record.endTime}`
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
      width: 150
    },
    {
      title: '组织者',
      dataIndex: 'organizer',
      key: 'organizer',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colorMap = {
          draft: 'default',
          scheduled: 'blue',
          ongoing: 'green',
          completed: 'gray',
          reviewed: 'purple'
        };
        const textMap = {
          draft: '草稿',
          scheduled: '已排期',
          ongoing: '进行中',
          completed: '已完成',
          reviewed: '已复核'
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => onSelectMeeting(record)}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>会议日程</h2>
      </div>
      <Table 
        columns={columns} 
        dataSource={meetings} 
        rowKey="id"
        pagination={false}
      />
    </div>
  );
}

export default MeetingList;