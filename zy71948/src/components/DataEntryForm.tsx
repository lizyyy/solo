import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { TimeSystem, RecordType, TabType } from '../types';
import { usePowerBudgetStore } from '../store/usePowerBudgetStore';

interface DataEntryFormProps {
  tab: TabType;
  onClose: () => void;
}

const timeSystemOptions: { value: TimeSystem; label: string }[] = [
  { value: 'UTC', label: 'UTC - 协调世界时' },
  { value: 'TAI', label: 'TAI - 国际原子时' },
  { value: 'BEIJING', label: 'BT - 北京时间' },
];

const planTypeOptions = [
  { value: 'NORMAL', label: '常规计划' },
  { value: 'ADVANCED', label: '计划提前' },
  { value: 'DELAYED', label: '计划推迟' },
];

const recordTypeOptions = [
  { value: 'REAL_CHANGE', label: '真修改 - 实际改动计划' },
  { value: 'SUPPLEMENT', label: '补材料 - 仅补录记录' },
];

const faultRecordTypeOptions = [
  { value: 'FAULT_OCCUR', label: '故障发生 - 实时记录' },
  { value: 'SUPPLEMENT', label: '补材料 - 后补纪要' },
];

export const DataEntryForm: React.FC<DataEntryFormProps> = ({ tab, onClose }) => {
  const addPayloadPlan = usePowerBudgetStore(state => state.addPayloadPlan);
  const addFaultRecord = usePowerBudgetStore(state => state.addFaultRecord);
  const addOrbitElement = usePowerBudgetStore(state => state.addOrbitElement);

  const [formData, setFormData] = useState({
    name: '',
    timeSystem: 'UTC' as TimeSystem,
    startTime: '',
    endTime: '',
    powerConsumption: '',
    planType: 'NORMAL' as 'NORMAL' | 'ADVANCED' | 'DELAYED',
    recordType: 'REAL_CHANGE' as RecordType | 'FAULT_OCCUR',
    description: '',
    faultTime: '',
    duration: '',
    powerIncrement: '',
    parameterName: '',
    effectiveTime: '',
    oldValue: '',
    newValue: '',
    isManualChange: false,
    operator: '',
    remark: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.operator) {
      alert('请填写操作人');
      return;
    }

    if (tab === 'payload') {
      if (!formData.name || !formData.startTime || !formData.endTime || !formData.powerConsumption) {
        alert('请填写完整的载荷计划信息');
        return;
      }
      addPayloadPlan({
        name: formData.name,
        timeSystem: formData.timeSystem,
        startTime: formData.startTime,
        endTime: formData.endTime,
        powerConsumption: parseFloat(formData.powerConsumption),
        planType: formData.planType,
        recordType: formData.recordType as RecordType,
        operator: formData.operator,
        remark: formData.remark,
      });
    } else if (tab === 'fault') {
      if (!formData.description || !formData.faultTime || !formData.duration) {
        alert('请填写完整的故障纪要信息');
        return;
      }
      addFaultRecord({
        description: formData.description,
        timeSystem: formData.timeSystem,
        faultTime: formData.faultTime,
        duration: parseInt(formData.duration),
        powerIncrement: parseFloat(formData.powerIncrement) || 0,
        recordType: formData.recordType,
        operator: formData.operator,
        remark: formData.remark,
      });
    } else if (tab === 'orbit') {
      if (!formData.parameterName || !formData.effectiveTime || !formData.oldValue || !formData.newValue) {
        alert('请填写完整的轨道根数信息');
        return;
      }
      addOrbitElement({
        parameterName: formData.parameterName,
        timeSystem: formData.timeSystem,
        effectiveTime: formData.effectiveTime,
        oldValue: parseFloat(formData.oldValue),
        newValue: parseFloat(formData.newValue),
        isManualChange: formData.isManualChange,
        recordType: formData.recordType as RecordType,
        operator: formData.operator,
        remark: formData.remark,
      });
    }
    
    onClose();
  };

  const renderFormFields = () => {
    if (tab === 'payload') {
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-console-muted mb-1">任务名称 *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：高分辨率相机成像"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">时间制 *</label>
              <select
                name="timeSystem"
                value={formData.timeSystem}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              >
                {timeSystemOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">开始时间 *</label>
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">结束时间 *</label>
              <input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">功耗 (W) *</label>
              <input
                type="number"
                name="powerConsumption"
                value={formData.powerConsumption}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：120"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">计划类型</label>
              <select
                name="planType"
                value={formData.planType}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              >
                {planTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      );
    } else if (tab === 'fault') {
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-console-muted mb-1">故障描述 *</label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：姿态传感器异常波动"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">时间制 *</label>
              <select
                name="timeSystem"
                value={formData.timeSystem}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              >
                {timeSystemOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">故障发生时间 *</label>
              <input
                type="datetime-local"
                name="faultTime"
                value={formData.faultTime}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">持续时长 (分钟) *</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：45"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">额外功耗 (W)</label>
              <input
                type="number"
                name="powerIncrement"
                value={formData.powerIncrement}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：30"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-console-muted mb-1">记录类型</label>
              <select
                name="recordType"
                value={formData.recordType}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              >
                {faultRecordTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      );
    } else {
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-console-muted mb-1">参数名称 *</label>
              <input
                type="text"
                name="parameterName"
                value={formData.parameterName}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：半长轴、eclipse"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">时间制 *</label>
              <select
                name="timeSystem"
                value={formData.timeSystem}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              >
                {timeSystemOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">生效时间 *</label>
              <input
                type="datetime-local"
                name="effectiveTime"
                value={formData.effectiveTime}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  name="isManualChange"
                  checked={formData.isManualChange}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-console-border bg-console-bg text-eng-blue focus:ring-eng-blue"
                />
                <span className="text-sm text-console-text">手工改动</span>
              </label>
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">改动前数值 *</label>
              <input
                type="number"
                step="0.001"
                name="oldValue"
                value={formData.oldValue}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：6878.135"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">改动后数值 *</label>
              <input
                type="number"
                step="0.001"
                name="newValue"
                value={formData.newValue}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：6878.142"
              />
            </div>
          </div>
        </>
      );
    }
  };

  const getRecordTypeOptions = () => {
    if (tab === 'fault') return faultRecordTypeOptions;
    return recordTypeOptions;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-console-panel border border-console-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-console-border">
          <h2 className="text-lg font-bold">
            {tab === 'payload' && '新增载荷计划'}
            {tab === 'fault' && '新增故障纪要'}
            {tab === 'orbit' && '新增轨道根数'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-console-bg rounded transition-colors"
          >
            <X className="w-5 h-5 text-console-muted" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {renderFormFields()}
          
          {tab !== 'fault' && (
            <div>
              <label className="block text-sm text-console-muted mb-1">记录类型</label>
              <select
                name="recordType"
                value={formData.recordType}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
              >
                {getRecordTypeOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-console-muted mb-1">操作人 *</label>
              <input
                type="text"
                name="operator"
                value={formData.operator}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="例如：张工"
              />
            </div>
            <div>
              <label className="block text-sm text-console-muted mb-1">备注</label>
              <input
                type="text"
                name="remark"
                value={formData.remark}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                placeholder="修改原因、背景说明等"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-console-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-console-border rounded text-console-muted hover:bg-console-bg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-eng-blue text-white rounded hover:bg-eng-blue-light transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              确认添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
