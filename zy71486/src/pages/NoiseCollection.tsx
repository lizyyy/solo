import { useState, useRef, useMemo, Fragment } from 'react';
import { useStore } from '@/store/useStore';
import type { ImportBatch } from '@/types';
import { DECIBEL_THRESHOLD } from '@/types';
import { parseCSV, parseJSON, mapNoiseRows } from '@/utils/csvParser';
import { sampleNoiseCSV } from '@/data/sampleData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Upload, FileText, Database, Filter, AlertTriangle, RefreshCw } from 'lucide-react';

const ROOM_COLORS = ['#e8a838', '#27ae60', '#3498db', '#e74c3c', '#9b59b6', '#1abc9c', '#f39c12', '#e67e22'];

export default function NoiseCollection() {
  const noiseRecords = useStore((s) => s.noiseRecords);
  const rooms = useStore((s) => s.rooms);
  const courses = useStore((s) => s.courses);
  const conflicts = useStore((s) => s.conflicts);
  const importNoiseData = useStore((s) => s.importNoiseData);
  const loadSampleData = useStore((s) => s.loadSampleData);

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportBatch | null>(null);
  const [showSample, setShowSample] = useState(false);
  const [filterRoom, setFilterRoom] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [dbMin, setDbMin] = useState('');
  const [dbMax, setDbMax] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clickedPoint, setClickedPoint] = useState<{ roomId: string; date: string; decibel: number } | null>(null);

  const activeRecords = useMemo(() => noiseRecords.filter((r) => !r.isDuplicate), [noiseRecords]);
  const uniqueRooms = useMemo(() => [...new Set(activeRecords.map((r) => r.roomId))].sort(), [activeRecords]);
  const roomNameMap = useMemo(() => Object.fromEntries(rooms.map((r) => [r.roomId, r.name])), [rooms]);
  const conflictIds = useMemo(() => new Set(conflicts.map((c) => c.noiseRecordId)), [conflicts]);

  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | string>>();
    for (const r of activeRecords) {
      if (!dateMap.has(r.date)) dateMap.set(r.date, { date: r.date });
      dateMap.get(r.date)![r.roomId] = r.decibel;
    }
    return [...dateMap.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [activeRecords]);

  const hasCourse = (r: typeof activeRecords[number]) => {
    const d = new Date(r.date);
    const wd = String(d.getDay() || 7);
    return courses.some((c) => c.roomId === r.roomId && c.weekday === wd && c.startTime <= r.startTime && c.endTime > r.startTime);
  };

  const filtered = useMemo(() => {
    return activeRecords.filter((r) => {
      if (filterRoom && r.roomId !== filterRoom) return false;
      if (dateStart && r.date < dateStart) return false;
      if (dateEnd && r.date > dateEnd) return false;
      if (dbMin && r.decibel < Number(dbMin)) return false;
      if (dbMax && r.decibel > Number(dbMax)) return false;
      return true;
    });
  }, [activeRecords, filterRoom, dateStart, dateEnd, dbMin, dbMax]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFile = (text: string, ext: string) => {
    const rows = ext === 'json' ? parseJSON(text) : parseCSV(text);
    const mapped = mapNoiseRows(rows as Record<string, string>[]);
    if (!mapped.length) return;
    setImportResult(importNoiseData(mapped));
  };

  const readFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'csv';
    const reader = new FileReader();
    reader.onload = (ev) => handleFile(ev.target?.result as string, ext);
    reader.readAsText(file);
  };

  const onLoadSample = () => {
    loadSampleData();
    setImportResult({
      id: 'sample', sourceType: 'NOISE', totalCount: 15,
      newCount: 15, updatedCount: 0, duplicateCount: 0,
      importedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <section className="card-base p-5">
        <h2 className="text-amber font-mono font-bold text-lg mb-4 flex items-center gap-2">
          <Upload size={20} /> 数据导入
        </h2>
        <div className="flex gap-4 flex-wrap">
          <div
            className={`flex-1 min-w-[280px] border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragActive ? 'border-amber bg-amber-muted' : 'border-base-500 hover:border-amber/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); readFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
          >
            <FileText size={32} className="text-amber/60 mb-2" />
            <p className="text-sm text-gray-400">拖放 CSV / JSON 文件到此处，或点击上传</p>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) readFile(e.target.files[0]); e.target.value = ''; }} />
          </div>
          <div className="flex flex-col gap-3 justify-center">
            <button onClick={onLoadSample} className="flex items-center gap-2 px-4 py-2.5 bg-amber-muted text-amber rounded-lg hover:bg-amber/25 transition-colors text-sm font-medium">
              <Database size={16} /> 加载样例
            </button>
            <button onClick={() => setShowSample(!showSample)} className="flex items-center gap-2 px-4 py-2.5 bg-base-700 text-gray-300 rounded-lg hover:bg-base-600 transition-colors text-sm">
              <FileText size={16} /> 查看样例格式
            </button>
          </div>
        </div>
        {showSample && (
          <pre className="mt-4 p-3 bg-base-900 rounded-lg text-xs font-mono text-gray-400 overflow-x-auto">{sampleNoiseCSV}</pre>
        )}
        {importResult && (
          <div className="mt-4 flex gap-4 text-sm">
            <span className="text-success">新增 {importResult.newCount}</span>
            <span className="text-amber">更新 {importResult.updatedCount}</span>
            <span className="text-gray-500">重复 {importResult.duplicateCount}</span>
          </div>
        )}
      </section>

      <section className="card-base p-5">
        <h2 className="text-amber font-mono font-bold text-lg mb-4 flex items-center gap-2">
          <AlertTriangle size={20} /> 噪声趋势
        </h2>
        {chartData.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">暂无数据，请先导入噪声记录</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} onClick={(e) => {
                if (e?.activePayload?.length) {
                  const p = e.activePayload[0];
                  setClickedPoint({ roomId: String(p.dataKey), date: String(p.payload.date), decibel: Number(p.value) });
                }
              }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e52" />
                <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} />
                <YAxis stroke="#666" tick={{ fontSize: 12 }} domain={[40, 100]} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2e2e52', borderRadius: 8, color: '#e0e0e8' }} />
                <Legend />
                <ReferenceLine y={DECIBEL_THRESHOLD} stroke="#c0392b" strokeDasharray="8 4" label={{ value: `${DECIBEL_THRESHOLD}dB`, fill: '#c0392b', fontSize: 12 }} />
                {uniqueRooms.map((roomId, i) => (
                  <Line key={roomId} type="monotone" dataKey={roomId} stroke={ROOM_COLORS[i % ROOM_COLORS.length]} strokeWidth={2} dot={{ r: 4, cursor: 'pointer' }} name={roomNameMap[roomId] || roomId} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
            {clickedPoint && (
              <div className="mt-2 p-3 bg-base-900 rounded-lg text-sm flex items-center gap-2">
                <span className="text-amber font-mono">{roomNameMap[clickedPoint.roomId] || clickedPoint.roomId}</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-300">{clickedPoint.date}</span>
                <span className="text-gray-600">|</span>
                <span className={clickedPoint.decibel > DECIBEL_THRESHOLD ? 'text-danger font-mono font-bold' : 'text-success font-mono'}>
                  {clickedPoint.decibel} dB
                </span>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card-base p-5">
        <h2 className="text-amber font-mono font-bold text-lg mb-4 flex items-center gap-2">
          <Filter size={20} /> 投诉记录
        </h2>
        <div className="flex gap-3 flex-wrap mb-4">
          <select value={filterRoom} onChange={(e) => { setFilterRoom(e.target.value); setPage(1); }} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300">
            <option value="">全部房间</option>
            {uniqueRooms.map((r) => <option key={r} value={r}>{roomNameMap[r] || r}</option>)}
          </select>
          <input type="date" value={dateStart} onChange={(e) => { setDateStart(e.target.value); setPage(1); }} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300" />
          <input type="date" value={dateEnd} onChange={(e) => { setDateEnd(e.target.value); setPage(1); }} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300" />
          <input type="number" placeholder="最小dB" value={dbMin} onChange={(e) => { setDbMin(e.target.value); setPage(1); }} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-24" />
          <input type="number" placeholder="最大dB" value={dbMax} onChange={(e) => { setDbMax(e.target.value); setPage(1); }} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-24" />
          <button onClick={() => { setFilterRoom(''); setDateStart(''); setDateEnd(''); setDbMin(''); setDbMax(''); setPage(1); }} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-amber transition-colors">
            <RefreshCw size={14} /> 重置
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-base-600/50">
                <th className="pb-2 pr-3">房间</th>
                <th className="pb-2 pr-3">日期</th>
                <th className="pb-2 pr-3">时间</th>
                <th className="pb-2 pr-3">分贝</th>
                <th className="pb-2 pr-3">投诉来源</th>
                <th className="pb-2 pr-3">关联状态</th>
                <th className="pb-2">标记</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-base-600/30 hover:bg-base-700/50 cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <td className="py-2.5 pr-3 font-mono text-amber">{roomNameMap[r.roomId] || r.roomId}</td>
                    <td className="py-2.5 pr-3">{r.date}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{r.startTime}-{r.endTime}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-base-900 rounded-full overflow-hidden">
                          <div className="h-full meter-bar rounded-full" style={{ width: `${Math.min(100, r.decibel)}%` }} />
                        </div>
                        <span className={`font-mono text-xs ${r.decibel > DECIBEL_THRESHOLD ? 'text-danger' : 'text-success'}`}>{r.decibel}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400">{r.complaintSource}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex gap-1 flex-wrap">
                        {rooms.some((rm) => rm.roomId === r.roomId)
                          ? <span className="px-1.5 py-0.5 bg-success-muted text-success text-xs rounded">房间</span>
                          : <span className="px-1.5 py-0.5 bg-danger-muted text-danger text-xs rounded">无房间</span>}
                        {hasCourse(r) && <span className="px-1.5 py-0.5 bg-amber-muted text-amber text-xs rounded">课程</span>}
                        {conflictIds.has(r.id) && <span className="px-1.5 py-0.5 bg-danger-muted text-danger text-xs rounded">冲突</span>}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        {r.isUpdate && <span className="px-1.5 py-0.5 bg-amber-muted text-amber text-xs rounded">更新</span>}
                        {r.isDuplicate && <span className="px-1.5 py-0.5 bg-base-700 text-gray-500 text-xs rounded">重复</span>}
                      </div>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-2 bg-base-900/60 text-gray-400 text-sm border-b border-base-600/30">
                        {r.description || '无描述'}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>共 {filtered.length} 条</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded bg-base-700 disabled:opacity-30 hover:bg-base-600 transition-colors">上一页</button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded bg-base-700 disabled:opacity-30 hover:bg-base-600 transition-colors">下一页</button>
          </div>
        </div>
      </section>
    </div>
  );
}
