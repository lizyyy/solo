import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Tag,
  Space,
  Tooltip,
  Drawer,
  List,
  Avatar,
  Divider,
  message,
} from 'antd';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Link2,
  Image,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../store';
import { statusColors, statusLabels, tagColors, tagLabels } from '../data/mockData';
import { ScanPoint, PointStatus } from '../types';

const { Option } = Select;

export const MagneticScanner: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scanReports, photos, selectedReportId, setSelectedReportId, updatePointStatus, linkPointToPhoto } = useAppStore();
  
  const [selectedPoint, setSelectedPoint] = useState<ScanPoint | null>(null);
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const currentReport = scanReports.find((r) => r.id === selectedReportId);

  const getColorForValue = (value: number, status: PointStatus): string => {
    if (status === 'anomaly') return statusColors.anomaly;
    if (status === 'pending') return statusColors.pending;
    if (status === 'excluded') return statusColors.excluded;
    
    const normalized = Math.min(1, Math.max(0, (value - 30) / 100));
    const r = Math.round(22 + normalized * 100);
    const g = Math.round(93 + (1 - normalized) * 100);
    const b = Math.round(255 - normalized * 100);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentReport) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;
    const gridSize = 10;
    const cellWidth = (width - padding * 2) / gridSize;
    const cellHeight = (height - padding * 2) / gridSize;

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(padding + i * cellWidth, padding);
      ctx.lineTo(padding + i * cellWidth, height - padding);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding, padding + i * cellHeight);
      ctx.lineTo(width - padding, padding + i * cellHeight);
      ctx.stroke();
    }

    ctx.fillStyle = '#374151';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    for (let i = 0; i <= gridSize; i++) {
      ctx.fillText(String(i), padding + i * cellWidth, height - padding + 20);
      ctx.fillText(String(i), padding - 25, padding + i * cellHeight + 4);
    }

    ctx.font = '14px Inter SemiBold';
    ctx.fillText('X 轴 (mm)', width / 2, height - 10);
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Y 轴 (mm)', 0, 0);
    ctx.restore();

    currentReport.points.forEach((point) => {
      const cx = padding + point.x * cellWidth + cellWidth / 2;
      const cy = padding + point.y * cellHeight + cellHeight / 2;
      const radius = point.status === 'normal' ? 8 : 12;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = getColorForValue(point.value, point.status);
      ctx.fill();

      if (point.status !== 'normal') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (point.linkedPhotoId) {
        ctx.beginPath();
        ctx.arc(cx + radius - 3, cy - radius + 3, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#165DFF';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    if (selectedPoint) {
      const cx = padding + selectedPoint.x * cellWidth + cellWidth / 2;
      const cy = padding + selectedPoint.y * cellHeight + cellHeight / 2;
      
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.strokeStyle = '#165DFF';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [currentReport, scale, offset, selectedPoint]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentReport) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left - offset.x) / scale;
    const clickY = (e.clientY - rect.top - offset.y) / scale;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;
    const gridSize = 10;
    const cellWidth = (width - padding * 2) / gridSize;
    const cellHeight = (height - padding * 2) / gridSize;

    for (const point of currentReport.points) {
      const cx = padding + point.x * cellWidth + cellWidth / 2;
      const cy = padding + point.y * cellHeight + cellHeight / 2;
      const distance = Math.sqrt((clickX - cx) ** 2 + (clickY - cy) ** 2);

      if (distance < 20) {
        setSelectedPoint(point);
        setIsDetailDrawerVisible(true);
        return;
      }
    }

    setSelectedPoint(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setScale((s) => Math.min(s * 1.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.2, 0.5));
  const handleResetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleStatusChange = (status: PointStatus) => {
    if (selectedPoint && selectedReportId) {
      updatePointStatus(selectedReportId, selectedPoint.id, status);
      setSelectedPoint({ ...selectedPoint, status });
      message.success(`状态已更新为「${statusLabels[status]}」`);
    }
  };

  const handleLinkPhoto = (photoId: string) => {
    if (selectedPoint && selectedReportId) {
      linkPointToPhoto(selectedReportId, selectedPoint.id, photoId);
      setSelectedPoint({ ...selectedPoint, linkedPhotoId: photoId });
      message.success('已关联到异常照片');
    }
  };

  const linkedPhoto = selectedPoint?.linkedPhotoId
    ? photos.find((p) => p.id === selectedPoint.linkedPhotoId)
    : null;

  const statusIcon = (status: PointStatus) => {
    switch (status) {
      case 'normal':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'anomaly':
        return <AlertTriangle size={16} className="text-red-500" />;
      case 'pending':
        return <Clock size={16} className="text-orange-500" />;
      case 'excluded':
        return <XCircle size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            style={{ width: 300 }}
            value={selectedReportId}
            onChange={setSelectedReportId}
            placeholder="选择扫描报告"
          >
            {scanReports.map((report) => (
              <Option key={report.id} value={report.id}>
                {report.name} (v{report.version})
              </Option>
            ))}
          </Select>
          {currentReport && (
            <Space>
              <Tag color="blue">v{currentReport.version}</Tag>
              <span className="text-sm text-gray-500">
                创建时间：{currentReport.createdAt}
              </span>
            </Space>
          )}
        </div>
        <Space>
          <Tooltip title="放大">
            <Button icon={<ZoomIn size={16} />} onClick={handleZoomIn} />
          </Tooltip>
          <Tooltip title="缩小">
            <Button icon={<ZoomOut size={16} />} onClick={handleZoomOut} />
          </Tooltip>
          <Tooltip title="重置视图">
            <Button icon={<Maximize2 size={16} />} onClick={handleResetView} />
          </Tooltip>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={18}>
          <Card
            className="h-full"
            bodyStyle={{ padding: 0 }}
          >
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-pointer"
                style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
              />
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm">
                <div className="text-xs text-gray-500 mb-1">图例</div>
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    正常
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    异常
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                    待确认
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                    已排除
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500 border border-white"></span>
                    已关联证据
                  </span>
                </div>
              </div>
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm text-xs text-gray-500">
                Shift + 拖动平移 | 点击数据点查看详情
              </div>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card title="数据统计" className="mb-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">总数据点</span>
                <span className="font-semibold">{currentReport?.points.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">正常</span>
                <Tag color="green">
                  {currentReport?.points.filter((p) => p.status === 'normal').length || 0}
                </Tag>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">异常</span>
                <Tag color="red">
                  {currentReport?.points.filter((p) => p.status === 'anomaly').length || 0}
                </Tag>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">待确认</span>
                <Tag color="orange">
                  {currentReport?.points.filter((p) => p.status === 'pending').length || 0}
                </Tag>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">已排除</span>
                <Tag color="default">
                  {currentReport?.points.filter((p) => p.status === 'excluded').length || 0}
                </Tag>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">已关联证据</span>
                <Tag color="blue">
                  {currentReport?.points.filter((p) => p.linkedPhotoId).length || 0}
                </Tag>
              </div>
            </div>
          </Card>

          {currentReport?.notes && (
            <Card title="报告备注">
              <p className="text-sm text-gray-600">{currentReport.notes}</p>
            </Card>
          )}
        </Col>
      </Row>

      <Drawer
        title="数据点详情"
        placement="right"
        width={450}
        open={isDetailDrawerVisible}
        onClose={() => setIsDetailDrawerVisible(false)}
      >
        {selectedPoint && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">坐标</div>
                  <div className="font-mono text-lg">
                    ({selectedPoint.x}, {selectedPoint.y})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">测量值</div>
                  <div className="font-mono text-lg">{selectedPoint.value} mT</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">当前状态</div>
              <div className="flex items-center gap-2 mb-3">
                {statusIcon(selectedPoint.status)}
                <Tag color={statusColors[selectedPoint.status]}>
                  {statusLabels[selectedPoint.status]}
                </Tag>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['normal', 'anomaly', 'pending', 'excluded'] as PointStatus[]).map(
                  (status) => (
                    <Button
                      key={status}
                      size="small"
                      type={selectedPoint.status === status ? 'primary' : 'default'}
                      onClick={() => handleStatusChange(status)}
                    >
                      {statusLabels[status]}
                    </Button>
                  )
                )}
              </div>
            </div>

            {selectedPoint.notes && (
              <div>
                <div className="text-sm font-medium mb-2">备注说明</div>
                <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded border border-yellow-200">
                  {selectedPoint.notes}
                </p>
              </div>
            )}

            <Divider />

            <div>
              <div className="text-sm font-medium mb-3 flex items-center">
                <Link2 size={16} className="mr-2" />
                关联证据
              </div>

              {linkedPhoto ? (
                <Card
                  size="small"
                  cover={
                    <img
                      src={linkedPhoto.url}
                      alt={linkedPhoto.name}
                      className="h-32 object-cover"
                    />
                  }
                >
                  <Card.Meta
                    title={
                      <div className="flex items-center gap-2">
                        <Image size={14} />
                        <span className="text-sm">{linkedPhoto.name}</span>
                      </div>
                    }
                    description={
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {linkedPhoto.tags.map((tag) => (
                            <Tag key={tag} color={tagColors[tag]}>
                              {tagLabels[tag]}
                            </Tag>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500">
                          {linkedPhoto.description}
                        </p>
                      </div>
                    }
                  />
                  {linkedPhoto.corrections.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs font-medium mb-2 flex items-center">
                        <MessageSquare size={12} className="mr-1" />
                        最新批改意见
                      </div>
                      <p className="text-xs text-gray-600">
                        {
                          linkedPhoto.corrections.find((c) => c.isLatest)
                            ?.content
                        }
                      </p>
                    </div>
                  )}
                </Card>
              ) : (
                <div>
                  <p className="text-sm text-gray-400 mb-3">
                    尚未关联任何异常照片
                  </p>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择要关联的异常照片"
                    onChange={handleLinkPhoto}
                  >
                    {photos.map((photo) => (
                      <Option key={photo.id} value={photo.id}>
                        {photo.name}
                      </Option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
