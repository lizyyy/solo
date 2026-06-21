import { useState, useEffect } from 'react';
import {
  Database,
  FileText,
  Download,
  ShieldCheck,
  ClipboardList,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useTidalStore } from '@/store/useTidalStore';
import type { StationRecord } from '@/types';

// 粘贴日志弹窗
function PasteModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
}) {
  const [text, setText] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="panel w-[640px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-glow-cyan text-base font-mono tracking-wider flex items-center gap-2">
            <ClipboardList size={16} /> 粘贴浮标原始日志
          </h3>
          <button
            className="text-console-muted hover:text-console-text"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此粘贴日志内容，每行一条记录..."
          className="w-full h-64 bg-ocean-deep/80 border border-ocean-line rounded-sm p-3
            text-console-text font-mono text-[12px] leading-relaxed outline-none
            focus:border-glow-cyanDim console-scroll resize-none"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-bevel" onClick={onClose}>
            取消
          </button>
          <button
            className="btn-bevel-primary"
            disabled={!text.trim()}
            onClick={() => {
              onConfirm(text);
              setText('');
            }}
          >
            <FileText size={14} /> 解析日志
          </button>
        </div>
      </div>
    </div>
  );
}

// 错误 Toast
function ErrorToast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  return (
    <div className="fixed top-16 right-4 z-50 animate-[fadeIn_.2s_ease-out]">
      <div className="panel flex items-center gap-3 px-4 py-3 pr-5
        border-buoy-redDim shadow-glow-red bg-buoy-red/10 max-w-[420px]">
        <AlertTriangle size={18} className="text-buoy-red shrink-0" />
        <div className="text-[13px] text-console-text font-mono leading-snug flex-1">
          {msg}
        </div>
        <button
          onClick={onClose}
          className="text-console-muted hover:text-buoy-red shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default function TopBar() {
  const {
    batch_id,
    stations,
    selected_station_id,
    loadSample,
    parseLogs,
    applyRemarks,
    exportCsv,
    runVerify,
    error_msg,
    clearError,
  } = useTidalStore();

  const [pasteOpen, setPasteOpen] = useState(false);
  const [remarkText, setRemarkText] = useState('');

  const selected = stations.find(
    (s: StationRecord) => s.annotation_id === selected_station_id,
  );
  const hasSelected = !!selected;

  const handleApplyRemark = () => {
    if (!selected || !remarkText.trim()) return;
    applyRemarks([
      {
        station_name: selected.station_name,
        annotation_id: selected.annotation_id,
        remark_text: remarkText.trim(),
      },
    ]);
    setRemarkText('');
  };

  return (
    <header className="h-[56px] flex items-center gap-3 px-4
      bg-ocean-surface/95 border-b border-ocean-line backdrop-blur-sm relative">
      {/* 左侧：品牌 + 操作按钮 */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-sm bg-glow-cyan/15 border border-glow-cyanDim
          flex items-center justify-center mr-1">
          <Database size={16} className="text-glow-cyan" />
        </div>
        <div className="font-mono text-[13px] tracking-wider text-console-text
          mr-3 pr-3 border-r border-ocean-line">
          TIDAL <span className="text-glow-cyan">ANNOTATOR</span>
        </div>

        <button className="btn-bevel-primary" onClick={loadSample}>
          <Database size={14} /> 加载示例浮标日志
        </button>
        <button className="btn-bevel" onClick={() => setPasteOpen(true)}>
          <FileText size={14} /> 粘贴日志
        </button>
      </div>

      {/* 批次号胶囊 */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-ocean-deep/70
        rounded-full border border-ocean-line clip-bevel-sm">
        <span className="text-[11px] text-console-muted font-mono">BATCH</span>
        <span className="font-mono text-[12px] text-glow-cyan tracking-wider">
          {batch_id ? batch_id.slice(-10) : '—'}
        </span>
      </div>

      {/* 中间：备注输入 */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <input
          type="text"
          placeholder="对选中站追加备注，如'基准面偏高，实际减去0.5m'"
          value={remarkText}
          onChange={(e) => setRemarkText(e.target.value)}
          disabled={!hasSelected}
          className="w-[420px] h-8 px-3 bg-ocean-deep/60 border border-ocean-line
            rounded-sm text-[12px] text-console-text font-mono outline-none
            focus:border-glow-cyanDim placeholder:text-console-dim
            disabled:opacity-40 disabled:cursor-not-allowed"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleApplyRemark();
          }}
        />
        <button
          className="btn-bevel-warn"
          disabled={!hasSelected || !remarkText.trim()}
          onClick={handleApplyRemark}
        >
          <ShieldCheck size={14} /> 应用备注并重算
        </button>
      </div>

      {/* 右侧：导出 + 验证 */}
      <div className="flex items-center gap-2">
        <button
          className="btn-bevel"
          onClick={() => exportCsv('1')}
          disabled={!batch_id}
        >
          <Download size={14} /> 导出v1
        </button>
        <button
          className="btn-bevel"
          onClick={() => exportCsv('2')}
          disabled={!batch_id}
        >
          <Download size={14} /> 导出v2
        </button>
        <button
          className="btn-bevel-primary"
          onClick={() => runVerify('2')}
          disabled={!batch_id}
        >
          <ShieldCheck size={14} /> 执行接班验证v2
        </button>
      </div>

      {/* 弹窗 */}
      <PasteModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onConfirm={(t) => {
          setPasteOpen(false);
          parseLogs(t);
        }}
      />

      {error_msg && <ErrorToast msg={error_msg} onClose={clearError} />}
    </header>
  );
}
