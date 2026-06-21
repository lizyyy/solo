import { useMemo } from 'react';
import { Card, Collapse, Tag, Space, List, Divider, Row, Col, Empty, Alert } from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  FileUnknownOutlined
} from '@ant-design/icons';
import { AnomalyItem, AnomalyType, LabRecord, RecordStatus } from '../types';
import {
  ANOMALY_TYPE_COLOR,
  ANOMALY_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL
} from '../utils/cleaningLogic';
import StatusSwitcher from '../components/StatusSwitcher';

interface Props {
  records: LabRecord[];
  anomalies: AnomalyItem[];
  onStatusChange: (recordId: string, status: RecordStatus) => void;
}

const TYPE_ICON: Record<AnomalyType, React.ReactNode> = {
  outlier: <WarningOutlined style={{ color: '#fa8c16' }} />,
  duplicate_bottle: <ExclamationCircleOutlined style={{ color: '#d4380d' }} />,
  incomplete_material: <FileUnknownOutlined style={{ color: '#d48806' }} />,
  normal: <span />
};

function AnomalyCard({ item, onStatusChange }: { item: AnomalyItem; onStatusChange: Props['onStatusChange'] }) {
  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderLeft: `4px solid ${ANOMALY_TYPE_COLOR[item.type]}`
      }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <Row gutter={12} align="middle" style={{ marginBottom: 8 }}>
        <Col flex="auto">
          <Space size={12}>
            {TYPE_ICON[item.type]}
            <Tag color={ANOMALY_TYPE_COLOR[item.type]}>
              {ANOMALY_TYPE_LABEL[item.type]}
            </Tag>
            <span style={{ fontWeight: 600, color: '#0d2847' }}>
              {item.record.bottleNo}
            </span>
            <span style={{ color: '#6b7a90' }}>·</span>
            <span style={{ color: '#6b7a90' }}>{item.record.samplePoint}</span>
            <span style={{ color: '#6b7a90' }}>·</span>
            <span style={{ color: '#6b7a90' }}>{item.record.samplingDate}</span>
            <span style={{ color: '#6b7a90' }}>·</span>
            <span style={{ fontSize: 12, color: '#6b7a90' }}>
              来源：{item.record.sourceTable}
            </span>
          </Space>
        </Col>
        <Col flex="none">
          <Tag color={STATUS_COLOR[item.record.status]}>
            {STATUS_LABEL[item.record.status]}
          </Tag>
          <StatusSwitcher
            value={item.record.status}
            onChange={(s) => onStatusChange(item.record.id, s)}
          />
        </Col>
      </Row>

      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div style={{ fontSize: 13, color: '#0d2847' }}>
          <b>异常说明：</b>
          {item.description}
        </div>

        {item.record.indicators.some(
          (ind) => ind.value < ind.normalRange[0] || ind.value > ind.normalRange[1]
        ) && (
          <div style={{ fontSize: 12 }}>
            <b style={{ color: '#0d2847' }}>异常指标：</b>
            <Space wrap size={[4, 4]} style={{ marginLeft: 6 }}>
              {item.record.indicators
                .filter(
                  (ind) =>
                    ind.value < ind.normalRange[0] || ind.value > ind.normalRange[1]
                )
                .map((ind) => (
                  <Tag key={ind.name} color="volcano" style={{ marginInlineEnd: 0 }}>
                    {ind.name}: {ind.value}
                    {ind.unit}（正常 {ind.normalRange[0]}~{ind.normalRange[1]}
                    {ind.unit}）
                  </Tag>
                ))}
            </Space>
          </div>
        )}

        {item.affectedRecords && item.affectedRecords.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message={
              <span style={{ fontSize: 12 }}>
                <b>受影响记录（{item.affectedRecords.length} 条）：</b>
                <Space wrap size={[6, 4]} style={{ marginLeft: 6 }}>
                  {item.affectedRecords.map((r) => (
                    <Tag key={r.id} color="gold">
                      {r.bottleNo} @ {r.samplePoint}（{r.id}）
                    </Tag>
                  ))}
                </Space>
              </span>
            }
          />
        )}

        <Collapse
          size="small"
          ghost
          items={[
            {
              key: 'criterion',
              label: (
                <span style={{ fontSize: 12, color: '#38609a' }}>
                  当前判断口径（点击展开）
                </span>
              ),
              children: (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div className="criterion-text">{item.criterion}</div>
                  <div className="suggestion-text">
                    <b>处理建议：</b>
                    {item.suggestion}
                  </div>
                </Space>
              )
            }
          ]}
        />
      </Space>
    </Card>
  );
}

export default function AnomalyQueuePage({ records, anomalies, onStatusChange }: Props) {
  const grouped = useMemo(() => {
    const groups: Record<AnomalyType, AnomalyItem[]> = {
      outlier: [],
      duplicate_bottle: [],
      incomplete_material: [],
      normal: []
    };
    anomalies.forEach((a) => {
      if (groups[a.type]) groups[a.type].push(a);
    });
    return groups;
  }, [anomalies]);

  const summary = useMemo(() => {
    return {
      total: records.length,
      confirmed: records.filter((r) => r.status === 'confirmed').length,
      pending: records.filter((r) => r.status === 'pending').length,
      returned: records.filter((r) => r.status === 'returned').length
    };
  }, [records]);

  const renderSection = (title: string, type: AnomalyType, items: AnomalyItem[]) => {
    if (!items.length) return null;
    return (
      <div className="queue-section">
        <div className="queue-section-title">
          {title}（{items.length} 条）
        </div>
        <List
          dataSource={items}
          renderItem={(item) => (
            <AnomalyCard key={item.id} item={item} onStatusChange={onStatusChange} />
          )}
        />
      </div>
    );
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={24}>
          <Card>
            <div className="card-title">
              <span className="card-title-dot" />
              <span>月末复核状态汇总（与导出沟通清单口径一致）</span>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <div className="stats-card">
                  <div className="stats-value" style={{ color: '#0d2847' }}>
                    {summary.total}
                  </div>
                  <div className="stats-label">记录总数</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="stats-card">
                  <div className="stats-value" style={{ color: '#389e0d' }}>
                    {summary.confirmed}
                  </div>
                  <div className="stats-label">已确认（可入统）</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="stats-card">
                  <div className="stats-value" style={{ color: '#d48806' }}>
                    {summary.pending}
                  </div>
                  <div className="stats-label">待补件（需补齐材料）</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="stats-card">
                  <div className="stats-value" style={{ color: '#d4380d' }}>
                    {summary.returned}
                  </div>
                  <div className="stats-label">退回（需重新采样）</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="card-title">
          <span className="card-title-dot" />
          <span>异常队列（可直接拿去沟通，与导出文件同源）</span>
        </div>
        <Divider style={{ margin: '12px 0' }} />
        {anomalies.length === 0 ? (
          <Empty description="暂无异常记录，所有数据均符合口径。" />
        ) : (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            {renderSection('采样瓶重复（先人工确认，不出最终数）', 'duplicate_bottle', grouped.duplicate_bottle)}
            {renderSection('离群值（疑似噪声，不直接删除）', 'outlier', grouped.outlier)}
            {renderSection('材料不齐整（退回补件）', 'incomplete_material', grouped.incomplete_material)}
          </Space>
        )}
      </Card>
    </Space>
  );
}
