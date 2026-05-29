import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileCode, Cloud, Plus } from 'lucide-react';
import { api, type CloudPlatform, type Script } from '@/utils/api';
import { useAppStore } from '@/store/appStore';

const platforms: { value: CloudPlatform; label: string; desc: string }[] = [
  { value: 'aws', label: 'AWS', desc: 'Amazon Web Services' },
  { value: 'aliyun', label: '阿里云', desc: 'Alibaba Cloud' },
  { value: 'tencent', label: '腾讯云', desc: 'Tencent Cloud' },
  { value: 'gcp', label: 'GCP', desc: 'Google Cloud Platform' },
];

export default function ImportPage() {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [platform, setPlatform] = useState<CloudPlatform>('aws');
  const [existingPolicy, setExistingPolicy] = useState('');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast, setLoading } = useAppStore();
  const navigate = useNavigate();

  useState(() => {
    api.scripts.list().then(setScripts);
  });

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setContent(reader.result as string);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!content.trim()) {
      showToast('请输入或上传脚本内容', 'error');
      return;
    }
    setLoading('import', true);
    try {
      let policy: Array<{ service: string; action: string }> = [];
      if (existingPolicy.trim()) {
        policy = JSON.parse(existingPolicy);
      }
      const script = await api.scripts.import({
        name: fileName || 'script_' + Date.now(),
        content,
        file_type: fileName?.split('.').pop() || 'sh',
        cloud_platform: platform,
        existing_policy: policy,
      });
      showToast('导入成功', 'success');
      navigate(`/scripts/${script.id}`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading('import', false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">导入脚本</h1>
        <p className="text-gray-400 text-sm mt-1">上传脚本文件或粘贴代码进行权限分析</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div
            className={`card border-2 border-dashed transition-colors cursor-pointer ${
              isDragging ? 'border-brand-500 bg-brand-500/10' : 'border-gray-600'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} accept=".sh,.py,.ps1,.yaml,.yml" />
            <div className="flex flex-col items-center py-8">
              <Upload size={40} className="text-gray-400 mb-3" />
              <p className="text-gray-300 mb-1">拖拽文件到这里或点击上传</p>
              <p className="text-gray-500 text-sm">支持 .sh, .py, .ps1, .yaml, .yml</p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileCode size={18} className="text-brand-400" />
                脚本代码
              </h3>
              {fileName && <span className="text-sm text-gray-400">{fileName}</span>}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="粘贴脚本代码..."
              className="w-full h-80 bg-bg-tertiary border border-gray-600 rounded-lg p-4 font-mono text-sm text-gray-200 resize-none focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">现有权限策略（可选）</h3>
            <textarea
              value={existingPolicy}
              onChange={e => setExistingPolicy(e.target.value)}
              placeholder='粘贴现有权限策略的JSON数组，例如：[{"service": "s3", "action": "GetObject"}]'
              className="w-full h-32 bg-bg-tertiary border border-gray-600 rounded-lg p-4 font-mono text-sm text-gray-200 resize-none focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Cloud size={18} className="text-brand-400" />
              云平台类型
            </h3>
            <div className="space-y-2">
              {platforms.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    platform === p.value
                      ? 'bg-brand-500/20 border border-brand-500/50'
                      : 'bg-bg-tertiary border border-transparent hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-gray-400">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full" onClick={handleImport}>
            <Plus size={18} className="inline mr-2" />
            开始分析
          </button>

          <div className="card">
            <h3 className="font-semibold mb-4">最近导入</h3>
            {scripts.length > 0 ? (
              <div className="space-y-2">
                {scripts.slice(0, 5).map(s => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/scripts/${s.id}`)}
                    className="w-full p-3 rounded-lg bg-bg-tertiary text-left hover:bg-bg-tertiary/80 transition-colors"
                  >
                    <div className="text-sm truncate">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {s.cloud_platform.toUpperCase()} · {s.api_call_count || 0} 个调用
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm text-center py-4">暂无记录</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
