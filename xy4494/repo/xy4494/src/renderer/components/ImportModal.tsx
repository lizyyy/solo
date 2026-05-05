import React, { useState } from 'react';
import {
  Modal,
  Button,
  Upload,
  message,
  Table,
  Space,
  Card,
  Statistic,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { ImportData, ItemCategory, ItemStatus } from '../../shared/types';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ open, onClose, onSuccess }) => {
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleFileSelect = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.import.fromFile();
      if (data) {
        setImportData(data);
        message.success('文件解析成功');
      }
    } catch (error) {
      message.error('解析文件失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importData) return;

    try {
      setImporting(true);
      const result = await window.electronAPI.import.applyData(importData);

      if (result.errors.length > 0) {
        message.warning(`成功导入 ${result.success} 条，失败 ${result.errors.length} 条`);
        console.error('Import errors:', result.errors);
      } else {
        message.success(`成功导入 ${result.success} 条记录`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      message.error('导入失败');
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const getCategoryLabel = (category: ItemCategory) => {
    const labels: Record<ItemCategory, string> = {
      [ItemCategory.ELECTRONICS]: '电子设备',
      [ItemCategory.DOCUMENTS]: '证件',
      [ItemCategory.CLOTHING]: '衣物',
      [ItemCategory.BAGS]: '箱包',
      [ItemCategory.VALUABLES]: '贵重物品',
      [ItemCategory.KEYS]: '钥匙',
      [ItemCategory.OTHER]: '其他',
    };
    return labels[category] || category;
  };

  const getStatusLabel = (status: ItemStatus) => {
    const labels: Record<ItemStatus, string> = {
      [ItemStatus.PENDING]: '待处理',
      [ItemStatus.PROCESSING]: '处理中',
      [ItemStatus.APPROVED]: '可归还',
      [ItemStatus.NEED_PROOF]: '需补充证明',
      [ItemStatus.NEED_SUPERVISOR]: '需值班长复核',
      [ItemStatus.RETURNED]: '已归还',
      [ItemStatus.CLOSED]: '已关闭',
    };
    return labels[status] || status;
  };

  const itemColumns = [
    {
      title: '物品编号',
      dataIndex: 'itemCode',
      key: 'itemCode',
      render: (code: string) => code || '自动生成',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '站点',
      dataIndex: 'station',
      key: 'station',
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      render: (category: ItemCategory) => (category ? getCategoryLabel(category) : '-'),
    },
    {
      title: '交件人',
      dataIndex: 'finderName',
      key: 'finderName',
    },
    {
      title: '发现时间',
      dataIndex: 'foundTime',
      key: 'foundTime',
      render: (time: string) => (time ? new Date(time).toLocaleDateString('zh-CN') : '-'),
    },
  ];

  const appointmentColumns = [
    {
      title: '认领人',
      dataIndex: 'claimantName',
      key: 'claimantName',
    },
    {
      title: '联系电话',
      dataIndex: 'claimantContact',
      key: 'claimantContact',
    },
    {
      title: '预约时间',
      dataIndex: 'appointmentTime',
      key: 'appointmentTime',
      render: (time: string) => (time ? new Date(time).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
    },
  ];

  const lockerColumns = [
    {
      title: '保管柜编号',
      dataIndex: 'lockerCode',
      key: 'lockerCode',
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => (action === 'store' ? '存入' : '取出'),
    },
    {
      title: '扫描人',
      dataIndex: 'scannedBy',
      key: 'scannedBy',
    },
    {
      title: '扫描时间',
      dataIndex: 'scannedAt',
      key: 'scannedAt',
      render: (time: string) => (time ? new Date(time).toLocaleString('zh-CN') : '-'),
    },
  ];

  return (
    <Modal
      title="数据导入"
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        importData && (
          <Button key="import" type="primary" loading={importing} onClick={handleImport}>
            确认导入
          </Button>
        ),
      ]}
    >
      {!importData ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '64px', marginBottom: 16 }}>📥</div>
          <h3 style={{ marginBottom: 8 }}>选择要导入的文件</h3>
          <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
            支持 Excel (.xlsx, .xls)、CSV 和 JSON 格式
          </p>
          <Button type="primary" size="large" icon={<UploadOutlined />} onClick={handleFileSelect} loading={loading}>
            选择文件
          </Button>
          <Divider>支持的格式</Divider>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
            <div>
              <FileExcelOutlined style={{ fontSize: 32, color: '#52c41a' }} />
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>Excel</div>
            </div>
            <div>
              <FileTextOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>CSV</div>
            </div>
            <div>
              <DatabaseOutlined style={{ fontSize: 32, color: '#722ed1' }} />
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>JSON</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <Card size="small">
              <Space size={48}>
                <Statistic title="失物记录" value={importData.lostItems.length} prefix={<DatabaseOutlined />} />
                <Statistic title="认领预约" value={importData.claimAppointments.length} prefix={<DatabaseOutlined />} />
                <Statistic title="保管柜记录" value={importData.lockerRecords.length} prefix={<DatabaseOutlined />} />
              </Space>
            </Card>
          </div>

          {importData.lostItems.length > 0 && (
            <>
              <h4 style={{ marginBottom: 12 }}>失物记录 ({importData.lostItems.length} 条)</h4>
              <Table
                dataSource={importData.lostItems}
                columns={itemColumns}
                rowKey={(record, index) => index.toString()}
                size="small"
                pagination={{ pageSize: 5 }}
                scroll={{ x: 800 }}
              />
            </>
          )}

          {importData.claimAppointments.length > 0 && (
            <>
              <h4 style={{ marginBottom: 12, marginTop: 24 }}>认领预约 ({importData.claimAppointments.length} 条)</h4>
              <Table
                dataSource={importData.claimAppointments}
                columns={appointmentColumns}
                rowKey={(record, index) => index.toString()}
                size="small"
                pagination={{ pageSize: 5 }}
              />
            </>
          )}

          {importData.lockerRecords.length > 0 && (
            <>
              <h4 style={{ marginBottom: 12, marginTop: 24 }}>保管柜记录 ({importData.lockerRecords.length} 条)</h4>
              <Table
                dataSource={importData.lockerRecords}
                columns={lockerColumns}
                rowKey={(record, index) => index.toString()}
                size="small"
                pagination={{ pageSize: 5 }}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
};

export default ImportModal;
