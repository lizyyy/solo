const { useState, useEffect } = React;

const API_BASE = '/api';

const STATUS_LABELS = {
  PENDING: '待处理',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  SHIPPED: '已寄送',
  DELIVERED: '已签收',
  DESTROYED: '已销毁',
  CLOSED: '已关闭'
};

const TEMP_STATUS_LABELS = {
  NORMAL: '正常',
  WARNING: '警告',
  EXCEEDED: '超限',
  REVIEWED: '已复核'
};

const STATUS_GROUP_MAP = {
  all: null,
  pending: ['PENDING'],
  approved: ['APPROVED', 'SHIPPED', 'DELIVERED', 'DESTROYED'],
  rejected: ['REJECTED', 'CLOSED']
};

const QUALIFICATION_STATUS_LABELS = {
  active: '有效',
  expired: '已过期',
  expiring_soon: '即将过期',
  inactive: '已禁用'
};

function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function getStatusClass(status) {
  return `status-${status.toLowerCase()}`;
}

function getQualificationStatusClass(status) {
  return `qualification-${status}`;
}

function getTempStatusClass(status) {
  return `temp-${status.toLowerCase()}`;
}

async function apiRequest(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || err.details?.join('; ') || '请求失败');
  }
  return res.json();
}

function StatusBadge({ status, size = 'normal' }) {
  const sizeClass = size === 'small' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-sm';
  return (
    <span className={`inline-flex rounded-full font-medium ${sizeClass} ${getStatusClass(status)}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function QualificationBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getQualificationStatusClass(status)}`}>
      {QUALIFICATION_STATUS_LABELS[status]}
    </span>
  );
}

function TempStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTempStatusClass(status)}`}>
      {TEMP_STATUS_LABELS[status]}
    </span>
  );
}

function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  }[size] || 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${sizeClass} max-h-[90vh] flex flex-col`}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function Loading({ message = '加载中...' }) {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
      <span className="text-gray-500">{message}</span>
    </div>
  );
}

function Alert({ type = 'info', message, onClose }) {
  const colors = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200'
  };
  return (
    <div className={`border rounded-lg p-4 mb-4 ${colors[type]}`}>
      <div className="flex justify-between">
        <span>{message}</span>
        {onClose && <button onClick={onClose} className="font-bold">&times;</button>}
      </div>
    </div>
  );
}

function Dashboard({ data }) {
  const stats = [
    { label: '待处理申请', value: data.stats.pending, color: 'bg-yellow-100 text-yellow-800' },
    { label: '已确认/通过', value: data.stats.approved, color: 'bg-green-100 text-green-800' },
    { label: '已驳回/关闭', value: data.stats.rejected, color: 'bg-red-100 text-red-800' },
    { label: '温控未复核', value: data.tempStats.unreviewedRecords, color: 'bg-orange-100 text-orange-800' }
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">合规仪表盘</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((s, i) => (
          <div key={i} className={`rounded-lg p-6 ${s.color}`}>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm mt-1 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">近期申请 (5条)</h3>
          <div className="space-y-3">
            {data.recentShipments.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{s.shipmentNumber}</div>
                  <div className="text-sm text-gray-500">{s.batch.sampleName} → {s.institution.name}</div>
                </div>
                <StatusBadge status={s.status} size="small" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">待办事项</h3>
          <div className="space-y-3">
            {data.pendingDestructions.length > 0 && (
              <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                <div>
                  <div className="font-medium text-red-800">销毁回执待上传</div>
                  <div className="text-sm text-red-600">{data.pendingDestructions.length} 笔已签收但未销毁</div>
                </div>
                <span className="text-red-600 font-bold">{data.pendingDestructions.length}</span>
              </div>
            )}
            {data.expiredRecipients.length > 0 && (
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                <div>
                  <div className="font-medium text-orange-800">接收人资质过期</div>
                  <div className="text-sm text-orange-600">{data.expiredRecipients.length} 人资质已过期</div>
                </div>
                <span className="text-orange-600 font-bold">{data.expiredRecipients.length}</span>
              </div>
            )}
            {data.tempStats.unreviewedRecords > 0 && (
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                <div>
                  <div className="font-medium text-yellow-800">温控异常待复核</div>
                  <div className="text-sm text-yellow-600">{data.tempStats.unreviewedRecords} 条超限记录未复核</div>
                </div>
                <span className="text-yellow-600 font-bold">{data.tempStats.unreviewedRecords}</span>
              </div>
            )}
            {data.pendingDestructions.length === 0 && data.expiredRecipients.length === 0 && data.tempStats.unreviewedRecords === 0 && (
              <div className="text-center text-gray-500 py-8">
                ✓ 暂无待办事项，系统运行正常
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">温控合规概览</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{data.tempStats.totalRecords}</div>
            <div className="text-xs text-gray-500">总记录数</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-700">{data.tempStats.totalRecords - data.tempStats.exceededRecords - data.tempStats.warningRecords}</div>
            <div className="text-xs text-green-600">正常</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded">
            <div className="text-2xl font-bold text-yellow-700">{data.tempStats.warningRecords}</div>
            <div className="text-xs text-yellow-600">警告</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-700">{data.tempStats.exceededRecords}</div>
            <div className="text-xs text-red-600">超限</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-700">{data.tempStats.complianceRate}%</div>
            <div className="text-xs text-blue-600">合规率</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShipmentList({ 
  shipments, 
  statusFilter, 
  onStatusFilterChange, 
  onViewDetail,
  onApprove,
  onReject,
  onCreate
}) {
  const filteredShipments = statusFilter === 'all' 
    ? shipments 
    : shipments.filter(s => STATUS_GROUP_MAP[statusFilter].includes(s.status));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">寄送申请列表</h2>
        <button 
          onClick={onCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + 新建申请
        </button>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b p-4 flex flex-wrap gap-3">
          <span className="text-gray-600 self-center mr-2">状态筛选:</span>
          {[
            { key: 'all', label: '全部' },
            { key: 'pending', label: '待处理' },
            { key: 'approved', label: '已确认/通过' },
            { key: 'rejected', label: '已驳回/关闭' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => onStatusFilterChange(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                statusFilter === f.key 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {f.key !== 'all' && (
                <span className="ml-2 bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-xs">
                  {shipments.filter(s => STATUS_GROUP_MAP[f.key].includes(s.status)).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请单号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">样本</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">接收机构</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">接收人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredShipments.map(shipment => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                    {shipment.shipmentNumber}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="font-medium">{shipment.batch.batchNumber}</div>
                    <div className="text-gray-500 text-xs">{shipment.batch.sampleName}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{shipment.institution.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{shipment.recipient.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{shipment.applicant}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(shipment.applicationDate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={shipment.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm space-x-2">
                    <button 
                      onClick={() => onViewDetail(shipment)}
                      className="text-blue-600 hover:text-blue-900"
                    >详情</button>
                    {shipment.status === 'PENDING' && (
                      <>
                        <button 
                          onClick={() => onApprove(shipment)}
                          className="text-green-600 hover:text-green-900"
                        >通过</button>
                        <button 
                          onClick={() => onReject(shipment)}
                          className="text-red-600 hover:text-red-900"
                        >驳回</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredShipments.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ShipmentDetail({ shipment, onClose, onAction, history }) {
  if (!shipment) return null;

  const actionButtons = [];
  if (shipment.status === 'APPROVED') {
    actionButtons.push({ key: 'ship', label: '发出样本', action: 'ship' });
  }
  if (shipment.status === 'SHIPPED') {
    actionButtons.push({ key: 'deliver', label: '签收', action: 'deliver' });
  }
  if (shipment.status === 'DELIVERED' && !shipment.destruction) {
    actionButtons.push({ key: 'destruction', label: '上传销毁回执', action: 'destruction' });
  }
  if (shipment.status === 'DELIVERED' && shipment.destruction) {
    actionButtons.push({ key: 'close', label: '关闭申请', action: 'close' });
  }
  actionButtons.push({ key: 'export', label: '导出合规包', action: 'export' });

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">申请信息</h4>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500">申请单号:</span> {shipment.shipmentNumber}</div>
            <div><span className="text-gray-500">申请人:</span> {shipment.applicant}</div>
            <div><span className="text-gray-500">申请时间:</span> {formatDate(shipment.applicationDate)}</div>
            <div><span className="text-gray-500">寄送目的:</span> {shipment.purpose}</div>
            <div><span className="text-gray-500">当前状态:</span> <StatusBadge status={shipment.status} /></div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">样本批次</h4>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500">批号:</span> {shipment.batch.batchNumber}</div>
            <div><span className="text-gray-500">品名:</span> {shipment.batch.sampleName}</div>
            <div><span className="text-gray-500">厂家:</span> {shipment.batch.manufacturer}</div>
            <div><span className="text-gray-500">有效期:</span> {formatDate(shipment.batch.expiryDate)}</div>
            <div><span className="text-gray-500">温控范围:</span> {shipment.batch.storageTempMin}°C ~ {shipment.batch.storageTempMax}°C</div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">接收机构</h4>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500">名称:</span> {shipment.institution.name}</div>
            <div><span className="text-gray-500">地址:</span> {shipment.institution.address}</div>
            <div><span className="text-gray-500">联系人:</span> {shipment.institution.contact}</div>
            <div><span className="text-gray-500">电话:</span> {shipment.institution.phone}</div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">接收人资质</h4>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500">姓名:</span> {shipment.recipient.name}</div>
            <div><span className="text-gray-500">资质类型:</span> {shipment.recipient.qualificationType}</div>
            <div><span className="text-gray-500">证书编号:</span> {shipment.recipient.qualificationNum}</div>
            <div><span className="text-gray-500">有效期至:</span> {formatDate(shipment.recipient.expiryDate)}</div>
          </div>
        </div>
      </div>

      {shipment.tempRecords && shipment.tempRecords.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-700 mb-3">温控记录 ({shipment.tempRecords.length}条)</h4>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">时间</th>
                  <th className="px-3 py-2 text-left">温度</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">复核</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shipment.tempRecords.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{formatDate(t.recordTime)}</td>
                    <td className="px-3 py-2">{t.temperature}°C</td>
                    <td className="px-3 py-2"><TempStatusBadge status={t.status} /></td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {t.reviewedBy ? `${t.reviewedBy} @ ${formatDate(t.reviewedAt)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {shipment.destruction && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">✓ 销毁回执</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">销毁日期:</span> {formatDate(shipment.destruction.destructionDate)}</div>
            <div><span className="text-gray-500">销毁方式:</span> {shipment.destruction.destructionMethod}</div>
            <div><span className="text-gray-500">见证人:</span> {shipment.destruction.witnessName}</div>
            <div><span className="text-gray-500">回执编号:</span> {shipment.destruction.receiptNumber || '-'}</div>
          </div>
        </div>
      )}

      {!shipment.destruction && ['DELIVERED', 'CLOSED'].includes(shipment.status) && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">⚠ 销毁回执缺失</h4>
          <p className="text-sm text-red-700">该申请已签收但尚未上传销毁回执，请尽快处理。</p>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-700 mb-3">操作历史</h4>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-start p-3 bg-gray-50 rounded">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{h.actionLabel}</span>
                    <span className="text-gray-500">{formatDate(h.actionTime)}</span>
                  </div>
                  <div className="text-sm text-gray-600">{h.operator} - {h.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        {actionButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => onAction(btn.action, shipment)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              btn.key === 'export' 
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : btn.key === 'close'
                ? 'bg-gray-600 text-white hover:bg-gray-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {btn.label}
          </button>
        ))}
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 ml-auto"
        >
          关闭
        </button>
      </div>
    </div>
  );
}

function TemperatureMonitoring({ records, onReview }) {
  const needsReview = records.filter(r => r.status === 'EXCEEDED' && !r.reviewedBy);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">温控异常监控</h2>

      {needsReview.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">⚠ 待复核温控异常 ({needsReview.length}条)</h4>
          <div className="space-y-2">
            {needsReview.map(r => (
              <div key={r.id} className="flex justify-between items-center p-3 bg-white rounded">
                <div>
                  <span className="font-medium">{r.shipment?.shipmentNumber}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-red-600">{r.temperature}°C</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-gray-500 text-sm">{formatDate(r.recordTime)}</span>
                </div>
                <button
                  onClick={() => onReview(r)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  立即复核
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h4 className="font-semibold">全部温控记录</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请单号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">样本</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">记录时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">温度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">复核人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">复核时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600">{r.shipment?.shipmentNumber}</td>
                  <td className="px-4 py-3">{r.shipment?.batch?.sampleName}</td>
                  <td className="px-4 py-3">{formatDate(r.recordTime)}</td>
                  <td className={`px-4 py-3 font-medium ${r.status === 'EXCEEDED' ? 'text-red-600' : ''}`}>
                    {r.temperature}°C
                  </td>
                  <td className="px-4 py-3"><TempStatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{r.reviewedBy || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(r.reviewedAt)}</td>
                  <td className="px-4 py-3">
                    {r.status === 'EXCEEDED' && !r.reviewedBy && (
                      <button
                        onClick={() => onReview(r)}
                        className="text-orange-600 hover:text-orange-900 font-medium"
                      >复核</button>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan="8" className="px-4 py-12 text-center text-gray-500">暂无温控记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QualificationManagement({ recipients }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">接收人资质管理</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{recipients.length}</div>
          <div className="text-sm text-gray-500">总人数</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-700">
            {recipients.filter(r => r.qualificationStatus === 'active').length}
          </div>
          <div className="text-sm text-green-600">资质有效</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-700">
            {recipients.filter(r => r.qualificationStatus === 'expiring_soon').length}
          </div>
          <div className="text-sm text-yellow-600">即将过期</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-2xl font-bold text-red-700">
            {recipients.filter(r => r.qualificationStatus === 'expired' || r.qualificationStatus === 'inactive').length}
          </div>
          <div className="text-sm text-red-600">已过期/禁用</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">所属机构</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">资质类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">证书编号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">发证日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">有效期至</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recipients.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.institution?.name}</td>
                  <td className="px-4 py-3">{r.qualificationType}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.qualificationNum}</td>
                  <td className="px-4 py-3">{formatDate(r.issueDate)}</td>
                  <td className={`px-4 py-3 ${r.qualificationStatus === 'expired' ? 'text-red-600 font-medium' : ''}`}>
                    {formatDate(r.expiryDate)}
                  </td>
                  <td className="px-4 py-3"><QualificationBadge status={r.qualificationStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DestructionPending({ shipments, onUpload }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">销毁回执管理</h2>

      {shipments.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">⚠ 待上传销毁回执 ({shipments.length}笔)</h4>
          <p className="text-sm text-red-700">以下申请已签收但尚未提交销毁回执，请及时处理。</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请单号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">样本</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">接收机构</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">接收人</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">签收时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shipments.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600">{s.shipmentNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.batch.sampleName}</div>
                    <div className="text-xs text-gray-500">{s.batch.batchNumber}</div>
                  </td>
                  <td className="px-4 py-3">{s.institution.name}</td>
                  <td className="px-4 py-3">{s.recipient.name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(s.applicationDate)}</td>
                  <td className="px-4 py-3">
                    {s.destruction ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">已提交</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">待上传</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!s.destruction && (
                      <button
                        onClick={() => onUpload(s)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        上传回执
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {shipments.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                    ✓ 所有申请的销毁回执均已提交
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CreateShipmentForm({ batches, institutions, recipients, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    batchId: '',
    institutionId: '',
    recipientId: '',
    applicant: '系统管理员',
    purpose: '',
    remark: ''
  });

  const filteredRecipients = recipients.filter(r => r.institutionId === form.institutionId);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">样本批次 *</label>
        <select 
          value={form.batchId}
          onChange={e => setForm({...form, batchId: e.target.value})}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="">请选择样本批次</option>
          {batches.filter(b => b.batchStatus === 'active').map(b => (
            <option key={b.id} value={b.id}>{b.batchNumber} - {b.sampleName}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">接收机构 *</label>
        <select 
          value={form.institutionId}
          onChange={e => setForm({...form, institutionId: e.target.value, recipientId: ''})}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="">请选择接收机构</option>
          {institutions.map(i => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">接收人 *</label>
        <select 
          value={form.recipientId}
          onChange={e => setForm({...form, recipientId: e.target.value})}
          className="w-full border rounded-lg px-3 py-2"
          disabled={!form.institutionId}
        >
          <option value="">请选择接收人</option>
          {filteredRecipients.map(r => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.qualificationType}) 
              {r.qualificationStatus !== 'active' && ` [${QUALIFICATION_STATUS_LABELS[r.qualificationStatus]}]`}
            </option>
          ))}
        </select>
        {form.recipientId && filteredRecipients.find(r => r.id === form.recipientId)?.qualificationStatus !== 'active' && (
          <p className="text-red-600 text-sm mt-1">警告: 该接收人资质状态异常，提交时可能会被拦截</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">申请人</label>
        <input 
          type="text"
          value={form.applicant}
          onChange={e => setForm({...form, applicant: e.target.value})}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">寄送目的 *</label>
        <textarea 
          value={form.purpose}
          onChange={e => setForm({...form, purpose: e.target.value})}
          rows="3"
          className="w-full border rounded-lg px-3 py-2"
          placeholder="请说明寄送目的"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
        <textarea 
          value={form.remark}
          onChange={e => setForm({...form, remark: e.target.value})}
          rows="2"
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
          取消
        </button>
        <button 
          onClick={() => {
            if (!form.batchId || !form.institutionId || !form.recipientId || !form.purpose) {
              alert('请填写所有必填项');
              return;
            }
            onSubmit(form);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          提交申请
        </button>
      </div>
    </div>
  );
}

function ApprovalModal({ shipment, onApprove, onReject, onClose }) {
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="font-medium">{shipment.shipmentNumber}</div>
        <div className="text-sm text-gray-600 mt-1">
          {shipment.batch.sampleName} → {shipment.institution.name} ({shipment.recipient.name})
        </div>
        <div className="text-sm text-gray-500 mt-1">目的: {shipment.purpose}</div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">审批说明（驳回必填）</label>
        <textarea 
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows="3"
          className="w-full border rounded-lg px-3 py-2"
          placeholder="请输入审批意见"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
          取消
        </button>
        <button 
          onClick={() => onReject(shipment, reason)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          驳回
        </button>
        <button 
          onClick={() => onApprove(shipment, reason)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          通过
        </button>
      </div>
    </div>
  );
}

function ReviewModal({ record, onSubmit, onClose }) {
  const [remark, setRemark] = useState('');

  return (
    <div className="space-y-4">
      <div className="bg-red-50 p-4 rounded-lg">
        <div className="flex justify-between">
          <div>
            <span className="font-medium">{record.shipment?.shipmentNumber}</span>
            <span className="mx-2 text-gray-400">|</span>
            <span className="text-red-600 font-bold text-xl">{record.temperature}°C</span>
          </div>
          <TempStatusBadge status={record.status} />
        </div>
        <div className="text-sm text-gray-600 mt-1">记录时间: {formatDate(record.recordTime)}</div>
        {record.shipment?.batch && (
          <div className="text-sm text-gray-500 mt-1">
            温控范围: {record.shipment.batch.storageTempMin}°C ~ {record.shipment.batch.storageTempMax}°C
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">复核说明 *</label>
        <textarea 
          value={remark}
          onChange={e => setRemark(e.target.value)}
          rows="3"
          className="w-full border rounded-lg px-3 py-2"
          placeholder="请详细说明异常原因、处理措施和对样本的影响评估"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
          取消
        </button>
        <button 
          onClick={() => {
            if (!remark.trim()) {
              alert('请填写复核说明');
              return;
            }
            onSubmit(record, remark);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          确认复核
        </button>
      </div>
    </div>
  );
}

function DestructionForm({ shipment, onSubmit, onClose }) {
  const [form, setForm] = useState({
    destructionDate: new Date().toISOString().split('T')[0],
    destructionMethod: '高压蒸汽灭菌',
    witnessName: '',
    receiptNumber: '',
    remark: ''
  });

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="font-medium">{shipment.shipmentNumber}</div>
        <div className="text-sm text-gray-600">{shipment.batch.sampleName}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">销毁日期 *</label>
          <input 
            type="date"
            value={form.destructionDate}
            onChange={e => setForm({...form, destructionDate: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">销毁方式 *</label>
          <select 
            value={form.destructionMethod}
            onChange={e => setForm({...form, destructionMethod: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option>高压蒸汽灭菌</option>
            <option>焚烧</option>
            <option>化学消毒</option>
            <option>其他</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">见证人 *</label>
          <input 
            type="text"
            value={form.witnessName}
            onChange={e => setForm({...form, witnessName: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="请输入见证人姓名"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">回执编号</label>
          <input 
            type="text"
            value={form.receiptNumber}
            onChange={e => setForm({...form, receiptNumber: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="如有"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
        <textarea 
          value={form.remark}
          onChange={e => setForm({...form, remark: e.target.value})}
          rows="2"
          className="w-full border rounded-lg px-3 py-2"
          placeholder="附件上传位置（占位）"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
          取消
        </button>
        <button 
          onClick={() => {
            if (!form.witnessName) {
              alert('请填写必填项');
              return;
            }
            onSubmit(shipment.id, form);
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          提交回执
        </button>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  const [shipments, setShipments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [tempRecords, setTempRecords] = useState([]);
  const [tempStats, setTempStats] = useState({});
  const [pendingDestructions, setPendingDestructions] = useState([]);

  const [statusFilter, setStatusFilter] = useState('all');
  
  const [detailModal, setDetailModal] = useState({ open: false, shipment: null, history: [] });
  const [createModal, setCreateModal] = useState(false);
  const [approvalModal, setApprovalModal] = useState({ open: false, shipment: null, mode: null });
  const [reviewModal, setReviewModal] = useState({ open: false, record: null });
  const [destructionModal, setDestructionModal] = useState({ open: false, shipment: null });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        sData, bData, iData, rData, tData, tsData, pdData
      ] = await Promise.all([
        apiRequest('/shipments'),
        apiRequest('/batches'),
        apiRequest('/institutions'),
        apiRequest('/recipients'),
        apiRequest('/temperatures'),
        apiRequest('/temperatures/summary'),
        apiRequest('/destructions/pending')
      ]);
      setShipments(sData);
      setBatches(bData);
      setInstitutions(iData);
      setRecipients(rData);
      setTempRecords(tData);
      setTempStats(tsData);
      setPendingDestructions(pdData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = {
    pending: shipments.filter(s => s.status === 'PENDING').length,
    approved: shipments.filter(s => ['APPROVED', 'SHIPPED', 'DELIVERED', 'DESTROYED'].includes(s.status)).length,
    rejected: shipments.filter(s => ['REJECTED', 'CLOSED'].includes(s.status)).length
  };

  const recentShipments = [...shipments].sort((a, b) => 
    new Date(b.applicationDate) - new Date(a.applicationDate)
  ).slice(0, 5);

  const expiredRecipients = recipients.filter(r => r.qualificationStatus === 'expired');

  const handleViewDetail = async (shipment) => {
    try {
      const history = await apiRequest(`/history/${shipment.id}`);
      setDetailModal({ open: true, shipment, history });
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const handleApprove = (shipment) => {
    setApprovalModal({ open: true, shipment, mode: 'approve' });
  };

  const handleReject = (shipment) => {
    setApprovalModal({ open: true, shipment, mode: 'reject' });
  };

  const handleApproveSubmit = async (shipment, remark) => {
    try {
      await apiRequest(`/shipments/${shipment.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ operator: '系统管理员', remark })
      });
      setAlert({ type: 'success', message: '审批通过成功' });
      setApprovalModal({ open: false, shipment: null, mode: null });
      await loadData();
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const handleRejectSubmit = async (shipment, reason) => {
    try {
      await apiRequest(`/shipments/${shipment.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ operator: '系统管理员', reason })
      });
      setAlert({ type: 'success', message: '审批驳回成功' });
      setApprovalModal({ open: false, shipment: null, mode: null });
      await loadData();
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const handleCreateSubmit = async (formData) => {
    try {
      await apiRequest('/shipments', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setAlert({ type: 'success', message: '申请创建成功' });
      setCreateModal(false);
      await loadData();
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const handleShipmentAction = async (action, shipment) => {
    try {
      if (action === 'export') {
        window.open(`${API_BASE}/export/${shipment.id}?format=zip`, '_blank');
        return;
      }
      if (action === 'destruction') {
        setDetailModal({ ...detailModal, open: false });
        setDestructionModal({ open: true, shipment });
        return;
      }

      const endpoints = {
        ship: `/shipments/${shipment.id}/ship`,
        deliver: `/shipments/${shipment.id}/deliver`,
        close: `/shipments/${shipment.id}/close`
      };

      await apiRequest(endpoints[action], {
        method: 'POST',
        body: JSON.stringify({ operator: '系统管理员' })
      });

      setAlert({ type: 'success', message: '操作成功' });
      setDetailModal({ ...detailModal, open: false });
      await loadData();
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const handleReview = (record) => {
    setReviewModal({ open: true, record });
  };

  const handleReviewSubmit = async (record, remark) => {
    try {
      await apiRequest(`/temperatures/${record.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ operator: '系统管理员', remark })
      });
      setAlert({ type: 'success', message: '复核成功' });
      setReviewModal({ open: false, record: null });
      await loadData();
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const handleDestructionSubmit = async (shipmentId, form) => {
    try {
      await apiRequest('/destructions', {
        method: 'POST',
        body: JSON.stringify({
          shipmentId,
          ...form
        })
      });
      setAlert({ type: 'success', message: '销毁回执提交成功' });
      setDestructionModal({ open: false, shipment: null });
      await loadData();
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const tabs = [
    { key: 'dashboard', label: '仪表盘', icon: '📊' },
    { key: 'shipments', label: '申请列表', icon: '📋' },
    { key: 'temperatures', label: '温控异常', icon: '🌡️' },
    { key: 'qualifications', label: '资质状态', icon: '🎫' },
    { key: 'destructions', label: '销毁回执', icon: '🗑️' }
  ];

  if (loading) return <Loading message="系统加载中..." />;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">系统错误</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500">请确保后端服务已启动并执行了数据库迁移和种子数据</p>
        <button 
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >重试</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🏥</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">药企样本寄送合规管理系统</h1>
                <p className="text-sm text-gray-500">样本全生命周期合规追踪平台</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              操作员: 系统管理员
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {alert && (
          <Alert 
            type={alert.type} 
            message={alert.message} 
            onClose={() => setAlert(null)}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard data={{ 
            stats, 
            recentShipments, 
            tempStats, 
            pendingDestructions,
            expiredRecipients 
          }} />
        )}

        {activeTab === 'shipments' && (
          <ShipmentList
            shipments={shipments}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onViewDetail={handleViewDetail}
            onApprove={handleApprove}
            onReject={handleReject}
            onCreate={() => setCreateModal(true)}
          />
        )}

        {activeTab === 'temperatures' && (
          <TemperatureMonitoring records={tempRecords} onReview={handleReview} />
        )}

        {activeTab === 'qualifications' && (
          <QualificationManagement recipients={recipients} />
        )}

        {activeTab === 'destructions' && (
          <DestructionPending 
            shipments={[
              ...pendingDestructions,
              ...shipments.filter(s => s.destruction)
            ].sort((a, b) => new Date(b.applicationDate) - new Date(a.applicationDate))}
            onUpload={(s) => setDestructionModal({ open: true, shipment: s })}
          />
        )}
      </main>

      <Modal 
        isOpen={detailModal.open} 
        onClose={() => setDetailModal({ open: false, shipment: null, history: [] })}
        title={`申请详情 - ${detailModal.shipment?.shipmentNumber}`}
        size="lg"
      >
        {detailModal.shipment && (
          <ShipmentDetail 
            shipment={detailModal.shipment} 
            history={detailModal.history}
            onClose={() => setDetailModal({ open: false, shipment: null, history: [] })}
            onAction={handleShipmentAction}
          />
        )}
      </Modal>

      <Modal 
        isOpen={createModal} 
        onClose={() => setCreateModal(false)}
        title="新建寄送申请"
        size="md"
      >
        <CreateShipmentForm
          batches={batches}
          institutions={institutions}
          recipients={recipients}
          onSubmit={handleCreateSubmit}
          onCancel={() => setCreateModal(false)}
        />
      </Modal>

      <Modal 
        isOpen={approvalModal.open} 
        onClose={() => setApprovalModal({ open: false, shipment: null, mode: null })}
        title="审批申请"
        size="md"
      >
        {approvalModal.shipment && (
          <ApprovalModal
            shipment={approvalModal.shipment}
            onApprove={handleApproveSubmit}
            onReject={handleRejectSubmit}
            onClose={() => setApprovalModal({ open: false, shipment: null, mode: null })}
          />
        )}
      </Modal>

      <Modal 
        isOpen={reviewModal.open} 
        onClose={() => setReviewModal({ open: false, record: null })}
        title="复核温控异常"
        size="md"
      >
        {reviewModal.record && (
          <ReviewModal
            record={reviewModal.record}
            onSubmit={handleReviewSubmit}
            onClose={() => setReviewModal({ open: false, record: null })}
          />
        )}
      </Modal>

      <Modal 
        isOpen={destructionModal.open} 
        onClose={() => setDestructionModal({ open: false, shipment: null })}
        title="上传销毁回执"
        size="md"
      >
        {destructionModal.shipment && (
          <DestructionForm
            shipment={destructionModal.shipment}
            onSubmit={handleDestructionSubmit}
            onClose={() => setDestructionModal({ open: false, shipment: null })}
          />
        )}
      </Modal>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
