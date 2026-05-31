import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Checkbox,
  Button,
  Space,
  Table,
  Tag,
  Alert,
  message,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { artworkAPI } from '../utils/api';

const { Title, Paragraph } = Typography;

function ExportPage() {
  const [artworks, setArtworks] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [includeLighting, setIncludeLighting] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtworks();
  }, []);

  const fetchArtworks = async () => {
    setLoading(true);
    try {
      const response = await artworkAPI.getAll();
      setArtworks(response.data);
    } catch (error) {
      message.error('获取作品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要导出的作品');
      return;
    }

    setExporting(true);
    try {
      const params = { include_lighting: includeLighting };
      if (selectedIds.length < artworks.length) {
        params.artwork_ids = selectedIds;
      }

      const response = await artworkAPI.export(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `青年艺术展作品_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedIds,
    onChange: (keys) => setSelectedIds(keys),
  };

  const columns = [
    {
      title: '作品编号',
      dataIndex: 'artwork_id',
      key: 'artwork_id',
      width: 120,
    },
    {
      title: '作品名称',
      dataIndex: 'title',
      key: 'title',
      width: 180,
    },
    {
      title: '艺术家',
      dataIndex: 'artist',
      key: 'artist',
      width: 120,
    },
    {
      title: '尺寸',
      key: 'dimensions',
      width: 150,
      render: (_, record) => (
        <span>
          {record.width} × {record.height} {record.unit}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.needs_confirmation) {
          return <Tag color="orange">待确认</Tag>;
        }
        if (record.status === 'confirmed') {
          return <Tag color="green">已确认</Tag>;
        }
        return <Tag color="blue">待处理</Tag>;
      },
    },
  ];

  const hasUnconfirmed = artworks
    .filter((a) => selectedIds.includes(a.id))
    .some((a) => a.needs_confirmation);

  return (
    <div>
      <Title level={2}>导出数据</Title>

      <Paragraph>
        选择需要导出的作品，系统会生成Excel文件包含作品详细信息。
      </Paragraph>

      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Checkbox
            checked={includeLighting}
            onChange={(e) => setIncludeLighting(e.target.checked)}
          >
            包含灯光方案信息
          </Checkbox>

          {hasUnconfirmed && (
            <Alert
              message="注意"
              description="您选择的作品中包含待确认的作品，这些数据可能存在问题，建议先确认后再导出使用。"
              type="warning"
              showIcon
            />
          )}

          <div>
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                loading={exporting}
                disabled={selectedIds.length === 0}
              >
                导出选中作品 ({selectedIds.length})
              </Button>
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => {
                  setSelectedIds(artworks.map((a) => a.id));
                }}
              >
                全选
              </Button>
              <Button onClick={() => setSelectedIds([])}>取消选择</Button>
            </Space>
          </div>
        </Space>
      </Card>

      <Card title="选择要导出的作品">
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={artworks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default ExportPage;
