import React, { useState, useMemo } from 'react';
import {
  Card,
  Typography,
  Tabs,
  Upload,
  Button,
  Space,
  Table,
  Tag,
  Alert,
  message,
  InputNumber,
  Input,
  DatePicker,
  Select,
  Modal,
  Form,
} from 'antd';
import {
  ImportOutlined,
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import { useDataStore } from '../../store/dataStore';
import { DataType, PurchaseContract, InventoryLot, FuturesPosition, BasisRecord, ImportResult } from '../../types';
import { parseExcelFile, validateRow, downloadTemplate, ParseResult, generateIdForImport } from '../../utils/excel';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

interface EditableCellProps {
  editing: boolean;
  dataIndex: string;
  title: string;
  inputType: 'text' | 'number' | 'date' | 'select';
  record: any;
  index: number;
  children: React.ReactNode;
  selectOptions?: { value: string; label: string }[];
}

const EditableCell: React.FC<EditableCellProps> = ({
  editing,
  dataIndex,
  title,
  inputType,
  record,
  index,
  children,
  selectOptions,
  ...restProps
}) => {
  const inputNode = useMemo(() => {
    switch (inputType) {
      case 'number':
        return <InputNumber style={{ width: '100%' }} min={0} />;
      case 'date':
        return <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />;
      case 'select':
        return (
          <Select style={{ width: '100%' }}>
            {selectOptions?.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        );
      default:
        return <Input />;
    }
  }, [inputType, selectOptions]);

  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={[
            {
              required: true,
              message: `请输入 ${title}`,
            },
          ]}
        >
          {inputNode}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
};

const ImportCenter: React.FC = () => {
  const {
    contracts,
    lots,
    positions,
    basisRecords,
    setContracts,
    setLots,
    setPositions,
    setBasisRecords,
    addImportResult,
    updateLot,
    updatePosition,
  } = useDataStore();

  const [activeTab, setActiveTab] = useState<DataType>('contracts');
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState<string>('');
  const [editingReason, setEditingReason] = useState('');
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{ record: any; field: string; value: any } | null>(null);
  const [form] = Form.useForm();

  const getDataByType = (type: DataType) => {
    switch (type) {
      case 'contracts':
        return contracts;
      case 'lots':
        return lots;
      case 'positions':
        return positions;
      case 'basis':
        return basisRecords;
      default:
        return [];
    }
  };

  const setDataByType = (type: DataType, data: any[]) => {
    switch (type) {
      case 'contracts':
        setContracts(data as PurchaseContract[]);
        break;
      case 'lots':
        setLots(data as InventoryLot[]);
        break;
      case 'positions':
        setPositions(data as FuturesPosition[]);
        break;
      case 'basis':
        setBasisRecords(data as BasisRecord[]);
        break;
    }
  };

  const handleFileUpload = async (file: File, dataType: DataType): Promise<boolean> => {
    setUploading(true);
    try {
      const result = await parseExcelFile<any>(file, dataType);
      
      if (result.errors.length > 0) {
        Modal.error({
          title: '数据校验错误',
          content: (
            <div>
              <p>共发现 {result.errors.length} 条错误：</p>
              <ul style={{ maxHeight: 300, overflow: 'auto' }}>
                {result.errors.slice(0, 50).map((err, idx) => (
                  <li key={idx} style={{ color: '#d32f2f', marginBottom: 4 }}>
                    {err}
                  </li>
                ))}
                {result.errors.length > 50 && (
                  <li style={{ color: '#666' }}>... 还有 {result.errors.length - 50} 条错误</li>
                )}
              </ul>
            </div>
          ),
        });
      }

      if (result.data.length > 0) {
        const existingData = getDataByType(dataType) as any[];
        const newData = [...existingData, ...result.data];
        setDataByType(dataType, newData);

        const importResult: ImportResult = {
          type: dataType,
          success: result.data.length,
          failed: result.errors.length,
          errors: result.errors,
          warnings: result.warnings,
        };
        addImportResult(importResult);

        const successMsg = `成功导入 ${result.data.length} 条数据`;
        const warnMsg = result.errors.length > 0 ? `，${result.errors.length} 条数据存在错误` : '';
        message.success(successMsg + warnMsg);
      }

      if (result.warnings.length > 0) {
        Modal.warning({
          title: '导入警告',
          content: (
            <ul>
              {result.warnings.map((warn, idx) => (
                <li key={idx}>{warn}</li>
              ))}
            </ul>
          ),
        });
      }

      setUploading(false);
      return true;
    } catch (error) {
      setUploading(false);
      message.error(`导入失败：${(error as Error).message}`);
      return false;
    }
  };

  const createUploadProps = (dataType: DataType): UploadProps => ({
    name: 'file',
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    customRequest: async ({ file }) => {
      await handleFileUpload(file as File, dataType);
    },
    beforeUpload: (file) => {
      const isExcel =
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls');
      if (!isExcel) {
        message.error('只能上传 Excel 或 CSV 文件!');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB!');
        return false;
      }
      return true;
    },
  });

  const isEditing = (record: any) => record.id === editingKey;

  const edit = (record: any) => {
    form.setFieldsValue({ ...record });
    setEditingKey(record.id);
  };

  const cancel = () => {
    setEditingKey('');
    form.resetFields();
  };

  const save = async (dataType: DataType) => {
    try {
      const row = await form.validateFields();
      
      if (!editingReason.trim()) {
        setReasonModalVisible(true);
        setPendingEdit({ record: row, field: '', value: row });
        return;
      }

      const data = getDataByType(dataType) as any[];
      const newData = [...data];
      const index = newData.findIndex((item) => item.id === editingKey);
      
      if (index > -1) {
        const oldRecord = newData[index];
        
        if (dataType === 'lots') {
          updateLot(editingKey, row, editingReason || '人工修改导入数据');
        } else if (dataType === 'positions') {
          updatePosition(editingKey, row, editingReason || '人工修改导入数据');
        } else {
          Object.entries(row).forEach(([field, value]) => {
            if (JSON.stringify(oldRecord[field]) !== JSON.stringify(value)) {
              useDataStore.getState().addAuditLog({
                entityType: dataType,
                entityId: editingKey,
                fieldName: field,
                oldValue: oldRecord[field],
                newValue: value,
                reason: editingReason || '人工修改导入数据',
                operator: '当前用户',
              });
            }
          });
          const item = { ...newData[index], ...row };
          newData.splice(index, 1, item);
          setDataByType(dataType, newData);
        }
        
        message.success('修改已保存');
        setEditingKey('');
        setEditingReason('');
        form.resetFields();
      }
    } catch (errInfo) {
      console.log('Validate Failed:', errInfo);
    }
  };

  const confirmEditWithReason = (dataType: DataType) => {
    if (!editingReason.trim()) {
      message.error('请填写修改理由');
      return;
    }
    
    save(dataType);
    setReasonModalVisible(false);
    setPendingEdit(null);
  };

  const deleteRow = (dataType: DataType, id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条记录吗？删除操作会记录在审计日志中。',
      onOk: () => {
        Modal.confirm({
          title: '删除理由',
          content: (
            <div>
              <p>请填写删除理由（用于审计追溯）：</p>
              <TextArea
                rows={3}
                value={editingReason}
                onChange={(e) => setEditingReason(e.target.value)}
                placeholder="请输入删除理由..."
              />
            </div>
          ),
          onOk: () => {
            const data = getDataByType(dataType) as any[];
            const record = data.find((item) => item.id === id);
            
            if (record) {
              useDataStore.getState().addAuditLog({
                entityType: dataType,
                entityId: id,
                fieldName: 'deleted',
                oldValue: record,
                newValue: null,
                reason: editingReason || '删除记录',
                operator: '当前用户',
              });
              
              const newData = data.filter((item) => item.id !== id);
              setDataByType(dataType, newData);
              message.success('删除成功');
            }
            setEditingReason('');
          },
        });
      },
    });
  };

  const addRow = (dataType: DataType) => {
    const newRecord: any = {
      id: generateIdForImport(),
    };

    switch (dataType) {
      case 'contracts':
        newRecord.contractNo = '';
        newRecord.supplier = '';
        newRecord.copperGrade = 'A级阴极铜';
        newRecord.quantity = 0;
        newRecord.price = 0;
        newRecord.deliveryDate = '';
        newRecord.status = 'pending';
        newRecord.createdAt = new Date().toISOString();
        break;
      case 'lots':
        newRecord.lotNo = '';
        newRecord.contractId = '';
        newRecord.quantity = 0;
        newRecord.warehouse = '默认仓库';
        newRecord.receiptDate = dayjs().format('YYYY-MM-DD');
        newRecord.matchStatus = 'unmatched';
        break;
      case 'positions':
        newRecord.contractMonth = '';
        newRecord.direction = 'short';
        newRecord.quantity = 0;
        newRecord.openPrice = 0;
        newRecord.currentPrice = 0;
        newRecord.openDate = dayjs().format('YYYY-MM-DD');
        newRecord.deliveryMonth = '';
        newRecord.isRollover = false;
        newRecord.status = 'open';
        break;
      case 'basis':
        newRecord.basisDate = dayjs().format('YYYY-MM-DD');
        newRecord.spotPrice = 0;
        newRecord.futuresPrice = 0;
        newRecord.basisValue = 0;
        newRecord.isLocked = false;
        break;
    }

    const data = getDataByType(dataType) as any[];
    const newData = [newRecord, ...data];
    setDataByType(dataType, newData);
    edit(newRecord);
  };

  const getColumns = (dataType: DataType) => {
    const baseColumns: any[] = [];

    switch (dataType) {
      case 'contracts':
        baseColumns.push(
          {
            title: '合同编号',
            dataIndex: 'contractNo',
            key: 'contractNo',
            editable: true,
            inputType: 'text',
          },
          {
            title: '供应商',
            dataIndex: 'supplier',
            key: 'supplier',
            editable: true,
            inputType: 'text',
          },
          {
            title: '铜品种',
            dataIndex: 'copperGrade',
            key: 'copperGrade',
            editable: true,
            inputType: 'text',
          },
          {
            title: '数量(吨)',
            dataIndex: 'quantity',
            key: 'quantity',
            editable: true,
            inputType: 'number',
          },
          {
            title: '单价(元/吨)',
            dataIndex: 'price',
            key: 'price',
            editable: true,
            inputType: 'number',
          },
          {
            title: '交货日期',
            dataIndex: 'deliveryDate',
            key: 'deliveryDate',
            editable: true,
            inputType: 'date',
          },
          {
            title: '到货日期',
            dataIndex: 'arrivalDate',
            key: 'arrivalDate',
            editable: true,
            inputType: 'date',
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            editable: true,
            inputType: 'select',
            selectOptions: [
              { value: 'pending', label: '待交货' },
              { value: 'in_transit', label: '运输中' },
              { value: 'received', label: '已到货' },
            ],
            render: (status: string) => {
              const statusMap: Record<string, { color: string; text: string }> = {
                pending: { color: 'default', text: '待交货' },
                in_transit: { color: 'processing', text: '运输中' },
                received: { color: 'success', text: '已到货' },
              };
              return <Tag color={statusMap[status]?.color}>{statusMap[status]?.text || status}</Tag>;
            },
          }
        );
        break;

      case 'lots':
        baseColumns.push(
          {
            title: '批次号',
            dataIndex: 'lotNo',
            key: 'lotNo',
            editable: true,
            inputType: 'text',
          },
          {
            title: '关联合同',
            dataIndex: 'contractId',
            key: 'contractId',
            editable: true,
            inputType: 'text',
          },
          {
            title: '数量(吨)',
            dataIndex: 'quantity',
            key: 'quantity',
            editable: true,
            inputType: 'number',
          },
          {
            title: '仓库',
            dataIndex: 'warehouse',
            key: 'warehouse',
            editable: true,
            inputType: 'text',
          },
          {
            title: '入库日期',
            dataIndex: 'receiptDate',
            key: 'receiptDate',
            editable: true,
            inputType: 'date',
          },
          {
            title: '匹配状态',
            dataIndex: 'matchStatus',
            key: 'matchStatus',
            render: (status: string) => {
              const statusMap: Record<string, { color: string; text: string }> = {
                unmatched: { color: 'default', text: '未匹配' },
                matched: { color: 'success', text: '已匹配' },
                mismatch: { color: 'error', text: '错配' },
              };
              return <Tag color={statusMap[status]?.color}>{statusMap[status]?.text || status}</Tag>;
            },
          }
        );
        break;

      case 'positions':
        baseColumns.push(
          {
            title: '合约月份',
            dataIndex: 'contractMonth',
            key: 'contractMonth',
            editable: true,
            inputType: 'text',
          },
          {
            title: '方向',
            dataIndex: 'direction',
            key: 'direction',
            editable: true,
            inputType: 'select',
            selectOptions: [
              { value: 'long', label: '买入' },
              { value: 'short', label: '卖出' },
            ],
            render: (dir: string) => (dir === 'short' ? '卖出' : '买入'),
          },
          {
            title: '数量(吨)',
            dataIndex: 'quantity',
            key: 'quantity',
            editable: true,
            inputType: 'number',
          },
          {
            title: '开仓价',
            dataIndex: 'openPrice',
            key: 'openPrice',
            editable: true,
            inputType: 'number',
          },
          {
            title: '当前价',
            dataIndex: 'currentPrice',
            key: 'currentPrice',
            editable: true,
            inputType: 'number',
          },
          {
            title: '开仓日期',
            dataIndex: 'openDate',
            key: 'openDate',
            editable: true,
            inputType: 'date',
          },
          {
            title: '交割月',
            dataIndex: 'deliveryMonth',
            key: 'deliveryMonth',
            editable: true,
            inputType: 'text',
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            editable: true,
            inputType: 'select',
            selectOptions: [
              { value: 'open', label: '持有中' },
              { value: 'closed', label: '已平仓' },
              { value: 'rolled', label: '已移仓' },
            ],
            render: (status: string) => {
              const statusMap: Record<string, { color: string; text: string }> = {
                open: { color: 'processing', text: '持有中' },
                closed: { color: 'default', text: '已平仓' },
                rolled: { color: 'warning', text: '已移仓' },
              };
              return <Tag color={statusMap[status]?.color}>{statusMap[status]?.text || status}</Tag>;
            },
          }
        );
        break;

      case 'basis':
        baseColumns.push(
          {
            title: '日期',
            dataIndex: 'basisDate',
            key: 'basisDate',
            editable: true,
            inputType: 'date',
          },
          {
            title: '关联持仓ID',
            dataIndex: 'positionId',
            key: 'positionId',
            editable: true,
            inputType: 'text',
          },
          {
            title: '现货价',
            dataIndex: 'spotPrice',
            key: 'spotPrice',
            editable: true,
            inputType: 'number',
          },
          {
            title: '期货价',
            dataIndex: 'futuresPrice',
            key: 'futuresPrice',
            editable: true,
            inputType: 'number',
          },
          {
            title: '基差',
            dataIndex: 'basisValue',
            key: 'basisValue',
            render: (_: any, record: BasisRecord) => (
              <Text
                style={{
                  fontFamily: 'monospace',
                  color: record.basisValue > 0 ? '#d32f2f' : record.basisValue < 0 ? '#388e3c' : 'inherit',
                }}
              >
                {record.spotPrice - record.futuresPrice}
              </Text>
            ),
          },
          {
            title: '是否锁定',
            dataIndex: 'isLocked',
            key: 'isLocked',
            editable: true,
            inputType: 'select',
            selectOptions: [
              { value: 'true', label: '是' },
              { value: 'false', label: '否' },
            ],
            render: (locked: boolean) => (
              <Tag color={locked ? 'success' : 'default'}>{locked ? '已锁定' : '未锁定'}</Tag>
            ),
          }
        );
        break;
    }

    baseColumns.push({
      title: '操作',
      key: 'operation',
      width: 150,
      render: (_: any, record: any) => {
        const editable = isEditing(record);
        return editable ? (
          <Space>
            <Button type="link" size="small" onClick={() => save(dataType)}>
              保存
            </Button>
            <Button type="link" size="small" onClick={cancel}>
              取消
            </Button>
          </Space>
        ) : (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={editingKey !== ''}
              onClick={() => edit(record)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={editingKey !== ''}
              onClick={() => deleteRow(dataType, record.id)}
            >
              删除
            </Button>
          </Space>
        );
      },
    });

    return baseColumns.map((col) => {
      if (!col.editable) {
        return col;
      }
      return {
        ...col,
        onCell: (record: any) => ({
          record,
          inputType: col.inputType,
          dataIndex: col.dataIndex,
          title: col.title,
          editing: isEditing(record),
          selectOptions: col.selectOptions,
        }),
      };
    });
  };

  const getRowClassName = (record: any, dataType: DataType) => {
    const errors = validateRow(record, dataType);
    if (errors.length > 0) return 'bg-yellow-50';
    return '';
  };

  const resultColumns = [
    {
      title: '数据类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          contracts: '采购合同',
          lots: '库存批次',
          positions: '期货持仓',
          basis: '基差数据',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '成功条数',
      dataIndex: 'success',
      key: 'success',
      render: (v: number) => <Text type="success">{v}</Text>,
    },
    {
      title: '失败条数',
      dataIndex: 'failed',
      key: 'failed',
      render: (v: number) => (v > 0 ? <Text type="danger">{v}</Text> : v),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: ImportResult) =>
        record.failed > 0 ? (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">
            有错误
          </Tag>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success">
            成功
          </Tag>
        ),
    },
  ];

  const dataTabs = [
    {
      key: 'contracts' as DataType,
      label: '采购合同',
      icon: <FileTextOutlined />,
      description: '导入采购合同数据，包括供应商、数量、价格、交货日期等。导入后的数据会参与敞口计算。',
      currentData: contracts,
    },
    {
      key: 'lots' as DataType,
      label: '库存批次',
      icon: <FileTextOutlined />,
      description: '导入库存批次数据，用于现货敞口计算和批次匹配。',
      currentData: lots,
    },
    {
      key: 'positions' as DataType,
      label: '期货持仓',
      icon: <FileTextOutlined />,
      description: '导入期货持仓数据，包括合约月份、方向、手数、价格等。',
      currentData: positions,
    },
    {
      key: 'basis' as DataType,
      label: '基差数据',
      icon: <FileTextOutlined />,
      description: '导入基差记录，用于基差风险计算和套保效果评估。',
      currentData: basisRecords,
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <ImportOutlined style={{ marginRight: 8 }} />
        数据导入中心
      </Title>

      <Alert
        message="数据导入说明"
        description={
          <div>
            <p style={{ margin: 0 }}>
              • 请按照标准模板导入数据，确保字段名称与模板一致
            </p>
            <p style={{ margin: 0 }}>
              • 导入后系统会自动校验数据完整性，异常数据将高亮显示供人工核对
            </p>
            <p style={{ margin: 0 }}>
              • 人工核对区可直接编辑修正数据，所有修改都会留下审计记录
            </p>
            <p style={{ margin: 0 }}>
              • 导入的数据会立即参与敞口重算、风险分层和报告导出
            </p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as DataType);
          setEditingKey('');
          form.resetFields();
        }}
        items={dataTabs.map((tab) => ({
          key: tab.key,
          label: (
            <span>
              {tab.icon} {tab.label}
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {tab.currentData.length} 条
              </Tag>
            </span>
          ),
          children: (
            <div>
              <Card style={{ marginBottom: 16 }}>
                <p style={{ marginBottom: 16, color: '#666' }}>
                  {tab.description}
                </p>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload.Dragger
                    {...createUploadProps(tab.key)}
                    multiple
                    disabled={uploading}
                  >
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">
                      点击或拖拽文件到此区域上传
                    </p>
                    <p className="ant-upload-hint">
                      支持 .xlsx, .xls, .csv 格式，文件大小不超过 10MB
                    </p>
                  </Upload.Dragger>
                </Space>
              </Card>

              <Card
                title="人工核对区"
                extra={
                  <Space>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => downloadTemplate(tab.key)}
                    >
                      下载模板
                    </Button>
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      type="primary"
                      onClick={() => addRow(tab.key)}
                      disabled={editingKey !== ''}
                    >
                      新增
                    </Button>
                  </Space>
                }
              >
                <Form form={form} component={false}>
                  <Table
                    components={{
                      body: {
                        cell: EditableCell,
                      },
                    }}
                    columns={getColumns(tab.key)}
                    dataSource={getDataByType(tab.key) as any[]}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                    rowClassName={(record) => getRowClassName(record, tab.key)}
                    locale={{ emptyText: '暂无数据，请先导入文件或点击新增按钮手动添加' }}
                  />
                </Form>
              </Card>
            </div>
          ),
        }))}
      />

      <Card title="导入历史" style={{ marginTop: 24 }}>
        <Table
          columns={resultColumns}
          dataSource={useDataStore((state) => state.importResults)}
          rowKey={(record, index) => `${record.type}-${index}`}
          pagination={{ pageSize: 10 }}
          size="small"
          locale={{ emptyText: '暂无导入记录' }}
          expandable={{
            expandedRowRender: (record) => (
              <div>
                {record.errors && record.errors.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="danger">错误详情：</Text>
                    <ul>
                      {record.errors.map((err, idx) => (
                        <li key={idx} style={{ color: '#d32f2f' }}>
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {record.warnings && record.warnings.length > 0 && (
                  <div>
                    <Text type="warning">警告信息：</Text>
                    <ul>
                      {record.warnings.map((warn, idx) => (
                        <li key={idx} style={{ color: '#f57c00' }}>
                          {warn}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ),
          }}
        />
      </Card>

      <Modal
        title="请填写修改理由"
        open={reasonModalVisible}
        onOk={() => confirmEditWithReason(activeTab)}
        onCancel={() => {
          setReasonModalVisible(false);
          setPendingEdit(null);
        }}
      >
        <p style={{ marginBottom: 12 }}>
          请填写修改理由（用于审计追溯，月底复盘时可查看）：
        </p>
        <TextArea
          rows={3}
          value={editingReason}
          onChange={(e) => setEditingReason(e.target.value)}
          placeholder="请输入修改理由..."
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default ImportCenter;
