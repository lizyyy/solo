import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Select, Modal, message, Space } from 'antd';
import { EditOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;

function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ level: '', keyword: '' });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editLevel, setEditLevel] = useState('');

  useEffect(() => {
    loadMembers();
  }, [filters]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.level) params.level = filters.level;
      if (filters.keyword) params.keyword = filters.keyword;
      const res = await axios.get('/api/members', { params });
      setMembers(res.data);
    } catch (err) {
      message.error('加载会员列表失败');
    }
    setLoading(false);
  };

  const editMember = (record) => {
    setEditingMember(record);
    setEditLevel(record.level);
    setEditModalVisible(true);
  };

  const saveMember = async () => {
    try {
      await axios.put(`/api/members/${editingMember.id}`, {
        level: editLevel,
        operator: '管理员'
      });
      message.success('修改成功');
      setEditModalVisible(false);
      loadMembers();
    } catch (err) {
      message.error('修改失败');
    }
  };

  const levelColorMap = {
    normal: 'default',
    silver: 'blue',
    gold: 'orange',
    platinum: 'purple',
    diamond: 'red'
  };

  const levelTextMap = {
    normal: '普通',
    silver: '银卡',
    gold: '金卡',
    platinum: '铂金',
    diamond: '钻石'
  };

  const columns = [
    { title: '会员号', dataIndex: 'member_no', key: 'member_no' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '手机号', dataIndex: 'phone', key: 'phone' },
    { title: '等级', dataIndex: 'level', key: 'level',
      render: (level) => (
        <Tag color={levelColorMap[level]}>{levelTextMap[level] || level}</Tag>
      )
    },
    { title: '积分', dataIndex: 'points', key: 'points' },
    { title: '修改前等级', dataIndex: 'level_before', key: 'level_before',
      render: (level) => level ? (
        <Tag color={levelColorMap[level]}>{levelTextMap[level] || level}</Tag>
      ) : '-'
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (time) => moment(time).format('YYYY-MM-DD HH:mm')
    },
    { title: '操作', key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => editMember(record)}>
          编辑等级
        </Button>
      )
    }
  ];

  return (
    <div>
      <h2>会员管理</h2>
      
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择会员等级"
            style={{ width: 150 }}
            allowClear
            value={filters.level}
            onChange={(value) => setFilters({ ...filters, level: value })}
          >
            <Option value="normal">普通</Option>
            <Option value="silver">银卡</Option>
            <Option value="gold">金卡</Option>
            <Option value="platinum">铂金</Option>
            <Option value="diamond">钻石</Option>
          </Select>
          
          <Input
            placeholder="搜索会员号/姓名/手机号"
            style={{ width: 250 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            prefix={<SearchOutlined />}
          />
          
          <Button type="primary" onClick={loadMembers}>
            搜索
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={members}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="编辑会员等级"
        visible={editModalVisible}
        onOk={saveMember}
        onCancel={() => setEditModalVisible(false)}
      >
        {editingMember && (
          <div>
            <p><strong>会员号：</strong>{editingMember.member_no}</p>
            <p><strong>姓名：</strong>{editingMember.name}</p>
            <p><strong>当前等级：</strong>{levelTextMap[editingMember.level]}</p>
            
            <div style={{ marginTop: 16 }}>
              <label>新等级：</label>
              <Select
                value={editLevel}
                onChange={setEditLevel}
                style={{ width: '100%', marginTop: 8 }}
              >
                <Option value="normal">普通</Option>
                <Option value="silver">银卡</Option>
                <Option value="gold">金卡</Option>
                <Option value="platinum">铂金</Option>
                <Option value="diamond">钻石</Option>
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Members;
