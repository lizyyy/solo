import { useState, useMemo } from 'react';
import { Card, Row, Col, Table, Tag, Select, Space, Tooltip, Badge, Statistic, Divider } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AnomalyItem, LabRecord, RecordStatus } from '../types';
import {
  ANOMALY_TYPE_COLOR,
  ANOMALY_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL
} from '../utils/cleaningLogic';
import StatusSwitcher from '../components/StatusSwitcher';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

interface Props {
  records: LabRecord[];
  anomalies: AnomalyItem[];
  onStatusChange: (recordId: string, status: RecordStatus) => void;
}

function makeMarkerColor(type: string) {
  const colorMap: Record<string, string> = {
    outlier: '#fa8c16',
    duplicate_bottle: '#d4380d',
    incomplete_material: '#d48806',
    normal: '#389e0d'
  };
  return colorMap[type] ?? '#1677ff';
}

function buildIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

export default function OverviewPage({ records, anomalies, onStatusChange }: Props) {
  const [statusFilter, setStatusFilter] = useState<RecordStatus[] | undefined>(undefined);
  const [anomalyFilter, setAnomalyFilter] = useState<string[] | undefined>(undefined);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter && statusFilter.length && !statusFilter.includes(r.status)) return false;
      if (anomalyFilter && anomalyFilter.length) {
        if (!r.detectedAnomalies.some((a) => anomalyFilter.includes(a))) return false;
      }
      return true;
    });
  }, [records, statusFilter, anomalyFilter]);

  const stats = useMemo(() => {
    return {
      total: records.length,
      confirmed: records.filter((r) => r.status === 'confirmed').length,
      pending: records.filter((r) => r.status === 'pending').length,
      returned: records.filter((r) => r.status === 'returned').length,
      outlier: anomalies.filter((a) => a.type === 'outlier').length,
      duplicate: anomalies.filter((a) => a.type === 'duplicate_bottle').length,
      incomplete: anomalies.filter((a) => a.type === 'incomplete_material').length
    };
  }, [records, anomalies]);

  const center: [number, number] = useMemo(() => {
    if (records.length === 0) return [30.72, 121.45];
    const avgLat = records.reduce((s, r) => s + r.latitude, 0) / records.length;
    const avgLng = records.reduce((s, r) => s + r.longitude, 0) / records.length;
    return [avgLat, avgLng];
  }, [records]);

  const columns: ColumnsType<LabRecord> = [
    {
      title: '采样瓶编号',
      dataIndex: 'bottleNo',
      key: 'bottleNo',
      width: 160,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
          <span style={{ fontSize: 12, color: '#6b7a90' }}>{r.samplePoint}</span>
        </Space>
      )
    },
    {
      title: '坐标',
      key: 'coord',
      width: 180,
      render: (_, r) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {r.longitude.toFixed(4)}, {r.latitude.toFixed(4)}
        </span>
      )
    },
    {
      title: '采样日期',
      dataIndex: 'samplingDate',
      key: 'samplingDate',
      width: 110
    },
    {
      title: '来源表',
      dataIndex: 'sourceTable',
      key: 'sourceTable',
      width: 220,
      ellipsis: true,
      render: (v) => (
        <Tooltip title={v}>
          <span style={{ fontSize: 12 }}>{v}</span>
        </Tooltip>
      )
    },
    {
      title: '检测指标（异常高亮）',
      key: 'indicators',
      width: 320,
      render: (_, r) => (
        <Space wrap size={[4, 4]}>
          {r.indicators.map((ind) => {
            const isAbnormal =
              ind.value < ind.normalRange[0] || ind.value > ind.normalRange[1];
            return (
              <Tag
                key={ind.name}
                color={isAbnormal ? 'volcano' : 'default'}
                style={{ marginInlineEnd: 0 }}
              >
                {ind.name}: {ind.value}
                {ind.unit}
              </Tag>
            );
          })}
        </Space>
      )
    },
    {
      title: '材料',
      key: 'materials',
      width: 140,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Badge
            status={r.materialMissing?.length ? 'error' : 'success'}
            text={`齐全 ${r.materialCompleteness.length}/6`}
          />
          {r.materialMissing?.length ? (
            <Tooltip title={`缺失：${r.materialMissing.join('、')}`}>
              <Tag color="orange">缺失 {r.materialMissing.length} 项</Tag>
            </Tooltip>
          ) : null}
        </Space>
      )
    },
    {
      title: '异常类型',
      key: 'anomaly',
      width: 180,
      render: (_, r) => (
        <Space wrap size={[4, 4]}>
          {r.detectedAnomalies.map((a) => (
            <Tag
              key={a}
              color={ANOMALY_TYPE_COLOR[a]}
              style={{ marginInlineEnd: 0 }}
            >
              {ANOMALY_TYPE_LABEL[a]}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: '清洗状态',
      key: 'status',
      width: 100,
      render: (_, r) => (
        <Tag color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right',
      render: (_, r) => <StatusSwitcher value={r.status} onChange={(s) => onStatusChange(r.id, s)} />
    }
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic title="记录总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic title="已确认" value={stats.confirmed} valueStyle={{ color: '#389e0d' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic title="待补件" value={stats.pending} valueStyle={{ color: '#d48806' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic title="退回" value={stats.returned} valueStyle={{ color: '#d4380d' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic title="离群值" value={stats.outlier} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic title="采样瓶重复" value={stats.duplicate} valueStyle={{ color: '#d4380d' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card>
            <div className="card-title">
              <span className="card-title-dot" />
              <span>采样点空间位置</span>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <Tag color="#389e0d">正常</Tag>
              <Tag color="#fa8c16">离群值</Tag>
              <Tag color="#d4380d">采样瓶重复</Tag>
              <Tag color="#d48806">材料不齐整</Tag>
            </div>
            <MapContainer center={center} zoom={13} scrollWheelZoom>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {records.map((r) => {
                const color = makeMarkerColor(r.detectedAnomalies[0] ?? 'normal');
                return (
                  <Marker
                    key={r.id}
                    position={[r.latitude, r.longitude]}
                    icon={buildIcon(color)}
                  >
                    <Popup>
                      <div style={{ fontSize: 12 }}>
                        <div><b>{r.bottleNo}</b></div>
                        <div>{r.samplePoint}</div>
                        <div>{r.samplingDate}</div>
                        <div>
                          {r.detectedAnomalies.map((a) => ANOMALY_TYPE_LABEL[a]).join(' / ')}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <div className="card-title">
              <span className="card-title-dot" />
              <span>筛选条件</span>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div className="filter-bar">
              <span style={{ fontSize: 13, color: '#0d2847' }}>清洗状态：</span>
              <Select
                mode="multiple"
                allowClear
                placeholder="全部"
                style={{ minWidth: 240 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'confirmed', label: '已确认' },
                  { value: 'pending', label: '待补件' },
                  { value: 'returned', label: '退回' }
                ]}
              />
            </div>
            <div className="filter-bar">
              <span style={{ fontSize: 13, color: '#0d2847' }}>异常类型：</span>
              <Select
                mode="multiple"
                allowClear
                placeholder="全部"
                style={{ minWidth: 320 }}
                value={anomalyFilter}
                onChange={setAnomalyFilter}
                options={[
                  { value: 'normal', label: '正常' },
                  { value: 'outlier', label: '离群值' },
                  { value: 'duplicate_bottle', label: '采样瓶重复' },
                  { value: 'incomplete_material', label: '材料不齐整' }
                ]}
              />
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ fontSize: 13, color: '#6b7a90' }}>
              当前筛选命中 <b>{filteredRecords.length}</b> / {records.length} 条记录
            </div>
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="card-title">
          <span className="card-title-dot" />
          <span>实验室结果表</span>
        </div>
        <Divider style={{ margin: '12px 0' }} />
        <Table
          rowKey="id"
          size="middle"
          dataSource={filteredRecords}
          columns={columns}
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
        />
      </Card>
    </Space>
  );
}
