import React, { useState } from 'react';
import {
  Card,
  Button,
  Typography,
  message,
  Table,
  Tag,
  Space,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  FolderOpenOutlined,
  CalendarOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { useApp } from '../store/AppContext';
import { SceneSchedule, CostumeItem } from '../../shared/types';

const { Title, Text, Paragraph } = Typography;

const ImportPanel: React.FC = () => {
  const {
    scenes,
    costumes,
    washRecords,
    alterationRecords,
    photos,
    importScenesCsv,
    importCostumesCsv,
    importRecordsJson,
    importPhotosDirectory,
  } = useApp();

  const [isImporting, setIsImporting] = useState<string | null>(null);

  const handleImportScenes = async () => {
    try {
      setIsImporting('scenes');
      const filePath = await window.api.selectFile([
        { name: 'CSV 文件', extensions: ['csv'] },
        { name: '所有文件', extensions: ['*'] },
      ]);

      if (!filePath) return;

      await importScenesCsv(filePath);
      message.success(`场次数据导入成功`);
    } catch (error) {
      message.error('导入失败');
    } finally {
      setIsImporting(null);
    }
  };

  const handleImportCostumes = async () => {
    try {
      setIsImporting('costumes');
      const filePath = await window.api.selectFile([
        { name: 'CSV 文件', extensions: ['csv'] },
        { name: '所有文件', extensions: ['*'] },
      ]);

      if (!filePath) return;

      await importCostumesCsv(filePath);
      message.success(`服装数据导入成功`);
    } catch (error) {
      message.error('导入失败');
    } finally {
      setIsImporting(null);
    }
  };

  const handleImportRecords = async () => {
    try {
      setIsImporting('records');
      const filePath = await window.api.selectFile([
        { name: 'JSON 文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] },
      ]);

      if (!filePath) return;

      await importRecordsJson(filePath);
      message.success(`记录数据导入成功`);
    } catch (error) {
      message.error('导入失败');
    } finally {
      setIsImporting(null);
    }
  };

  const handleImportPhotos = async () => {
    try {
      setIsImporting('photos');
      const dirPath = await window.api.selectDirectory();

      if (!dirPath) return;

      await importPhotosDirectory(dirPath);
      message.success(`照片目录导入成功`);
    } catch (error) {
      message.error('导入失败');
    } finally {
      setIsImporting(null);
    }
  };

  const sceneColumns = [
    {
      title: '场次号',
      dataIndex: 'sceneNumber',
      key: 'sceneNumber',
      width: 100,
    },
    {
      title: '场次名称',
      dataIndex: 'sceneName',
      key: 'sceneName',
    },
    {
      title: '拍摄日期',
      dataIndex: 'shootDate',
      key: 'shootDate',
      width: 120,
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: '角色',
      dataIndex: 'characters',
      key: 'characters',
      render: (chars: string[]) => (
        <Space>
          {chars.map((c, i) => (
            <Tag key={i} size="small">
              {c}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '日夜',
      dataIndex: 'dayNight',
      key: 'dayNight',
      width: 80,
    },
  ];

  const costumeColumns = [
    {
      title: '条码',
      dataIndex: 'barcode',
      key: 'barcode',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'character',
      key: 'character',
      width: 100,
    },
    {
      title: '服装名称',
      dataIndex: 'itemName',
      key: 'itemName',
    },
    {
      title: '尺码',
      dataIndex: 'size',
      key: 'size',
      width: 80,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 80,
    },
    {
      title: '适用场次',
      dataIndex: 'scenes',
      key: 'scenes',
      render: (s: string[]) => s.join(', '),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          available: { text: '可用', color: 'success' },
          in_wash: { text: '清洗中', color: 'processing' },
          in_alteration: { text: '改衣中', color: 'warning' },
          checked_out: { text: '已借出', color: 'default' },
          lost: { text: '丢失', color: 'error' },
        };
        const info = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
  ];

  return (
    <div>
      <Card className="panel-card">
        <Title level={4}>数据导入</Title>
        <Paragraph type="secondary">
          导入以下类型的数据以进行风险分析。支持 CSV（场次通告、服装条码）、JSON（清洗/改衣记录）和照片目录。
        </Paragraph>

        <Divider />

        <div className="import-section">
          <div className="import-section-title">
            <Space>
              <CalendarOutlined />
              <span>场次通告 CSV</span>
              {scenes.length > 0 && <Tag color="blue">已导入 {scenes.length} 条</Tag>}
            </Space>
          </div>
          <div className="import-section-description">
            支持列名：场次号/sceneNumber/scene_number, 场次名称/sceneName, 拍摄日期/shootDate,
            地点/location, 涉及角色/characters（用逗号分隔）, 日夜/dayNight, 天气/weather
          </div>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleImportScenes}
            loading={isImporting === 'scenes'}
          >
            导入场次通告
          </Button>
        </div>

        <div className="import-section">
          <div className="import-section-title">
            <Space>
              <ShoppingOutlined />
              <span>服装条码扫描表 CSV</span>
              {costumes.length > 0 && <Tag color="green">已导入 {costumes.length} 条</Tag>}
            </Space>
          </div>
          <div className="import-section-description">
            支持列名：条码/barcode, 角色/character, 服装名称/itemName, 尺码/size, 颜色/color,
            适用场次/scenes（用逗号分隔）, 状态/status
          </div>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleImportCostumes}
            loading={isImporting === 'costumes'}
          >
            导入服装条码
          </Button>
        </div>

        <div className="import-section">
          <div className="import-section-title">
            <Space>
              <FileTextOutlined />
              <span>清洗/改衣记录 JSON</span>
              {(washRecords.length > 0 || alterationRecords.length > 0) && (
                <Tag color="purple">
                  已导入 {washRecords.length + alterationRecords.length} 条
                </Tag>
              )}
            </Space>
          </div>
          <div className="import-section-description">
            JSON 格式，包含 washRecords/wash_records 和 alterationRecords/alteration_records 两个数组。
            字段包括：barcode, washDate/requestDate, expectedReturnDate/expectedCompletion, status 等。
          </div>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleImportRecords}
            loading={isImporting === 'records'}
          >
            导入记录 JSON
          </Button>
        </div>

        <div className="import-section">
          <div className="import-section-title">
            <Space>
              <PictureOutlined />
              <span>参考照片目录</span>
              {photos.length > 0 && <Tag color="cyan">已导入 {photos.length} 张</Tag>}
            </Space>
          </div>
          <div className="import-section-description">
            选择包含服装参考照片的目录。支持文件名解析：S01-张三-WD001.jpg 或 001_张三_WD001.jpg 格式。
          </div>
          <Button
            type="primary"
            icon={<FolderOpenOutlined />}
            onClick={handleImportPhotos}
            loading={isImporting === 'photos'}
          >
            导入照片目录
          </Button>
        </div>
      </Card>

      {scenes.length > 0 && (
        <Card className="panel-card" style={{ marginTop: 16 }}>
          <Title level={5}>已导入的场次数据</Title>
          <Table
            dataSource={scenes}
            columns={sceneColumns}
            rowKey="id"
            size="small"
            scroll={{ x: 800 }}
            pagination={{ pageSize: 5 }}
            className="data-table"
          />
        </Card>
      )}

      {costumes.length > 0 && (
        <Card className="panel-card" style={{ marginTop: 16 }}>
          <Title level={5}>已导入的服装数据</Title>
          <Table
            dataSource={costumes}
            columns={costumeColumns}
            rowKey="id"
            size="small"
            scroll={{ x: 900 }}
            pagination={{ pageSize: 5 }}
            className="data-table"
          />
        </Card>
      )}
    </div>
  );
};

export default ImportPanel;
