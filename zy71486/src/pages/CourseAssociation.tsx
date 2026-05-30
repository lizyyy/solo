import { useState, useRef, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import type { ConflictType, ImportBatch } from '@/types';
import { CONFLICT_LABELS } from '@/types';
import { parseCSV, parseJSON, mapRoomRows, mapCourseRows } from '@/utils/csvParser';
import { sampleRoomCSV, sampleCourseCSV } from '@/data/sampleData';
import { Upload, FileText, AlertTriangle, CheckCircle, Link2, Building2, BookOpen } from 'lucide-react';

const TYPE_COLORS: Record<ConflictType, string> = {
  TIME_MISMATCH: 'bg-amber-muted text-amber',
  ROOM_NOT_FOUND: 'bg-danger-muted text-danger',
  DATA_INCONSISTENT: 'bg-amber-muted text-amber',
};

function ImportCard({
  title, icon: Icon, sampleCSV, mapRows, doImport, onFileParsed,
}: {
  title: string; icon: React.ElementType; sampleCSV: string;
  mapRows: (rows: Record<string, string>[]) => Record<string, string>[];
  doImport: (rows: Record<string, string>[]) => ImportBatch;
  onFileParsed: (batch: ImportBatch) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<ImportBatch | null>(null);
  const [showSample, setShowSample] = useState(false);

  const handleText = (text: string, ext: string) => {
    const rows = ext === 'json' ? parseJSON(text) : parseCSV(text);
    const mapped = mapRows(rows as Record<string, string>[]);
    if (!mapped.length) return;
    const batch = doImport(mapped as any);
    setResult(batch);
    onFileParsed(batch);
  };

  const readFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'csv';
    const reader = new FileReader();
    reader.onload = (ev) => handleText(ev.target?.result as string, ext);
    reader.readAsText(file);
  };

  return (
    <div className="card-base p-5 flex-1 min-w-[300px]">
      <h3 className="text-amber font-mono font-bold flex items-center gap-2 mb-4">
        <Icon size={18} /> {title}
      </h3>
      <div
        className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragActive ? 'border-amber bg-amber-muted' : 'border-base-500 hover:border-amber/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); readFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={28} className="text-amber/60 mb-2" />
        <p className="text-sm text-gray-400">拖放 CSV / JSON 文件，或点击上传</p>
        <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) readFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
      <button onClick={() => setShowSample(!showSample)} className="mt-3 text-xs text-gray-400 hover:text-amber transition-colors flex items-center gap-1">
        <FileText size={12} /> 查看样例格式
      </button>
      {showSample && (
        <pre className="mt-2 p-3 bg-base-900 rounded-lg text-xs font-mono text-gray-400 overflow-x-auto">{sampleCSV}</pre>
      )}
      {result && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-success">新增 {result.newCount}</span>
          <span className="text-amber">更新 {result.updatedCount}</span>
          <span className="text-gray-500">重复 {result.duplicateCount}</span>
        </div>
      )}
    </div>
  );
}

export default function CourseAssociation() {
  const noiseRecords = useStore((s) => s.noiseRecords);
  const rooms = useStore((s) => s.rooms);
  const courses = useStore((s) => s.courses);
  const conflicts = useStore((s) => s.conflicts);
  const importRoomData = useStore((s) => s.importRoomData);
  const importCourseData = useStore((s) => s.importCourseData);
  const detectConflicts = useStore((s) => s.detectConflicts);
  const resolveConflict = useStore((s) => s.resolveConflict);

  const [hasImported, setHasImported] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const activeRecords = useMemo(() => noiseRecords.filter((r) => !r.isDuplicate), [noiseRecords]);

  const unresolved = useMemo(() => conflicts.filter((c) => !c.isResolved), [conflicts]);
  const resolved = useMemo(() => conflicts.filter((c) => c.isResolved), [conflicts]);

  const typeCounts = useMemo(() => {
    const counts: Record<ConflictType, number> = { TIME_MISMATCH: 0, ROOM_NOT_FOUND: 0, DATA_INCONSISTENT: 0 };
    for (const c of unresolved) counts[c.type]++;
    return counts;
  }, [unresolved]);

  const associationStats = useMemo(() => {
    let hasRoom = 0, hasCourse = 0, hasBoth = 0, hasNeither = 0;
    for (const r of activeRecords) {
      const roomOk = rooms.some((rm) => rm.roomId === r.roomId);
      const d = new Date(r.date);
      const wd = String(d.getDay() || 7);
      const courseOk = courses.some((c) => c.roomId === r.roomId && c.weekday === wd);
      if (roomOk && courseOk) hasBoth++;
      else if (roomOk) hasRoom++;
      else if (courseOk) hasCourse++;
      else hasNeither++;
    }
    return { hasRoom, hasCourse, hasBoth, hasNeither, total: activeRecords.length };
  }, [activeRecords, rooms, courses]);

  const roomCourseTable = useMemo(() => {
    const map = new Map<string, { name: string; courses: { name: string; teacher: string; weekday: string }[] }>();
    for (const rm of rooms) {
      map.set(rm.roomId, { name: rm.name, courses: [] });
    }
    for (const c of courses) {
      if (!map.has(c.roomId)) map.set(c.roomId, { name: c.roomId, courses: [] });
      map.get(c.roomId)!.courses.push({ name: c.courseName, teacher: c.teacher, weekday: c.weekday });
    }
    return [...map.entries()];
  }, [rooms, courses]);

  const handleResolve = (id: string) => {
    if (!resolutionText.trim()) return;
    resolveConflict(id, resolutionText.trim());
    setResolvingId(null);
    setResolutionText('');
  };

  const getNoiseRecord = (id: string) => noiseRecords.find((r) => r.id === id);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <section>
        <h2 className="text-amber font-mono font-bold text-lg mb-4 flex items-center gap-2">
          <Upload size={20} /> 数据导入
        </h2>
        <div className="flex gap-4 flex-wrap">
          <ImportCard
            title="课程表导入" icon={BookOpen} sampleCSV={sampleCourseCSV}
            mapRows={mapCourseRows} doImport={importCourseData} onFileParsed={() => setHasImported(true)}
          />
          <ImportCard
            title="房间信息导入" icon={Building2} sampleCSV={sampleRoomCSV}
            mapRows={mapRoomRows} doImport={importRoomData} onFileParsed={() => setHasImported(true)}
          />
        </div>
        {hasImported && (
          <button onClick={() => detectConflicts()} className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-amber text-base-900 font-bold rounded-lg hover:bg-amber/90 transition-colors text-sm">
            <AlertTriangle size={16} /> 检测冲突
          </button>
        )}
      </section>

      <section className="card-base p-5">
        <h2 className="text-amber font-mono font-bold text-lg mb-4 flex items-center gap-2">
          <Link2 size={20} /> 关联匹配
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: '房间+课程', value: associationStats.hasBoth, color: 'text-success' },
            { label: '仅房间', value: associationStats.hasRoom, color: 'text-amber' },
            { label: '仅课程', value: associationStats.hasCourse, color: 'text-blue-400' },
            { label: '无关联', value: associationStats.hasNeither, color: 'text-danger' },
          ].map((s) => (
            <div key={s.label} className="bg-base-900 rounded-lg p-3 text-center">
              <div className={`font-mono font-bold text-xl ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-base-600/50">
                <th className="pb-2 pr-3">房间编号</th>
                <th className="pb-2 pr-3">房间名称</th>
                <th className="pb-2">关联课程</th>
              </tr>
            </thead>
            <tbody>
              {roomCourseTable.map(([roomId, info]) => (
                <tr key={roomId} className="border-b border-base-600/30">
                  <td className="py-2 pr-3 font-mono text-amber">{roomId}</td>
                  <td className="py-2 pr-3">{info.name}</td>
                  <td className="py-2">
                    {info.courses.length === 0
                      ? <span className="text-gray-600">无课程</span>
                      : <div className="flex flex-wrap gap-1">
                          {info.courses.map((c, i) => (
                            <span key={i} className="px-2 py-0.5 bg-amber-muted text-amber text-xs rounded">
                              {c.name} ({c.teacher})
                            </span>
                          ))}
                        </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-base p-5">
        <h2 className="text-amber font-mono font-bold text-lg mb-4 flex items-center gap-2">
          <AlertTriangle size={20} /> 冲突检测
        </h2>
        <div className="flex gap-4 flex-wrap mb-5">
          <div className="bg-base-900 rounded-lg px-4 py-2 text-center">
            <div className="font-mono font-bold text-xl text-danger">{unresolved.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">总冲突</div>
          </div>
          {(Object.entries(typeCounts) as [ConflictType, number][]).map(([type, count]) => (
            <div key={type} className="bg-base-900 rounded-lg px-4 py-2 text-center">
              <div className="font-mono font-bold text-xl">{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{CONFLICT_LABELS[type]}</div>
            </div>
          ))}
        </div>

        {unresolved.length === 0 && resolved.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">暂无冲突，请先导入数据并点击"检测冲突"</p>
        )}

        <div className="space-y-3">
          {unresolved.map((c) => {
            const record = getNoiseRecord(c.noiseRecordId);
            return (
              <div key={c.id} className="bg-base-900 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${TYPE_COLORS[c.type]}`}>
                        {CONFLICT_LABELS[c.type]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-2">{c.description}</p>
                    {record && (
                      <p className="text-xs text-gray-500">
                        关联噪声记录：{record.roomId} | {record.date} {record.startTime}-{record.endTime} | {record.decibel}dB
                      </p>
                    )}
                  </div>
                  <button onClick={() => { setResolvingId(c.id); setResolutionText(''); }} className="shrink-0 px-3 py-1.5 text-xs bg-amber-muted text-amber rounded hover:bg-amber/25 transition-colors">
                    解决
                  </button>
                </div>
                {resolvingId === c.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={resolutionText} onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="输入解决方案..."
                      className="flex-1 bg-base-700 border border-base-600/50 rounded px-3 py-1.5 text-sm text-gray-300"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleResolve(c.id); }}
                    />
                    <button onClick={() => handleResolve(c.id)} className="px-3 py-1.5 text-xs bg-success-muted text-success rounded hover:bg-success/25 transition-colors">
                      确认
                    </button>
                    <button onClick={() => setResolvingId(null)} className="px-3 py-1.5 text-xs bg-base-700 text-gray-400 rounded hover:bg-base-600 transition-colors">
                      取消
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {resolved.length > 0 && (
          <div className="mt-5">
            <button onClick={() => setShowResolved(!showResolved)} className="text-sm text-gray-400 hover:text-amber transition-colors flex items-center gap-1">
              <CheckCircle size={14} /> 已解决冲突 ({resolved.length}) {showResolved ? '▲' : '▼'}
            </button>
            {showResolved && (
              <div className="mt-3 space-y-2">
                {resolved.map((c) => (
                  <div key={c.id} className="bg-base-900/60 rounded-lg p-3 opacity-60">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={14} className="text-success" />
                      <span className="px-2 py-0.5 text-xs rounded font-medium bg-success-muted text-success">{CONFLICT_LABELS[c.type]}</span>
                    </div>
                    <p className="text-sm text-gray-400">{c.description}</p>
                    <p className="text-xs text-success mt-1">解决方案：{c.resolution}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
