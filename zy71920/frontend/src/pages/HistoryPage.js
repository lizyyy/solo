import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Card,
  Typography,
  Select,
  Space,
  Button,
  message,
} from 'antd';
import {
  HistoryOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { artworkAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

function HistoryPage() {
  const [importSessions, setImportSessions] = useState([]);
  const [artworks, setArtworks] = useState([]);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [artworkHistory, setArtworkHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, artworksRes] = await Promise.all([
        artworkAPI.getImportSessions(),
        artworkAPI.getAll(),
      ]);
      setImportSessions(sessionsRes.data);
      setArtworks(artworksRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleArtworkChange = async (artworkId) => {
    setSelectedArtwork(artworkId);
    if (artworkId) {
      try {
        const response = await artworkAPI.getHistory(artworkId);
        setArtworkHistory(response.data);
      } catch {
        setArtworkHistory([]);
      }
    } else {
      setArtworkHistory([]);
    }
  };

  const sessionColumns = [
    {
      title: '导入时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '会话名称',
      dataIndex: 'session_name',
      key: 'session_name',
    },
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '总计',
      dataIndex: 'total_records',
      key: 'total_records',
      width: 80,
    },
    {
      title: '成功',
      dataIndex: 'success_count',
      key: 'success_count',
      width: 80,
      render: (text) => <Tag color="green">{text}</Tag>,
    },
    {
      title: '警告',
      dataIndex: 'warning_count',
      key: 'warning_count',
      width: 80,
      render: (text) => <Tag color="orange">{text}</Tag>,
    },
    {
      title: '错误',
      dataIndex: 'error_count',
      key: 'error_count',
      width: 80,
      render: (text) => <Tag color="red">{text}</Tag>,
    },
  ];

  const historyColumns = [
    {
      title: '版本号',
      dataIndex: 'version_number',
      key: 'version_number',
      width: 80,
    },
    {
      title: '修改字段',
      dataIndex: 'field_cn',
      key: 'field_cn',
      width: 120,
    },
    {
      title: '原值',
      dataIndex: 'old_value',
      key: 'old_value',
      render: (text) => text || <Text type="secondary">（空）</Text>,
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      render: (text) => text || <Text type="secondary">（空）</Text>,
    },
    {
      title: '变动类型',
      key: 'change_type',
      width: 100,
      render: (_, record) => {
        if (!record.old_value) return <Tag color="blue">新增</Tag>;
        if (!record.new_value) return <Tag color="red">删除</Tag>;
        return <Tag color="orange">修改</Tag>;
      },
    },
    {
      title: '修改原因',
      dataIndex: 'change_reason',
      key: 'change_reason',
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <Title level={2}>版本历史</Title>

      <Card
        title={
          <Space>
            <HistoryOutlined />
            导入会话记录
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          columns={sessionColumns}
          dataSource={importSessions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>

      <Card
        title={
          <Space>
            <SwapOutlined />
            作品修改历史
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Text>选择作品查看历史：</Text>
          <Select
            style={{ width: 300 }}
            placeholder="请选择作品"
            value={selectedArtwork}
            onChange={handleArtworkChange}
            showSearch
            optionFilterProp="children"
          >
            {artworks.map((artwork) => (
              <Option key={artwork.id} value={artwork.id}>
                {artwork.artwork_id} - {artwork.title}
              </Option>
            ))}
          </Select>
          <Button onClick={fetchData}>刷新</Button>
        </Space>

        {selectedArtwork ? (
          <Table
            columns={historyColumns}
            dataSource={artworkHistory}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            locale={{
              emptyText: '该作品暂无修改历史',
            }}
          />
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: '#999',
            }}
          >
            请选择一个作品查看其修改历史
          </div>
        )}
      </Card>
    </div>
  );
}

export default HistoryPage;
