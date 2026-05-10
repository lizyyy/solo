import { useState, useEffect } from 'react';
import { api, formatDateTime } from '../api';
import { Rider, EquipmentItem, STATUS_LABELS } from '../types';
import { Link } from 'react-router-dom';

interface Props {
  onRefresh: () => void;
}

const DEFAULT_EQUIPMENT: EquipmentItem[] = [
  { name: '头盔', status: 'ok' },
  { name: '前后灯', status: 'ok' },
  { name: '反光条', status: 'ok' },
  { name: '维修工具', status: 'ok' }
];

export default function EquipmentCheckPage({ onRefresh }: Props) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [searchBib, setSearchBib] = useState('');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [checkerName, setCheckerName] = useState('');
  const [equipment, setEquipment] = useState<EquipmentItem[]>([...DEFAULT_EQUIPMENT]);
  const [comments, setComments] = useState('');
  const [approvalComments, setApprovalComments] = useState('');

  const loadRiders = async () => {
    const data = await api.getRiders();
    setRiders(data);
  };

  useEffect(() => {
    loadRiders();
  }, []);

  const handleSearch = async () => {
    if (!searchBib) return;
    try {
      const rider = await api.getRiderByBib(parseInt(searchBib));
      setSelectedRider(rider);
      setEquipment([...DEFAULT_EQUIPMENT]);
      setComments('');
    } catch (e: any) {
      alert(e.message);
      setSelectedRider(null);
    }
  };

  const updateEquipment = (index: number, status: EquipmentItem['status'], notes?: string) => {
    const updated = [...equipment];
    updated[index] = { ...updated[index], status, notes };
    setEquipment(updated);
  };

  const handleSubmit = async (passed: boolean) => {
    if (!selectedRider || !checkerName) {
      alert('请选择骑手并输入检查人员姓名');
      return;
    }

    try {
      const result = await api.recordEquipmentCheck({
        riderId: selectedRider.id,
        items: equipment,
        overallResult: passed ? 'passed' : 'failed',
        checkerName,
        comments: comments || undefined
      });

      if (approvalComments) {
        await api.addApproval({
          relatedType: 'equipment_check',
          relatedId: result.id,
          action: '装备检查审批',
          decision: passed ? 'approved' : 'rejected',
          comments: approvalComments,
          madeBy: checkerName
        });
      }

      setSelectedRider(null);
      setSearchBib('');
      setEquipment([...DEFAULT_EQUIPMENT]);
      setComments('');
      setApprovalComments('');
      loadRiders();
      onRefresh();
      alert(passed ? '装备检查通过' : '装备检查未通过');
    } catch (e: any) {
      alert('提交失败: ' + e.message);
    }
  };

  const pending = riders.filter(r => r.status === 'registered');
  const passed = riders.filter(r => r.status === 'equipment_passed');
  const failed = riders.filter(r => r.status === 'equipment_failed');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">装备检查</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">待检查</div>
          <div className="text-2xl font-bold">{pending.length}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600">已通过</div>
          <div className="text-2xl font-bold text-green-700">{passed.length}</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-sm text-red-600">未通过</div>
          <div className="text-2xl font-bold text-red-700">{failed.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">🔍 搜索骑手进行检查</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">号码布</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                value={searchBib}
                onChange={e => setSearchBib(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1 border rounded px-3 py-2"
                placeholder="输入号码布编号"
              />
              <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">搜索</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">检查人员</label>
            <input 
              type="text" 
              value={checkerName}
              onChange={e => setCheckerName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="输入检查人员姓名"
            />
          </div>
        </div>

        {selectedRider && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-bold text-lg">#{selectedRider.bibNumber} {selectedRider.name}</div>
                {selectedRider.team && <div className="text-sm text-gray-600">{selectedRider.team}</div>}
                <div className="text-sm mt-1">
                  当前状态: <span className={`status-${selectedRider.status}`}>{(STATUS_LABELS as any)[selectedRider.status]}</span>
                </div>
              </div>
              <Link to={`/riders/${selectedRider.id}`} className="text-blue-600 hover:underline">查看详情 →</Link>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {equipment.map((item, index) => (
                <div key={item.name} className="p-3 bg-white rounded border">
                  <div className="font-medium mb-2">{item.name}</div>
                  <div className="flex gap-2">
                    <label className={`flex items-center gap-1 ${item.status === 'ok' ? 'text-green-600' : ''}`}>
                      <input 
                        type="radio" 
                        name={`eq-${index}`} 
                        checked={item.status === 'ok'}
                        onChange={() => updateEquipment(index, 'ok')}
                      /> 正常
                    </label>
                    <label className={`flex items-center gap-1 ${item.status === 'missing' ? 'text-red-600' : ''}`}>
                      <input 
                        type="radio" 
                        name={`eq-${index}`} 
                        checked={item.status === 'missing'}
                        onChange={() => updateEquipment(index, 'missing')}
                      /> 缺失
                    </label>
                    <label className={`flex items-center gap-1 ${item.status === 'damaged' ? 'text-yellow-600' : ''}`}>
                      <input 
                        type="radio" 
                        name={`eq-${index}`} 
                        checked={item.status === 'damaged'}
                        onChange={() => updateEquipment(index, 'damaged')}
                      /> 损坏
                    </label>
                  </div>
                  {item.status !== 'ok' && (
                    <input 
                      type="text" 
                      placeholder="备注..."
                      value={item.notes || ''}
                      onChange={e => updateEquipment(index, item.status, e.target.value)}
                      className="mt-2 w-full border rounded px-2 py-1 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">检查备注</label>
              <textarea 
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={2}
                className="w-full border rounded px-3 py-2"
                placeholder="检查备注（可选）"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">审批意见（将保存到报告中）</label>
              <textarea 
                value={approvalComments}
                onChange={e => setApprovalComments(e.target.value)}
                rows={2}
                className="w-full border rounded px-3 py-2"
                placeholder="填写审批意见，说明通过或拒绝的原因（可选）"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => handleSubmit(false)}
                className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                ❌ 未通过
              </button>
              <button 
                onClick={() => handleSubmit(true)}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                ✅ 通过
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-600">📋 待检查</h2>
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <span className="font-bold">#{r.bibNumber}</span> {r.name}
                  {r.team && <span className="text-gray-500 text-sm ml-2">({r.team})</span>}
                </div>
                <button 
                  onClick={() => { setSearchBib(r.bibNumber.toString()); handleSearch(); }}
                  className="text-blue-600 hover:underline"
                >
                  检查
                </button>
              </div>
            ))}
            {pending.length === 0 && <div className="text-gray-500 text-center py-4">暂无待检查骑手</div>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-600">❌ 未通过</h2>
          <div className="space-y-2">
            {failed.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-red-50 rounded">
                <div>
                  <span className="font-bold">#{r.bibNumber}</span> {r.name}
                  {r.team && <span className="text-gray-500 text-sm ml-2">({r.team})</span>}
                </div>
                <div className="flex gap-2">
                  <Link to={`/riders/${r.id}`} className="text-blue-600 hover:underline">详情</Link>
                  <button 
                    onClick={() => { setSearchBib(r.bibNumber.toString()); handleSearch(); }}
                    className="text-green-600 hover:underline"
                  >
                    重新检查
                  </button>
                </div>
              </div>
            ))}
            {failed.length === 0 && <div className="text-gray-500 text-center py-4">暂无未通过记录</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
