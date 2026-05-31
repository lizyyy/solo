import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Info } from 'lucide-react';
import { usePowerBudgetStore } from '../store/usePowerBudgetStore';
import { TabType } from '../types';
import { TimeSystemBadge } from '../components/TimeSystemBadge';
import { RecordTypeBadge } from '../components/RecordTypeBadge';
import { DataEntryForm } from '../components/DataEntryForm';
import { formatTimeWithSystem, parseTimeWithSystem } from '../utils/timeConverter';

const tabs: { id: TabType; label: string }[] = [
  { id: 'payload', label: '载荷计划' },
  { id: 'fault', label: '故障纪要' },
  { id: 'orbit', label: '轨道根数' },
];

export const DataEntryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('payload');
  const [showForm, setShowForm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [operator] = useState('当前用户');

  const {
    payloadPlans,
    faultRecords,
    orbitElements,
    displayTimeSystem,
    deletePayloadPlan,
    deleteFaultRecord,
    deleteOrbitElement,
    viewMode
  } = usePowerBudgetStore();

  const handleDelete = (id: string, type: TabType) => {
    if (!deleteReason.trim()) {
      alert('请填写删除原因');
      return;
    }
    
    if (type === 'payload') {
      deletePayloadPlan(id, deleteReason, operator);
    } else if (type === 'fault') {
      deleteFaultRecord(id, deleteReason, operator);
    } else {
      deleteOrbitElement(id, deleteReason, operator);
    }
    
    setShowDeleteConfirm(null);
    setDeleteReason('');
  };

  const renderPayloadTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-console-border">
            <th className="text-left py-3 px-4 font-medium text-console-muted">任务名称</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">时间制</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">执行时段</th>
            <th className="text-right py-3 px-4 font-medium text-console-muted">功耗</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">计划类型</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">记录类型</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">操作人</th>
            <th className="text-center py-3 px-4 font-medium text-console-muted">操作</th>
          </tr>
        </thead>
        <tbody>
          {payloadPlans.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-console-muted">
                暂无载荷计划数据
              </td>
            </tr>
          ) : (
            payloadPlans.map(plan => (
              <tr
                key={plan.id}
                className={`border-b border-console-border/50 hover:bg-console-bg/50 transition-colors ${
                  plan.recordType === 'SUPPLEMENT' ? 'bg-console-muted/5' : ''
                } ${selectedRecord === plan.id ? 'bg-eng-blue/10' : ''}`}
                onMouseEnter={() => setSelectedRecord(plan.id)}
                onMouseLeave={() => setSelectedRecord(null)}
              >
                <td className="py-3 px-4">
                  <div className="font-medium">{plan.name}</div>
                  {plan.remark && (
                    <div className="text-xs text-console-muted mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {plan.remark}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <TimeSystemBadge timeSystem={plan.timeSystem} />
                </td>
                <td className="py-3 px-4 font-mono text-xs">
                  <div>{formatTimeWithSystem(parseTimeWithSystem(plan.startTime, plan.timeSystem), displayTimeSystem)}</div>
                  <div className="text-console-muted">→ {formatTimeWithSystem(parseTimeWithSystem(plan.endTime, plan.timeSystem), displayTimeSystem)}</div>
                </td>
                <td className="py-3 px-4 text-right font-mono">{plan.powerConsumption} W</td>
                <td className="py-3 px-4">
                  <span className={`text-xs ${
                    plan.planType === 'ADVANCED' ? 'text-eng-green-light' :
                    plan.planType === 'DELAYED' ? 'text-eng-orange-light' : 'text-console-muted'
                  }`}>
                    {plan.planType === 'NORMAL' ? '常规' : plan.planType === 'ADVANCED' ? '提前' : '推迟'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <RecordTypeBadge recordType={plan.recordType} />
                </td>
                <td className="py-3 px-4 text-console-muted">{plan.operator}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={viewMode === 'snapshot'}
                      className="p-1.5 text-console-muted hover:text-eng-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      disabled={viewMode === 'snapshot'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(plan.id);
                      }}
                      className="p-1.5 text-console-muted hover:text-eng-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderFaultTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-console-border">
            <th className="text-left py-3 px-4 font-medium text-console-muted">故障描述</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">时间制</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">发生时间</th>
            <th className="text-right py-3 px-4 font-medium text-console-muted">持续时长</th>
            <th className="text-right py-3 px-4 font-medium text-console-muted">额外功耗</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">记录类型</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">操作人</th>
            <th className="text-center py-3 px-4 font-medium text-console-muted">操作</th>
          </tr>
        </thead>
        <tbody>
          {faultRecords.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-console-muted">
                暂无故障纪要数据
              </td>
            </tr>
          ) : (
            faultRecords.map(record => (
              <tr
                key={record.id}
                className={`border-b border-console-border/50 hover:bg-console-bg/50 transition-colors ${
                  record.recordType === 'SUPPLEMENT' ? 'bg-console-muted/5' : ''
                }`}
              >
                <td className="py-3 px-4">
                  <div className="font-medium">{record.description}</div>
                  {record.remark && (
                    <div className="text-xs text-console-muted mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {record.remark}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <TimeSystemBadge timeSystem={record.timeSystem} />
                </td>
                <td className="py-3 px-4 font-mono text-xs">
                  {formatTimeWithSystem(parseTimeWithSystem(record.faultTime, record.timeSystem), displayTimeSystem)}
                </td>
                <td className="py-3 px-4 text-right font-mono">{record.duration} min</td>
                <td className="py-3 px-4 text-right font-mono">{record.powerIncrement} W</td>
                <td className="py-3 px-4">
                  <RecordTypeBadge recordType={record.recordType} />
                </td>
                <td className="py-3 px-4 text-console-muted">{record.operator}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={viewMode === 'snapshot'}
                      className="p-1.5 text-console-muted hover:text-eng-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      disabled={viewMode === 'snapshot'}
                      onClick={() => setShowDeleteConfirm(record.id)}
                      className="p-1.5 text-console-muted hover:text-eng-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderOrbitTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-console-border">
            <th className="text-left py-3 px-4 font-medium text-console-muted">参数名称</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">时间制</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">生效时间</th>
            <th className="text-right py-3 px-4 font-medium text-console-muted">改动前</th>
            <th className="text-right py-3 px-4 font-medium text-console-muted">改动后</th>
            <th className="text-center py-3 px-4 font-medium text-console-muted">手工改动</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">记录类型</th>
            <th className="text-left py-3 px-4 font-medium text-console-muted">操作人</th>
            <th className="text-center py-3 px-4 font-medium text-console-muted">操作</th>
          </tr>
        </thead>
        <tbody>
          {orbitElements.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-8 text-center text-console-muted">
                暂无轨道根数数据
              </td>
            </tr>
          ) : (
            orbitElements.map(element => (
              <tr
                key={element.id}
                className={`border-b border-console-border/50 hover:bg-console-bg/50 transition-colors ${
                  element.recordType === 'SUPPLEMENT' ? 'bg-console-muted/5' : ''
                }`}
              >
                <td className="py-3 px-4">
                  <div className="font-medium">{element.parameterName}</div>
                  {element.remark && (
                    <div className="text-xs text-console-muted mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {element.remark}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <TimeSystemBadge timeSystem={element.timeSystem} />
                </td>
                <td className="py-3 px-4 font-mono text-xs">
                  {formatTimeWithSystem(parseTimeWithSystem(element.effectiveTime, element.timeSystem), displayTimeSystem)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-console-muted">{element.oldValue}</td>
                <td className="py-3 px-4 text-right font-mono text-eng-green-light">{element.newValue}</td>
                <td className="py-3 px-4 text-center">
                  {element.isManualChange ? (
                    <span className="text-eng-orange-light text-xs">是</span>
                  ) : (
                    <span className="text-console-muted text-xs">否</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <RecordTypeBadge recordType={element.recordType} />
                </td>
                <td className="py-3 px-4 text-console-muted">{element.operator}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={viewMode === 'snapshot'}
                      className="p-1.5 text-console-muted hover:text-eng-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      disabled={viewMode === 'snapshot'}
                      onClick={() => setShowDeleteConfirm(element.id)}
                      className="p-1.5 text-console-muted hover:text-eng-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">数据录入</h1>
          <p className="text-sm text-console-muted">管理载荷计划、故障纪要和轨道根数数据</p>
        </div>
        <button
          disabled={viewMode === 'snapshot'}
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-eng-blue text-white rounded hover:bg-eng-blue-light transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          新增记录
        </button>
      </div>

      {viewMode === 'snapshot' && (
        <div className="mb-4 p-3 bg-eng-yellow/10 border border-eng-yellow/30 rounded text-sm text-eng-yellow">
          快照模式下无法修改数据，请先退出快照模式
        </div>
      )}

      <div className="bg-console-panel border border-console-border rounded-lg overflow-hidden">
        <div className="flex border-b border-console-border">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-eng-blue-light'
                  : 'text-console-muted hover:text-console-text'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-eng-blue" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'payload' && renderPayloadTable()}
          {activeTab === 'fault' && renderFaultTable()}
          {activeTab === 'orbit' && renderOrbitTable()}
        </div>
      </div>

      {showForm && (
        <DataEntryForm
          tab={activeTab}
          onClose={() => setShowForm(false)}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-console-panel border border-console-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">确认删除</h3>
            <p className="text-sm text-console-muted mb-4">
              删除操作将记录到审计日志，请填写删除原因：
            </p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none mb-4"
              rows={3}
              placeholder="请说明删除原因..."
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setDeleteReason('');
                }}
                className="px-4 py-2 text-sm border border-console-border rounded text-console-muted hover:bg-console-bg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm, activeTab)}
                className="px-4 py-2 text-sm bg-eng-orange text-white rounded hover:bg-eng-orange-light transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
