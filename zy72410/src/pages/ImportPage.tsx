import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { importApi, materialApi } from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import WaveformLoader from '../components/WaveformLoader';
import * as XLSX from 'xlsx';

const sampleBatch1Data = [
  {
    '项目名称': '《山河故人》',
    '素材名称': '山河故人主题曲',
    'ISRC编码': 'CN-A23-24-00001',
    '作曲家': '王宗贤',
    '授权起始日期': '2024-01-01',
    '授权截止日期': '2026-12-31',
    '集数': '40',
    '授权费用(万元)': '120',
    '分成比例': '30%',
    '误差说明': '±5秒内可接受',
    '轨道名称': '主题曲',
    '轨道编号': '1',
  },
  {
    '项目名称': '《山河故人》',
    '素材名称': '山河故人片尾曲',
    'ISRC编码': 'CN-A23-24-00002',
    '作曲家': '王宗贤',
    '授权起始日期': '2024-01-01',
    '授权截止日期': '2026-12-31',
    '集数': '40',
    '授权费用(万元)': '80',
    '分成比例': '25%',
    '误差说明': '±3秒内可接受',
    '轨道名称': '片尾曲',
    '轨道编号': '2',
  },
  {
    '项目名称': '《山河故人》',
    '素材名称': '山河故人插曲',
    'ISRC编码': 'CN-A23-24-00003',
    '作曲家': '王宗贤',
    '授权起始日期': '2024-01-01',
    '授权截止日期': '2026-12-31',
    '集数': '40',
    '授权费用(万元)': '60',
    '分成比例': '20%',
    '误差说明': '±5秒内可接受',
    '轨道名称': '插曲',
    '轨道编号': '3',
  },
];

const sampleBatch2Data = [
  {
    '项目名称': '《山河故人》',
    '素材名称': '山河故人主题曲',
    'ISRC编码': 'CN-A23-24-00001',
    '作曲家': '王宗贤',
    '授权起始日期': '2024-01-01',
    '授权截止日期': '2026-12-31',
    '集数': '40',
    '授权费用(万元)': '120',
    '分成比例': '30%',
    '误差说明': '±5秒内可接受',
    '轨道名称': '主题曲',
    '轨道编号': '1',
  },
  {
    '项目名称': '《山河故人》',
    '素材名称': '山河故人主题曲新版',
    'ISRC编码': 'CN-A23-24-00004',
    '作曲家': '王宗贤',
    '授权起始日期': '2024-06-01',
    '授权截止日期': '2026-12-31',
    '集数': '40',
    '授权费用(万元)': '150',
    '分成比例': '35%',
    '误差说明': '±3秒内可接受',
    '轨道名称': '主题曲新版',
    '轨道编号': '4',
  },
];

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const { importPreview, setImportPreview, setLoading, loading, showNotification, setMaterials, addMaterial } = useStore();

  const loadSampleData = (batch: number) => {
    const data = batch === 1 ? sampleBatch1Data : sampleBatch2Data;
    setParsedData(data);
    setFileName(batch === 1 ? '示例数据_第一批_正常.xlsx' : '示例数据_第二批_含重复.xlsx');
    showNotification('success', `已加载${batch === 1 ? '第一批' : '第二批'}示例数据，共 ${data.length} 条记录`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        setParsedData(jsonData);
        showNotification('success', `文件解析成功，共 ${jsonData.length} 条记录`);
      } catch (error) {
        showNotification('error', '文件解析失败，请检查格式');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePreview = async () => {
    if (!parsedData || !fileName) return;
    setLoading('import-preview', true);
    try {
      const result = await importApi.preview(parsedData, fileName);
      setImportPreview(result);
      showNotification('success', `预览完成: 新增 ${result.new_items.length} 条，复用 ${result.reused_items.length} 条，疑似 ${result.suspected_duplicates.length} 条`);
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('import-preview', false);
    }
  };

  const handleConfirm = async () => {
    if (!importPreview) return;
    setLoading('import-confirm', true);
    try {
      const allPreviewItems = [
        ...importPreview.new_items,
        ...importPreview.reused_items,
      ];
      const selectedIds = allPreviewItems.map(i => i.temp_id);

      const items = allPreviewItems.map(item => ({
        material: {
          material_name: item.material_name,
          isrc_code: item.isrc_code,
          composer: item.composer || '',
          project_name: item.project_name || '',
          license_start_date: item.license_start_date,
          license_end_date: item.license_end_date,
          episode_count: item.episode_count || 0,
          license_fee: item.license_fee || 0,
          revenue_ratio: item.revenue_ratio || '0',
          error_tolerance: item.error_tolerance || '',
        },
        tracks: item.track_name ? [{
          track_name: item.track_name,
          track_number: item.track_number || 1,
          track_type: '音乐轨',
          isrc_code: item.isrc_code,
          remarks: '',
        }] : [],
      }));

      const result = await importApi.confirm({
        batch_id: importPreview.batch_id,
        selected_ids: selectedIds,
        action: 'confirm',
        items,
      }, '版权运营');
      
      showNotification('success', `导入成功: 新增 ${result.stats?.new_count || 0} 条，复用 ${result.stats?.reused_count || 0} 条，轨道 ${result.tracks?.length || 0} 条`);
      
      const allMaterials = await materialApi.getAll();
      setMaterials(allMaterials);
      
      setImportPreview(null);
      setParsedData(null);
      setFileName('');
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('import-confirm', false);
    }
  };

  const statusMap: Record<string, 'reused' | 'new' | 'conflict'> = {
    reused: 'reused',
    new: 'new',
    duplicate: 'conflict',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-display text-studio-gold mb-2">授权期限页导入</h2>
        <p className="text-studio-silver text-sm">上传授权期限Excel，系统自动检测重复、区分复用和新增记录</p>
      </div>

      <div className="divider-wave" />

      {!parsedData ? (
        <div className="space-y-6">
          <div className="card-studio p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <div className="flex justify-center gap-4 mb-6">
              <button onClick={() => loadSampleData(1)} className="btn-outline">
                📋 加载第一批示例（3条正常）
              </button>
              <button onClick={() => loadSampleData(2)} className="btn-outline">
                🔄 加载第二批示例（含重复）
              </button>
            </div>

            <div className="text-studio-silver mb-4">或</div>

            <button onClick={() => fileInputRef.current?.click()} className="btn-studio">
              📁 上传Excel/CSV文件
            </button>
          </div>

          <div className="card-studio p-6">
            <h3 className="text-lg font-display text-white mb-3">📋 导入说明</h3>
            <ul className="space-y-2 text-sm text-studio-silver">
              <li className="flex items-start gap-2">
                <span className="text-studio-gold">•</span>
                支持列：项目名称、素材名称、ISRC编码、作曲家、授权起止日期、集数、授权费用、分成比例、误差说明、轨道信息
              </li>
              <li className="flex items-start gap-2">
                <span className="text-studio-gold">•</span>
                重复检测维度：素材名称 + ISRC编码 + 授权起始日期，三项全中标记为复用
              </li>
              <li className="flex items-start gap-2">
                <span className="text-studio-gold">•</span>
                同一批导入第二次时，页面和报告会明确区分复用记录和新增记录
              </li>
              <li className="flex items-start gap-2">
                <span className="text-studio-gold">•</span>
                第一批3条正常数据模拟首次导入，第二批1条复用+1条新增模拟重复导入场景
              </li>
            </ul>
          </div>
        </div>
      ) : !importPreview ? (
        <div className="space-y-6">
          <div className="card-studio p-4 flex items-center justify-between">
            <div>
              <p className="text-studio-gold font-mono">📄 {fileName}</p>
              <p className="text-sm text-studio-silver">共 {parsedData.length} 条记录待检测</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setParsedData(null); setFileName(''); }}
                className="btn-outline text-sm"
              >
                重新选择
              </button>
              <button
                onClick={handlePreview}
                disabled={loading['import-preview']}
                className="btn-studio text-sm"
              >
                {loading['import-preview'] ? '检测中...' : '🔍 检测重复并预览'}
              </button>
            </div>
          </div>

          {loading['import-preview'] && <WaveformLoader text="正在进行重复检测..." />}

          <div className="card-studio overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-studio-darker">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">素材名称</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">ISRC编码</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">授权起始</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">集数</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">费用(万)</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">分成</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row, idx) => (
                    <tr key={idx} className="border-t border-studio-gray hover:bg-studio-gray/30">
                      <td className="px-4 py-3 text-sm text-white font-mono">{row['素材名称']}</td>
                      <td className="px-4 py-3 text-sm text-studio-silver font-mono">{row['ISRC编码']}</td>
                      <td className="px-4 py-3 text-sm text-studio-silver font-mono">{row['授权起始日期']}</td>
                      <td className="px-4 py-3 text-sm text-studio-silver font-mono">{row['集数']}</td>
                      <td className="px-4 py-3 text-sm text-studio-silver font-mono">{row['授权费用(万元)']}</td>
                      <td className="px-4 py-3 text-sm text-studio-silver font-mono">{row['分成比例']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="card-studio p-4 text-center">
              <p className="text-3xl font-display text-status-new">{importPreview.new_items.length}</p>
              <p className="text-sm text-studio-silver">新增记录</p>
            </div>
            <div className="card-studio p-4 text-center">
              <p className="text-3xl font-display text-status-reused">{importPreview.reused_items.length}</p>
              <p className="text-sm text-studio-silver">复用记录</p>
            </div>
            <div className="card-studio p-4 text-center">
              <p className="text-3xl font-display text-status-conflict">{importPreview.suspected_duplicates.length}</p>
              <p className="text-sm text-studio-silver">疑似冲突</p>
            </div>
          </div>

          {importPreview.new_items.length > 0 && (
            <div className="card-studio p-5">
              <h3 className="text-lg font-display text-status-new mb-4">✨ 新增记录</h3>
              <div className="space-y-2">
                {importPreview.new_items.map((item) => (
                  <div key={item.temp_id} className="flex items-center justify-between bg-studio-darker p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <StatusBadge status="new" />
                      <span className="text-white font-mono">{item.material_name}</span>
                      <span className="text-studio-silver text-sm">{item.isrc_code}</span>
                    </div>
                    <span className="text-xs text-studio-gold font-mono">
                      {item.license_start_date} ~ {item.license_end_date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importPreview.reused_items.length > 0 && (
            <div className="card-studio p-5">
              <h3 className="text-lg font-display text-status-reused mb-4">🔄 复用记录（已存在，将跳过导入）</h3>
              <div className="space-y-2">
                {importPreview.reused_items.map((item) => (
                  <div key={item.temp_id} className="flex items-center justify-between bg-studio-darker p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <StatusBadge status="reused" />
                      <span className="text-white font-mono">{item.material_name}</span>
                      <span className="text-studio-silver text-sm">{item.isrc_code}</span>
                    </div>
                    <span className="text-xs text-studio-silver font-mono">
                      已存在ID: {item.existing_id?.substring(0, 8)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importPreview.suspected_duplicates.length > 0 && (
            <div className="card-studio p-5">
              <h3 className="text-lg font-display text-status-conflict mb-4">⚠️ 疑似冲突（2项匹配，需人工确认）</h3>
              <div className="space-y-2">
                {importPreview.suspected_duplicates.map((item) => (
                  <div key={item.temp_id} className="flex items-center justify-between bg-studio-darker p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <StatusBadge status="conflict" />
                      <span className="text-white font-mono">{item.material_name}</span>
                      <span className="text-studio-silver text-sm">{item.isrc_code}</span>
                    </div>
                    <span className="text-xs text-status-conflict font-mono">
                      匹配维度: {item.match_dimensions?.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setImportPreview(null)}
              className="btn-outline text-sm"
            >
              返回修改
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading['import-confirm']}
              className="btn-studio text-sm"
            >
              {loading['import-confirm'] ? '导入中...' : '✓ 确认入库'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
