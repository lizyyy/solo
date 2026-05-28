import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { Passenger, Seat, PaidSeat, CompanionGroup, RebookingRecord } from '@/types';
import { validateAll } from '@/utils/validation';
import { generateSampleData } from '@/utils/report';
import { Users, LayoutGrid, CreditCard, Users2, RefreshCw, AlertCircle, CheckCircle, Play, Trash2, Plus, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type TabType = 'passengers' | 'seatmap' | 'paid' | 'companion' | 'rebooking';

export default function DataInputPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('passengers');
  const {
    passengers,
    seatMap,
    paidSeats,
    companionGroups,
    rebookingRecords,
    setPassengers,
    setSeatMap,
    setPaidSeats,
    setCompanionGroups,
    setRebookingRecords,
    setValidationErrors,
    validationErrors,
  } = useAppStore();

  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [editingPaidSeat, setEditingPaidSeat] = useState<PaidSeat | null>(null);
  const [editingCompanion, setEditingCompanion] = useState<CompanionGroup | null>(null);
  const [editingRebooking, setEditingRebooking] = useState<RebookingRecord | null>(null);

  const handleLoadSample = () => {
    const sample = generateSampleData();
    setPassengers(sample.passengers);
    setSeatMap(sample.seatMap);
    setPaidSeats(sample.paidSeats);
    setCompanionGroups(sample.companionGroups);
    setRebookingRecords(sample.rebookingRecords);
  };

  const handleValidate = () => {
    const errors = validateAll(passengers, seatMap, paidSeats, companionGroups, rebookingRecords);
    setValidationErrors(errors);
    return errors;
  };

  const handleProceed = () => {
    const errors = validateAll(passengers, seatMap, paidSeats, companionGroups, rebookingRecords);
    setValidationErrors(errors);
    const fatalErrors = errors.filter((e) => e.severity === 'error');
    if (fatalErrors.length === 0) {
      navigate('/compute');
    }
  };

  const handleSeatClick = (seat: Seat) => {
    if (!seatMap) return;

    const newSeats = seatMap.seats.map((s) =>
      s.seatId === seat.seatId
        ? {
            ...s,
            status: (s.status === 'available' ? 'blocked' : s.status === 'blocked' ? 'occupied' : 'available') as
              | 'available'
              | 'occupied'
              | 'blocked',
          }
        : s
    );

    setSeatMap({ ...seatMap, seats: newSeats });
  };

  const tabs = [
    { id: 'passengers', label: '乘客名单', icon: Users, count: passengers.length },
    { id: 'seatmap', label: '座位图', icon: LayoutGrid, count: seatMap?.seats.length || 0 },
    { id: 'paid', label: '付费座位', icon: CreditCard, count: paidSeats.length },
    { id: 'companion', label: '同行关系', icon: Users2, count: companionGroups.length },
    { id: 'rebooking', label: '改签记录', icon: RefreshCw, count: rebookingRecords.length },
  ];

  const errorCount = validationErrors.filter((e) => e.severity === 'error').length;
  const warningCount = validationErrors.filter((e) => e.severity === 'warning').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-primary-800">数据输入</h1>
          <p className="text-primary-600 mt-1">录入航班乘客、座位图、付费座位、同行关系和改签记录</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleLoadSample}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            加载示例数据
          </button>
          <button
            onClick={handleValidate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            校验数据
          </button>
          <button
            onClick={handleProceed}
            className="flex items-center gap-2 px-6 py-2 bg-accent-400 text-primary-800 rounded-lg hover:bg-accent-500 transition-colors font-medium shadow-md"
          >
            <Play className="w-4 h-4" />
            开始计算
          </button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-warning-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-warning-500" />
            <h3 className="font-semibold text-warning-800">数据校验结果</h3>
            <span className="px-2 py-1 bg-warning-100 text-warning-700 text-xs rounded-full">
              {errorCount} 个错误
            </span>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
              {warningCount} 个警告
            </span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {validationErrors.map((err, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-2 text-sm p-2 rounded',
                  err.severity === 'error' ? 'bg-warning-50 text-warning-800' : 'bg-yellow-50 text-yellow-800'
                )}
              >
                <span>{err.severity === 'error' ? '❌' : '⚠️'}</span>
                <span>{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    'flex items-center gap-2 px-6 py-4 border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-accent-400 text-primary-700 bg-primary-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'passengers' && (
            <PassengersTab
              passengers={passengers}
              setPassengers={setPassengers}
              editingPassenger={editingPassenger}
              setEditingPassenger={setEditingPassenger}
            />
          )}
          {activeTab === 'seatmap' && (
            <SeatMapTab seatMap={seatMap} setSeatMap={setSeatMap} onSeatClick={handleSeatClick} />
          )}
          {activeTab === 'paid' && (
            <PaidSeatsTab
              paidSeats={paidSeats}
              setPaidSeats={setPaidSeats}
              passengers={passengers}
              seatMap={seatMap}
              editingPaidSeat={editingPaidSeat}
              setEditingPaidSeat={setEditingPaidSeat}
            />
          )}
          {activeTab === 'companion' && (
            <CompanionTab
              companionGroups={companionGroups}
              setCompanionGroups={setCompanionGroups}
              passengers={passengers}
              editingCompanion={editingCompanion}
              setEditingCompanion={setEditingCompanion}
            />
          )}
          {activeTab === 'rebooking' && (
            <RebookingTab
              rebookingRecords={rebookingRecords}
              setRebookingRecords={setRebookingRecords}
              passengers={passengers}
              editingRebooking={editingRebooking}
              setEditingRebooking={setEditingRebooking}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PassengersTab({
  passengers,
  setPassengers,
  editingPassenger,
  setEditingPassenger,
}: {
  passengers: Passenger[];
  setPassengers: (p: Passenger[]) => void;
  editingPassenger: Passenger | null;
  setEditingPassenger: (p: Passenger | null) => void;
}) {
  const handleAdd = () => {
    const newId = `P${String(passengers.length + 1).padStart(3, '0')}`;
    setEditingPassenger({
      id: newId,
      name: '',
      currentSeat: '',
      cabinClass: '经济舱',
    });
  };

  const handleSave = (p: Passenger) => {
    const exists = passengers.find((x) => x.id === p.id);
    if (exists) {
      setPassengers(passengers.map((x) => (x.id === p.id ? p : x)));
    } else {
      setPassengers([...passengers, p]);
    }
    setEditingPassenger(null);
  };

  const handleDelete = (id: string) => {
    setPassengers(passengers.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-primary-700">乘客名单</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 text-sm"
        >
          <Plus className="w-4 h-4" />
          添加乘客
        </button>
      </div>

      {editingPassenger && (
        <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
          <PassengerForm passenger={editingPassenger} onSave={handleSave} onCancel={() => setEditingPassenger(null)} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-600">乘客ID</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">姓名</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">当前座位</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">舱位</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-mono text-primary-600">{p.id}</td>
                <td className="py-3 px-4">{p.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded font-mono">
                    {p.currentSeat}
                  </span>
                </td>
                <td className="py-3 px-4">{p.cabinClass}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => setEditingPassenger(p)} className="text-primary-600 hover:text-primary-800 mr-2">
                    编辑
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-warning-600 hover:text-warning-800">
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PassengerForm({
  passenger,
  onSave,
  onCancel,
}: {
  passenger: Passenger;
  onSave: (p: Passenger) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(passenger);

  return (
    <div className="grid grid-cols-4 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">乘客ID</label>
        <input
          type="text"
          value={form.id}
          onChange={(e) => setForm({ ...form, id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">姓名</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">当前座位</label>
        <input
          type="text"
          value={form.currentSeat}
          onChange={(e) => setForm({ ...form, currentSeat: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">舱位</label>
        <select
          value={form.cabinClass}
          onChange={(e) => setForm({ ...form, cabinClass: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        >
          <option>经济舱</option>
          <option>超级经济舱</option>
          <option>商务舱</option>
          <option>头等舱</option>
        </select>
      </div>
      <div className="col-span-4 flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          取消
        </button>
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function SeatMapTab({
  seatMap,
  setSeatMap,
  onSeatClick,
}: {
  seatMap: import('@/types').SeatMap | null;
  setSeatMap: (s: import('@/types').SeatMap | null) => void;
  onSeatClick: (seat: Seat) => void;
}) {
  const [rows, setRows] = useState(seatMap?.rows || 15);
  const [cols, setCols] = useState(seatMap?.cols.join('') || 'ABCDEF');

  const handleGenerate = () => {
    const colArray = cols.split('');
    const seats: Seat[] = [];
    for (let r = 1; r <= rows; r++) {
      for (const c of colArray) {
        const cabinClass = r <= 3 ? '商务舱' : r <= 6 ? '超级经济舱' : '经济舱';
        seats.push({
          seatId: `${r}${c}`,
          row: r,
          col: c,
          status: 'available',
          cabinClass,
        });
      }
    }
    setSeatMap({
      id: 'SM001',
      rows,
      cols: colArray,
      seats,
    });
  };

  const getSeatColor = (status: string) => {
    switch (status) {
      case 'occupied':
        return 'bg-primary-500 text-white';
      case 'blocked':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">行数</label>
          <input
            type="number"
            value={rows}
            onChange={(e) => setRows(parseInt(e.target.value) || 10)}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
            min="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">列字母</label>
          <input
            type="text"
            value={cols}
            onChange={(e) => setCols(e.target.value.toUpperCase())}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="self-end">
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            生成座位图
          </button>
        </div>
        <div className="self-end ml-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>可用</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary-500 rounded"></div>
            <span>已占</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded"></div>
            <span>锁定</span>
          </div>
        </div>
      </div>

      {seatMap && (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex justify-center mb-4">
              <div className="text-sm text-gray-500">← 机头方向</div>
            </div>
            {Array.from({ length: seatMap.rows }, (_, r) => r + 1).map((row) => (
              <div key={row} className="flex items-center justify-center gap-2 mb-1">
                <span className="w-8 text-right text-sm text-gray-500">{row}</span>
                {seatMap.cols.slice(0, 3).map((col) => {
                  const seat = seatMap.seats.find((s) => s.row === row && s.col === col);
                  return seat ? (
                    <button
                      key={seat.seatId}
                      onClick={() => onSeatClick(seat)}
                      className={cn(
                        'w-10 h-10 rounded text-sm font-medium transition-colors',
                        getSeatColor(seat.status)
                      )}
                    >
                      {col}
                    </button>
                  ) : null;
                })}
                <div className="w-6"></div>
                {seatMap.cols.slice(3).map((col) => {
                  const seat = seatMap.seats.find((s) => s.row === row && s.col === col);
                  return seat ? (
                    <button
                      key={seat.seatId}
                      onClick={() => onSeatClick(seat)}
                      className={cn(
                        'w-10 h-10 rounded text-sm font-medium transition-colors',
                        getSeatColor(seat.status)
                      )}
                    >
                      {col}
                    </button>
                  ) : null;
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PaidSeatsTab({
  paidSeats,
  setPaidSeats,
  passengers,
  seatMap,
  editingPaidSeat,
  setEditingPaidSeat,
}: {
  paidSeats: PaidSeat[];
  setPaidSeats: (p: PaidSeat[]) => void;
  passengers: Passenger[];
  seatMap: import('@/types').SeatMap | null;
  editingPaidSeat: PaidSeat | null;
  setEditingPaidSeat: (p: PaidSeat | null) => void;
}) {
  const handleAdd = () => {
    setEditingPaidSeat({
      seatId: '',
      fee: 0,
      passengerId: '',
    });
  };

  const handleSave = (p: PaidSeat) => {
    const exists = paidSeats.find((x) => x.seatId === p.seatId);
    if (exists) {
      setPaidSeats(paidSeats.map((x) => (x.seatId === p.seatId ? p : x)));
    } else {
      setPaidSeats([...paidSeats, p]);
    }
    setEditingPaidSeat(null);
  };

  const handleDelete = (seatId: string) => {
    setPaidSeats(paidSeats.filter((p) => p.seatId !== seatId));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-primary-700">付费座位</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 text-sm"
        >
          <Plus className="w-4 h-4" />
          添加付费座位
        </button>
      </div>

      {editingPaidSeat && (
        <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
          <PaidSeatForm
            paidSeat={editingPaidSeat}
            passengers={passengers}
            seatMap={seatMap}
            onSave={handleSave}
            onCancel={() => setEditingPaidSeat(null)}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-600">座位号</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">乘客</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">费用 (¥)</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {paidSeats.map((p) => {
              const passenger = passengers.find((x) => x.id === p.passengerId);
              return (
                <tr key={p.seatId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-accent-100 text-accent-700 rounded font-mono">
                      {p.seatId}
                    </span>
                  </td>
                  <td className="py-3 px-4">{passenger?.name || p.passengerId}</td>
                  <td className="py-3 px-4 font-semibold text-accent-600">¥{p.fee}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setEditingPaidSeat(p)} className="text-primary-600 hover:text-primary-800 mr-2">
                      编辑
                    </button>
                    <button onClick={() => handleDelete(p.seatId)} className="text-warning-600 hover:text-warning-800">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaidSeatForm({
  paidSeat,
  passengers,
  seatMap,
  onSave,
  onCancel,
}: {
  paidSeat: PaidSeat;
  passengers: Passenger[];
  seatMap: import('@/types').SeatMap | null;
  onSave: (p: PaidSeat) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(paidSeat);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">座位号</label>
        <select
          value={form.seatId}
          onChange={(e) => setForm({ ...form, seatId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">选择座位</option>
          {seatMap?.seats.map((s) => (
            <option key={s.seatId} value={s.seatId}>
              {s.seatId}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">乘客</label>
        <select
          value={form.passengerId}
          onChange={(e) => setForm({ ...form, passengerId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">选择乘客</option>
          {passengers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">费用 (¥)</label>
        <input
          type="number"
          value={form.fee}
          onChange={(e) => setForm({ ...form, fee: parseInt(e.target.value) || 0 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          min="0"
        />
      </div>
      <div className="col-span-3 flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          取消
        </button>
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function CompanionTab({
  companionGroups,
  setCompanionGroups,
  passengers,
  editingCompanion,
  setEditingCompanion,
}: {
  companionGroups: CompanionGroup[];
  setCompanionGroups: (g: CompanionGroup[]) => void;
  passengers: Passenger[];
  editingCompanion: CompanionGroup | null;
  setEditingCompanion: (g: CompanionGroup | null) => void;
}) {
  const handleAdd = () => {
    const newId = `G${String(companionGroups.length + 1).padStart(3, '0')}`;
    setEditingCompanion({
      groupId: newId,
      passengerIds: [],
      priority: 'medium',
    });
  };

  const handleSave = (g: CompanionGroup) => {
    const exists = companionGroups.find((x) => x.groupId === g.groupId);
    if (exists) {
      setCompanionGroups(companionGroups.map((x) => (x.groupId === g.groupId ? g : x)));
    } else {
      setCompanionGroups([...companionGroups, g]);
    }
    setEditingCompanion(null);
  };

  const handleDelete = (groupId: string) => {
    setCompanionGroups(companionGroups.filter((g) => g.groupId !== groupId));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-primary-700">同行关系</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 text-sm"
        >
          <Plus className="w-4 h-4" />
          添加同行组
        </button>
      </div>

      {editingCompanion && (
        <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
          <CompanionForm
            group={editingCompanion}
            passengers={passengers}
            companionGroups={companionGroups}
            onSave={handleSave}
            onCancel={() => setEditingCompanion(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companionGroups.map((g) => {
          const groupPassengers = g.passengerIds
            .map((id) => passengers.find((p) => p.id === id))
            .filter(Boolean) as Passenger[];
          const priorityColors = {
            high: 'bg-red-100 text-red-700',
            medium: 'bg-yellow-100 text-yellow-700',
            low: 'bg-green-100 text-green-700',
          };
          return (
            <div key={g.groupId} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-primary-700">{g.groupId}</h4>
                  <span className={cn('text-xs px-2 py-0.5 rounded', priorityColors[g.priority])}>
                    {g.priority === 'high' ? '高优先级' : g.priority === 'medium' ? '中优先级' : '低优先级'}
                  </span>
                </div>
                <div>
                  <button onClick={() => setEditingCompanion(g)} className="text-primary-600 hover:text-primary-800 mr-2">
                    编辑
                  </button>
                  <button onClick={() => handleDelete(g.groupId)} className="text-warning-600 hover:text-warning-800">
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {groupPassengers.map((p) => (
                  <span key={p.id} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                    {p.name}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">{g.passengerIds.length} 人同行</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompanionForm({
  group,
  passengers,
  companionGroups,
  onSave,
  onCancel,
}: {
  group: CompanionGroup;
  passengers: Passenger[];
  companionGroups: CompanionGroup[];
  onSave: (g: CompanionGroup) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(group);
  const usedPassengerIds = new Set(
    companionGroups.flatMap((g) => (g.groupId !== group.groupId ? g.passengerIds : []))
  );
  const availablePassengers = passengers.filter((p) => !usedPassengerIds.has(p.id));

  const togglePassenger = (pid: string) => {
    if (form.passengerIds.includes(pid)) {
      setForm({ ...form, passengerIds: form.passengerIds.filter((id) => id !== pid) });
    } else {
      setForm({ ...form, passengerIds: [...form.passengerIds, pid] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">组ID</label>
          <input
            type="text"
            value={form.groupId}
            onChange={(e) => setForm({ ...form, groupId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">优先级</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as 'high' | 'medium' | 'low' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">选择乘客</label>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
          {availablePassengers.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePassenger(p.id)}
              className={cn(
                'px-3 py-1 rounded-full text-sm transition-colors',
                form.passengerIds.includes(p.id)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">已选择 {form.passengerIds.length} 人</p>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          取消
        </button>
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function RebookingTab({
  rebookingRecords,
  setRebookingRecords,
  passengers,
  editingRebooking,
  setEditingRebooking,
}: {
  rebookingRecords: RebookingRecord[];
  setRebookingRecords: (r: RebookingRecord[]) => void;
  passengers: Passenger[];
  editingRebooking: RebookingRecord | null;
  setEditingRebooking: (r: RebookingRecord | null) => void;
}) {
  const handleAdd = () => {
    const newId = `R${String(rebookingRecords.length + 1).padStart(3, '0')}`;
    setEditingRebooking({
      id: newId,
      passengerId: '',
      originalSeat: '',
      targetFlight: '',
    });
  };

  const handleSave = (r: RebookingRecord) => {
    const exists = rebookingRecords.find((x) => x.id === r.id);
    if (exists) {
      setRebookingRecords(rebookingRecords.map((x) => (x.id === r.id ? r : x)));
    } else {
      setRebookingRecords([...rebookingRecords, r]);
    }
    setEditingRebooking(null);
  };

  const handleDelete = (id: string) => {
    setRebookingRecords(rebookingRecords.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-primary-700">改签记录</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 text-sm"
        >
          <Plus className="w-4 h-4" />
          添加改签记录
        </button>
      </div>

      {editingRebooking && (
        <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
          <RebookingForm
            record={editingRebooking}
            passengers={passengers}
            onSave={handleSave}
            onCancel={() => setEditingRebooking(null)}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-600">记录ID</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">乘客</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">原座位</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">目标航班</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {rebookingRecords.map((r) => {
              const passenger = passengers.find((p) => p.id === r.passengerId);
              return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-primary-600">{r.id}</td>
                  <td className="py-3 px-4">{passenger?.name || r.passengerId}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-warning-100 text-warning-700 rounded font-mono">
                      {r.originalSeat}
                    </span>
                  </td>
                  <td className="py-3 px-4">{r.targetFlight}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setEditingRebooking(r)} className="text-primary-600 hover:text-primary-800 mr-2">
                      编辑
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="text-warning-600 hover:text-warning-800">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RebookingForm({
  record,
  passengers,
  onSave,
  onCancel,
}: {
  record: RebookingRecord;
  passengers: Passenger[];
  onSave: (r: RebookingRecord) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(record);

  const handlePassengerChange = (pid: string) => {
    const passenger = passengers.find((p) => p.id === pid);
    setForm({
      ...form,
      passengerId: pid,
      originalSeat: passenger?.currentSeat || '',
    });
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">记录ID</label>
        <input
          type="text"
          value={form.id}
          onChange={(e) => setForm({ ...form, id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">乘客</label>
        <select
          value={form.passengerId}
          onChange={(e) => handlePassengerChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">选择乘客</option>
          {passengers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">原座位</label>
        <input
          type="text"
          value={form.originalSeat}
          onChange={(e) => setForm({ ...form, originalSeat: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">目标航班</label>
        <input
          type="text"
          value={form.targetFlight}
          onChange={(e) => setForm({ ...form, targetFlight: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="如 CA1234"
        />
      </div>
      <div className="col-span-4 flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          取消
        </button>
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          保存
        </button>
      </div>
    </div>
  );
}
