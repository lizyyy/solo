import { useEffect, useState, useCallback } from 'react';
import {
  FileSpreadsheet, FileText, Download, Calendar, Users,
  Loader2, CheckCircle2, History, ChevronDown
} from 'lucide-react';
import { useClassStore } from '@/store/useClassStore';
import { db } from '@/db';
import { generateExportData, executeExport, generatePreviewData } from '@/utils/export';
import { EXPORT_FIELDS, ExportConfig } from '@/types';

interface ExportHistoryItem { id: string; filename: string; format: string; count: number; createdAt: Date; }

export default function Export() {
  const { classes, loadClasses } = useClassStore();
  const [classId, setClassId] = useState('');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fields, setFields] = useState<string[]>(EXPORT_FIELDS.filter(f => f.required).map(f => f.key));
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [includeGaps, setIncludeGaps] = useState(false);
  const [includeIssues, setIncludeIssues] = useState(false);
  const [includeColors, setIncludeColors] = useState(false);
  const [preview, setPreview] = useState<{ headers: string[]; data: string[][] } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  useEffect(() => {
    loadClasses();
    const saved = localStorage.getItem('exportHistory');
    if (saved) setHistory(JSON.parse(saved).map((h: ExportHistoryItem) => ({ ...h, createdAt: new Date(h.createdAt) })));
  }, [loadClasses]);

  useEffect(() => {
    if (classId) db.getClassWithStudents(classId).then(r => { if (r) setStudents(r.students.map(s => ({ id: s.id, name: s.name }))); });
    else { setStudents([]); setStudentIds([]); }
  }, [classId]);

  const buildConfig = (): ExportConfig => ({
    classId, studentIds: studentIds.length > 0 ? studentIds : undefined,
    startDate, endDate, fields, format, includeGaps, includeIssues, includeColors
  });

  const fetchRows = (c: ExportConfig) => generateExportData(
    c, (id) => db.classes.get(id), (id) => db.students.get(id), (id) => db.works.get(id),
    (workId) => db.workVersions.where('workId').equals(workId).reverse().sortBy('importedAt'),
    (versionId) => db.getVersionWithAnalysis(versionId)
  );

  const generatePreview = useCallback(async () => {
    if (studentIds.length === 0 && !classId) { setPreview(null); return; }
    try {
      const config: ExportConfig = {
        classId, studentIds: studentIds.length > 0 ? studentIds : undefined,
        startDate, endDate, fields, format, includeGaps, includeIssues, includeColors
      };
      const rows = await fetchRows(config);
      setPreview(generatePreviewData(rows, fields));
    } catch { setPreview(null); }
  }, [studentIds, classId, startDate, endDate, fields, format, includeGaps, includeIssues, includeColors]);

  useEffect(() => { generatePreview(); }, [generatePreview]);

  const handleExport = async () => {
    if (!preview || preview.data.length === 0) return;
    setIsExporting(true); setExportProgress(0);
    try {
      const config = buildConfig();
      const rows = await fetchRows(config);
      setExportProgress(50);
      await new Promise(r => setTimeout(r, 500));
      executeExport(config, rows);
      setExportProgress(100);
      const newHistory = [{
        id: Date.now().toString(), filename: `配色点评报告.${format}`,
        format: format.toUpperCase(), count: rows.length, createdAt: new Date()
      }, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('exportHistory', JSON.stringify(newHistory));
      setTimeout(() => { setIsExporting(false); setExportProgress(0); }, 1000);
    } catch { setIsExporting(false); setExportProgress(0); }
  };

  const toggleStudent = (id: string) => setStudentIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const toggleField = (key: string, required: boolean) => {
    if (required) return;
    setFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  };

  const selectedNames = students.filter(s => studentIds.includes(s.id)).map(s => s.name).join(', ');
  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500";
  const checkboxClass = "rounded border-slate-300 text-indigo-600 focus:ring-indigo-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">报告导出</h1>
        <p className="text-slate-600">导出配色点评数据报告</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />导出配置
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>班级（可选）</label>
                  <select value={classId} onChange={e => setClassId(e.target.value)} className={inputClass}>
                    <option value="">全部班级</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>学生（多选）</label>
                  <div className="relative">
                    <button onClick={() => setShowStudentDropdown(!showStudentDropdown)} disabled={students.length === 0}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-left flex items-center justify-between disabled:bg-slate-100">
                      <span className={selectedNames ? 'text-slate-900' : 'text-slate-400'}>
                        {selectedNames || (students.length === 0 ? '请先选择班级' : '选择学生')}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                    {showStudentDropdown && students.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {students.map(s => (
                          <label key={s.id} className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} className={`mr-2 ${checkboxClass}`} />
                            <span className="text-sm text-slate-700">{s.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}><Calendar className="w-4 h-4" />开始日期</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}><Calendar className="w-4 h-4" />结束日期</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={`${labelClass} mb-2`}>导出字段</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {EXPORT_FIELDS.map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={fields.includes(f.key)} onChange={() => toggleField(f.key, f.required)} disabled={f.required} className={`${checkboxClass} disabled:opacity-50`} />
                      <span className={f.required ? 'text-slate-900 font-medium' : 'text-slate-700'}>{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={`${labelClass} mb-2`}>导出格式</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="format" value="xlsx" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} className={checkboxClass} />
                    <FileSpreadsheet className="w-4 h-4 text-green-600" /><span className="text-sm text-slate-700">Excel</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="format" value="csv" checked={format === 'csv'} onChange={() => setFormat('csv')} className={checkboxClass} />
                    <FileText className="w-4 h-4 text-blue-600" /><span className="text-sm text-slate-700">CSV</span>
                  </label>
                </div>
              </div>
              <div>
                <label className={`${labelClass} mb-2`}>包含内容</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeGaps} onChange={e => setIncludeGaps(e.target.checked)} className={checkboxClass} /><span className="text-sm text-slate-700">数据缺口</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeIssues} onChange={e => setIncludeIssues(e.target.checked)} className={checkboxClass} /><span className="text-sm text-slate-700">问题详情</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeColors} onChange={e => setIncludeColors(e.target.checked)} className={checkboxClass} /><span className="text-sm text-slate-700">颜色数据</span></label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">数据预览（前10行）</h2>
              {preview && <span className="text-sm text-slate-500">共 {preview.data.length} 条记录</span>}
            </div>
            {!preview ? <div className="text-center py-12 text-slate-500"><Users className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p>请选择班级或学生以预览数据</p></div> :
             preview.data.length === 0 ? <div className="text-center py-12 text-slate-500"><p>暂无符合条件的数据</p></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200">
                    {preview.headers.map((h, i) => <th key={i} className="text-left py-3 px-3 font-medium text-slate-600 bg-slate-50">{h}</th>)}
                  </tr></thead>
                  <tbody>{preview.data.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      {row.map((cell, j) => <td key={j} className="py-3 px-3 text-slate-700">{cell}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">导出报告</h3>
                <p className="text-sm text-slate-500 mt-1">{preview ? `将导出 ${preview.data.length} 条记录` : '请先配置导出条件'}</p>
              </div>
              <button onClick={handleExport} disabled={!preview || preview.data.length === 0 || isExporting}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors">
                {isExporting ? <><Loader2 className="w-5 h-5 animate-spin" />导出中 {exportProgress}%</> :
                 exportProgress === 100 ? <><CheckCircle2 className="w-5 h-5" />导出成功</> :
                 <><Download className="w-5 h-5" />导出 {format.toUpperCase()}</>}
              </button>
            </div>
            {isExporting && <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${exportProgress}%` }} /></div>}
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><History className="w-5 h-5" />导出历史</h2>
            {history.length === 0 ? <div className="text-center py-8 text-slate-500"><p className="text-sm">暂无导出记录</p></div> : (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.format === 'XLSX' ? <FileSpreadsheet className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 text-blue-600" />}
                        <span className="text-sm font-medium text-slate-700 truncate max-w-32">{item.filename}</span>
                      </div>
                      <span className="text-xs text-slate-500">{item.count}条</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
