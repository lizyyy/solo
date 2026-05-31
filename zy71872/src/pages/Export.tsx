import { useState } from 'react';
import { Download, FileText, FileJson, CheckCircle, AlertCircle, Copy, Eye } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { exportSimulationData, downloadFile, verifyExportIntegrity } from '../services/exportService';

export function Export() {
  const { teams, submissions, drafts, anomalies, snapshots, validateIntegrity } = useSimulationStore();
  const [format, setFormat] = useState<'text' | 'json'>('text');
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [includeAnomalies, setIncludeAnomalies] = useState(true);
  const [includeSnapshots, setIncludeSnapshots] = useState(true);
  const [includeSubmissions, setIncludeSubmissions] = useState(true);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  const hasData = teams.length > 0 || submissions.length > 0;
  const dataIsValid = validateIntegrity();

  const handleGeneratePreview = () => {
    const result = exportSimulationData(
      teams,
      submissions,
      drafts,
      anomalies,
      snapshots,
      {
        includeDrafts,
        includeAnomalies,
        includeSnapshots,
        includeSubmissions,
        format,
      }
    );
    setPreviewContent(result.content);
    setPreviewHash(result.hash);
    setPreviewFilename(result.filename);
    setVerifyResult(null);
  };

  const handleDownload = () => {
    if (!previewContent || !previewFilename) return;
    const mimeType = format === 'json' ? 'application/json' : 'text/plain';
    downloadFile(previewContent, previewFilename, mimeType);
  };

  const handleVerify = () => {
    if (!previewContent || !previewHash) return;
    const isValid = verifyExportIntegrity(previewContent, previewHash);
    setVerifyResult(isValid);
  };

  const handleCopyToClipboard = async () => {
    if (!previewContent) return;
    try {
      await navigator.clipboard.writeText(previewContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const stats = {
    teams: teams.length,
    submissions: submissions.length,
    drafts: drafts.length,
    anomalies: anomalies.length,
    snapshots: snapshots.length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">导出中心</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-400">数据完整性:</span>
          <span className={`font-mono text-sm ${dataIsValid ? 'text-emerald-400' : 'text-red-400'}`}>
            {dataIsValid ? '✓ 有效' : '✗ 已篡改'}
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="panel text-center py-12 text-slate-500">
          <Download className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无数据可导出</p>
          <p className="text-sm mt-2">请先在仿真控制台导入试跑材料并运行仿真</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="panel">
              <h3 className="panel-header">数据统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">队伍</span>
                  <span className="font-mono">{stats.teams}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">提交记录</span>
                  <span className="font-mono">{stats.submissions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">草稿版本</span>
                  <span className="font-mono">{stats.drafts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">异常记录</span>
                  <span className="font-mono">{stats.anomalies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">状态快照</span>
                  <span className="font-mono">{stats.snapshots}</span>
                </div>
              </div>
            </div>

            <div className="panel">
              <h3 className="panel-header">导出选项</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">导出格式</label>
                  <div className="flex space-x-2">
                    <button
                      className={`flex-1 btn flex items-center justify-center ${
                        format === 'text' ? 'btn-primary' : ''
                      }`}
                      onClick={() => setFormat('text')}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      纯文本
                    </button>
                    <button
                      className={`flex-1 btn flex items-center justify-center ${
                        format === 'json' ? 'btn-primary' : ''
                      }`}
                      onClick={() => setFormat('json')}
                    >
                      <FileJson className="w-4 h-4 mr-2" />
                      JSON
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-slate-400 mb-2">包含内容</label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSubmissions}
                      onChange={(e) => setIncludeSubmissions(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span className="text-sm">提交记录</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDrafts}
                      onChange={(e) => setIncludeDrafts(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span className="text-sm">草稿版本历史</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAnomalies}
                      onChange={(e) => setIncludeAnomalies(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span className="text-sm">异常记录</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSnapshots}
                      onChange={(e) => setIncludeSnapshots(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span className="text-sm">状态快照哈希链</span>
                  </label>
                </div>

                <button
                  className="w-full btn btn-primary"
                  onClick={handleGeneratePreview}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  生成预览
                </button>
              </div>
            </div>

            {previewContent && (
              <div className="panel">
                <h3 className="panel-header">操作</h3>
                <div className="space-y-2">
                  <button
                    className="w-full btn btn-success"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载文件
                  </button>
                  <button
                    className="w-full btn"
                    onClick={handleCopyToClipboard}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? '已复制!' : '复制到剪贴板'}
                  </button>
                  <button
                    className="w-full btn"
                    onClick={handleVerify}
                  >
                    {verifyResult === null ? (
                      <><CheckCircle className="w-4 h-4 mr-2" /> 校验一致性</>
                    ) : verifyResult ? (
                      <span className="text-emerald-400">
                        <CheckCircle className="w-4 h-4 mr-2 inline" /> 校验通过
                      </span>
                    ) : (
                      <span className="text-red-400">
                        <AlertCircle className="w-4 h-4 mr-2 inline" /> 校验失败
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="panel h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="panel-header mb-0">
                  {previewContent ? '导出预览' : '请先生成预览'}
                </h3>
                {previewHash && (
                  <div className="text-right">
                    <div className="text-xs text-slate-400">完整性哈希</div>
                    <div className="font-mono text-xs text-emerald-400">
                      {previewHash}
                    </div>
                  </div>
                )}
              </div>

              {previewContent ? (
                <pre className="flex-1 p-4 bg-slate-950 border border-slate-700 rounded font-mono text-xs overflow-auto scrollbar-thin whitespace-pre-wrap">
                  {previewContent}
                </pre>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded">
                  <div className="text-center">
                    <Eye className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>点击"生成预览"查看导出内容</p>
                    <p className="text-sm mt-2">
                      导出的记录包含完整的哈希链，下一班教练可直接校验一致性
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="panel mt-6">
              <h3 className="panel-header">交接班说明</h3>
              <div className="text-sm text-slate-400 space-y-2">
                <p>
                  <span className="text-amber-400">重要提示：</span>
                  导出文件包含完整的仿真历史记录，包括：
                </p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>所有队伍的提交记录和处理状态</li>
                  <li>参数草稿的完整版本历史（含修改人和修改时间）</li>
                  <li>所有异常记录及其解释说明</li>
                  <li>状态快照哈希链（用于校验数据未被篡改）</li>
                </ul>
                <p className="mt-3">
                  下一班教练接手时，可直接导入导出的记录文件，无需再翻聊天记录询问谁改过参数。
                  如需校验数据完整性，点击"校验一致性"按钮即可。
                </p>
                <p className="text-emerald-400">
                  ✓ 同一队伍的二次提交记录会保留，不会覆盖历史成功记录
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
