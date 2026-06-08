import React, { useState } from 'react';
import { Terminal, Copy, Check, Download, Play, ChevronRight, FileText } from 'lucide-react';

interface ReplayTerminalProps {
  batchId: string;
  batchNo: string;
}

export const ReplayTerminal: React.FC<ReplayTerminalProps> = ({ batchId, batchNo }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'commands' | 'summary'>('commands');

  const commands = `#!/bin/bash
# ================================================
# 保险佣金阶梯结算 - 复盘重跑脚本
# 批次号: ${batchNo}
# 批次ID: ${batchId}
# 生成时间: ${new Date().toISOString()}
# ================================================

set -e

BATCH="${batchNo}"

echo "================================================"
echo "  保险佣金阶梯结算 - 批次复盘"
echo "  批次: $BATCH"
echo "================================================"

echo ""
echo "[1/5] 重置该批次数据（可选，如需完整重放）"
echo "----------------------------------------"
# npm run settlement:reset -- --batch="$BATCH"
echo "→ 跳过批次重置（如需完整重放，取消上一行注释）"

echo ""
echo "[2/5] 导入除权日截图数据"
echo "----------------------------------------"
npm run settlement:import -- --batch="$BATCH"
echo "✓ 数据导入完成"

echo ""
echo "[3/5] 执行四类自检"
echo "----------------------------------------"
npm run settlement:self-check -- --batch="$BATCH"
echo "✓ 自检完成"

echo ""
echo "[4/5] 应用审计操作（风控复核 + 审计确认）"
echo "----------------------------------------"
npm run settlement:replay-actions -- --batch="$BATCH" --step=risk_control
npm run settlement:replay-actions -- --batch="$BATCH" --step=audit
echo "✓ 审计操作重放完成"

echo ""
echo "[5/5] 生成导出报告"
echo "----------------------------------------"
npm run settlement:export-report -- --batch="$BATCH" --format=xlsx
echo "✓ 报告生成完成"

echo ""
echo "================================================"
echo "  复盘完成！"
echo "  报告位置: ./data/exports/"
echo "================================================"

# API 调用方式（备选，需先启动服务 npm run server:dev）
# ----------------------------------------
# # 1. 导入数据
# curl -X POST http://localhost:3001/api/batches \\
#   -H "Content-Type: application/json" \\
#   -d '{"rawData":[...],"operator":"复盘","importSource":"PASTE"}'
#
# # 2. 执行自检
# curl -X POST http://localhost:3001/api/batches/${batchId}/self-check
#
# # 3. 风控复核
# curl -X POST http://localhost:3001/api/batches/${batchId}/risk-review \\
#   -H "Content-Type: application/json" \\
#   -d '{"operator":"风控复核","updates":[...]}'
#
# # 4. 审计更新
# curl -X POST http://localhost:3001/api/batches/${batchId}/audit-update \\
#   -H "Content-Type: application/json" \\
#   -d '{"operator":"审计确认","statusUpdates":[...]}'
#
# # 5. 导出
# curl -O -J http://localhost:3001/api/export/${batchId}?format=xlsx
`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(commands);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([commands], { type: 'text/x-sh' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-${batchNo}.sh`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg border border-navy-200 overflow-hidden">
      <div className="bg-navy-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-navy-300" />
          <span className="text-navy-100 font-mono text-sm">replay-{batchNo}.sh</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-navy-200 hover:bg-navy-800 rounded transition-colors"
          >
            {copied ? <Check size={14} className="text-audit-green" /> : <Copy size={14} />}
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-navy-200 hover:bg-navy-800 rounded transition-colors"
          >
            <Download size={14} />
            下载
          </button>
          <button
            onClick={() => window.open(`/api/export/${batchId}/replay-command`, '_blank')}
            className="flex items-center gap-1 px-3 py-1.5 bg-audit-green text-white text-xs rounded hover:bg-audit-green/90 transition-colors"
          >
            <Play size={14} />
            在终端执行
          </button>
        </div>
      </div>

      <div className="border-b border-navy-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('commands')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'commands'
                ? 'border-navy-800 text-navy-800 bg-navy-50'
                : 'border-transparent text-navy-500 hover:text-navy-700'
            }`}
          >
            <Terminal size={14} className="inline mr-1" />
            重跑命令
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-navy-800 text-navy-800 bg-navy-50'
                : 'border-transparent text-navy-500 hover:text-navy-700'
            }`}
          >
            <FileText size={14} className="inline mr-1" />
            复盘说明
          </button>
        </div>
      </div>

      {activeTab === 'commands' ? (
        <div className="bg-navy-900 p-4 max-h-[500px] overflow-auto">
          <pre className="text-xs font-mono text-navy-100 whitespace-pre-wrap">
            {commands}
          </pre>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          <div className="bg-navy-50 p-4 rounded-lg border border-navy-200">
            <h4 className="font-semibold text-navy-800 mb-3 flex items-center gap-2">
              <ChevronRight size={16} className="text-audit-green" />
              什么是复盘记录？
            </h4>
            <p className="text-sm text-navy-600">
              复盘记录包含从数据导入到最终结算的完整操作轨迹。每一步操作都有时间戳、操作人和变更内容，
              确保托管对接人追问时能回到原始证据，而不是只看一个汇总数。
            </p>
          </div>

          <div className="bg-navy-50 p-4 rounded-lg border border-navy-200">
            <h4 className="font-semibold text-navy-800 mb-3 flex items-center gap-2">
              <ChevronRight size={16} className="text-audit-green" />
              如何使用重跑命令？
            </h4>
            <ol className="text-sm text-navy-600 space-y-2 list-decimal list-inside">
              <li>复制上方脚本到项目根目录</li>
              <li>赋予执行权限: <code className="bg-white px-1 py-0.5 rounded font-mono text-xs">chmod +x replay-{batchNo}.sh</code></li>
              <li>执行脚本: <code className="bg-white px-1 py-0.5 rounded font-mono text-xs">./replay-{batchNo}.sh</code></li>
              <li>脚本将自动完成全部流程并生成一致的结果</li>
            </ol>
          </div>

          <div className="bg-audit-orange/5 p-4 rounded-lg border border-audit-orange/30">
            <h4 className="font-semibold text-audit-orange mb-3 flex items-center gap-2">
              <ChevronRight size={16} />
              港币人民币同列处理说明
            </h4>
            <p className="text-sm text-navy-600">
              重跑时不会自动修正"港币和人民币写在同一列"的记录。这些记录会保持异常标记，
              以便托管对接人复核。如需正常化，请在步骤2风控补录时手动标记。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
