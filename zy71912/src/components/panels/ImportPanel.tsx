import { useState, useRef } from 'react';
import { useTimelineStore } from '@/store/useTimelineStore';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Upload, FileJson, FileSpreadsheet, CheckCircle, AlertCircle, Clock, Copy, X } from 'lucide-react';
import type { ImportResult } from '@/types';

const SAMPLE_GUEST_CSV = `type,startTime,duration,title,description,status,meta.speakerName
guest,0,180,开场介绍,主持人开场介绍,confirmed,张明
guest,200,420,话题讨论,AI在内容创作中的应用,confirmed,李华`;

const SAMPLE_GUEST_JSON = `[
  {
    "type": "guest",
    "startTime": 0,
    "duration": 180,
    "title": "开场介绍",
    "description": "主持人开场介绍",
    "status": "confirmed",
    "meta": { "speakerName": "张明" }
  }
]`;

export function ImportPanel() {
  const [inputText, setInputText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showSample, setShowSample] = useState<'csv' | 'json' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importData = useTimelineStore(state => state.importData);

  const parseInput = (text: string): Partial<any>[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      const lines = trimmed.split('\n').filter(l => l.trim());
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.trim());
      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((header, i) => {
          if (header.startsWith('meta.')) {
            const key = header.replace('meta.', '');
            obj.meta = { ...obj.meta, [key]: values[i] };
          } else if (header === 'startTime' || header === 'duration') {
            obj[header] = parseFloat(values[i]) || 0;
          } else {
            obj[header] = values[i];
          }
        });
        return obj;
      });
    }
  };

  const handleImport = () => {
    const parsed = parseInput(inputText);
    if (parsed.length === 0) {
      alert('无法解析输入数据，请检查格式');
      return;
    }
    const result = importData(parsed);
    setImportResult(result);
    setInputText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
    };
    reader.readAsText(file);
  };

  const handlePasteSample = (format: 'csv' | 'json') => {
    setInputText(format === 'csv' ? SAMPLE_GUEST_CSV : SAMPLE_GUEST_JSON);
    setShowSample(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-body flex-1 overflow-auto">
        <div className="mb-4">
          <h3 className="section-title">导入素材</h3>
          <p className="text-xs text-text-muted mb-3">
            支持粘贴 CSV 或 JSON 格式数据，或上传文件。系统将自动检测重复、晚到附件和缺失字段。
          </p>
        </div>

        <div className="flex gap-2 mb-3">
          <Button variant="secondary" className="flex-1" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            上传文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
          <div className="relative">
            <Button variant="secondary" onClick={() => setShowSample(showSample ? null : 'csv')}>
              <Copy className="w-4 h-4" />
              样例
            </Button>
            {showSample && (
              <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-bg-primary border border-border-primary shadow-lg">
                <button
                  className="w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-bg-tertiary flex items-center gap-2"
                  onClick={() => handlePasteSample('csv')}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  CSV 样例
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-bg-tertiary flex items-center gap-2"
                  onClick={() => handlePasteSample('json')}
                >
                  <FileJson className="w-3.5 h-3.5" />
                  JSON 样例
                </button>
              </div>
            )}
          </div>
        </div>

        <textarea
          className="input-raw h-40 resize-none mb-3"
          placeholder="粘贴 CSV 或 JSON 数据..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={handleImport} disabled={!inputText.trim()}>
            导入并检测
          </Button>
          <Button variant="ghost" onClick={() => { setInputText(''); setImportResult(null); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {importResult && (
          <div className="mt-4 p-3 border border-border-primary bg-bg-tertiary animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-primary">导入结果</span>
              <Button variant="ghost" size="sm" onClick={() => setImportResult(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-status-confirmed" />
                <span className="text-text-muted">正常记录</span>
                <span className="font-mono text-text-primary ml-auto">{importResult.stats.normal}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-status-pending" />
                <span className="text-text-muted">晚到附件</span>
                <span className="font-mono text-text-primary ml-auto">{importResult.stats.late}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-status-anomaly" />
                <span className="text-text-muted">重复项</span>
                <span className="font-mono text-text-primary ml-auto">{importResult.stats.duplicates}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-status-anomaly" />
                <span className="text-text-muted">缺失字段</span>
                <span className="font-mono text-text-primary ml-auto">{importResult.stats.missing}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border-primary flex items-center justify-between">
              <span className="text-xs text-text-muted">总计导入</span>
              <Badge variant={importResult.stats.normal === importResult.stats.total ? 'confirmed' : 'pending'}>
                {importResult.stats.total} 条
              </Badge>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h3 className="section-title">操作说明</h3>
          <div className="space-y-2 text-xs text-text-secondary">
            <div className="flex gap-2">
              <span className="code-text text-track-guest">嘉宾名单</span>
              <span>type=guest, 需包含 speakerName</span>
            </div>
            <div className="flex gap-2">
              <span className="code-text text-track-clip">剪辑点</span>
              <span>type=clip, 需包含 clipType</span>
            </div>
            <div className="flex gap-2">
              <span className="code-text text-track-ad">广告口播</span>
              <span>type=ad, 需包含 adClient</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="section-title">嘉宾名单样例</h3>
          <div className="p-3 bg-bg-tertiary border border-border-primary text-xs">
            <div className="code-text text-text-muted mb-2">CSV 格式：</div>
            <pre className="code-text text-text-secondary whitespace-pre-wrap break-all">
{`type,startTime,duration,title,status,meta.speakerName
guest,0,180,开场介绍,confirmed,张明
guest,200,420,话题讨论,confirmed,李华
guest,650,300,听众问答,pending,王芳`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
