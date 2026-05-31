import React from 'react';
import { FileText, AlertTriangle, Download, Upload, Calendar, Trophy, HelpCircle, Database, WifiOff, CheckCircle2 } from 'lucide-react';

export default function GuidePage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">操作指南</h1>
        <p className="text-slate-400 text-sm mt-1">太空矿场排班工具 - 社群运营快速上手</p>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 bg-orange-500/10">
            <h2 className="text-sm font-medium text-orange-400 flex items-center gap-2">
              <FileText size={16} />
              核心操作流程（必看）
            </h2>
          </div>
          <div className="p-4">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">1</span>
                <div>
                  <p className="text-slate-200 font-medium">数据导入</p>
                  <p className="text-slate-400 text-xs mt-1">拖拽Excel/CSV/截图等文件到「数据导入」页面，系统自动去重并识别重复项</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">2</span>
                <div>
                  <p className="text-slate-200 font-medium">排班管理</p>
                  <p className="text-slate-400 text-xs mt-1">在「排班工作台」创建/编辑矿场排班，标记异常状态，所有修改留痕</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">3</span>
                <div>
                  <p className="text-slate-200 font-medium">排行榜校对</p>
                  <p className="text-slate-400 text-xs mt-1">在「排行榜管理」手动修正排名，开启对比模式查看修改前后差异</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">4</span>
                <div>
                  <p className="text-slate-200 font-medium">导出复核</p>
                  <p className="text-slate-400 text-xs mt-1">在「导出中心」先进行一致性复核，确认无误后导出活动复盘</p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Upload size={16} className="text-blue-400" />
              如何放置玩家反馈样例
            </h2>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="p-3 bg-slate-700/50 rounded">
              <p className="text-slate-200 font-medium mb-2">支持的文件格式</p>
              <ul className="text-slate-400 text-xs space-y-1">
                <li>• <span className="text-emerald-400">Excel (.xlsx, .xls)</span> - 第一行为表头：playerName/playerId/content/timestamp</li>
                <li>• <span className="text-emerald-400">CSV (.csv)</span> - 逗号分隔，带表头</li>
                <li>• <span className="text-emerald-400">JSON (.json)</span> - 数组格式，包含玩家信息和反馈内容</li>
                <li>• <span className="text-emerald-400">TXT (.txt)</span> - 纯文本会作为单条反馈处理</li>
                <li>• <span className="text-amber-400">图片/截图</span> - 作为附件记录，需手动填写内容</li>
              </ul>
            </div>
            <div className="p-3 bg-slate-700/50 rounded">
              <p className="text-slate-200 font-medium mb-2">样例格式推荐</p>
              <pre className="text-xs text-slate-400 bg-slate-900 p-2 rounded overflow-x-auto">
{`playerName,playerId,content,timestamp
星际矿工001,P10001,"水晶掉落概率异常",2026-05-20 14:30
深空探索者,P10002,"钛金矿场卡顿",2026-05-20 15:12`}
              </pre>
            </div>
            <p className="text-amber-400 text-xs flex items-start gap-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              晚到的附件可以随时追加上传，系统会按时间线自动关联，不会覆盖已有数据
            </p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <WifiOff size={16} className="text-red-400" />
              断线后进度错乱怎么办
            </h2>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-red-300 font-medium mb-2">常见情况</p>
              <ul className="text-red-400/80 text-xs space-y-1">
                <li>• 浏览器刷新后数据不显示</li>
                <li>• 关闭标签页再打开发现进度丢失</li>
                <li>• 导出的数据和当前看到的不一致</li>
              </ul>
            </div>
            <div className="p-3 bg-slate-700/50 rounded">
              <p className="text-slate-200 font-medium mb-2">排查步骤</p>
              <ol className="text-slate-400 text-xs space-y-2 list-decimal list-inside">
                <li>检查浏览器是否开启了「隐私/无痕模式」（无痕模式数据不会持久化）</li>
                <li>确认是否在同一浏览器的同一配置文件下访问</li>
                <li>查看浏览器控制台是否有 LocalStorage 相关报错</li>
                <li>在「导出中心」检查数据概览的统计数字是否符合预期</li>
              </ol>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded">
              <p className="text-emerald-300 font-medium mb-2">恢复方法</p>
              <ul className="text-emerald-400/80 text-xs space-y-1">
                <li>• 本工具数据存储在浏览器本地，只要不清理缓存就不会丢失</li>
                <li>• 建议定期导出 JSON 格式备份（包含完整修改历史）</li>
                <li>• 断线前的操作如果已完成状态变更，会自动保存</li>
                <li>• 排行榜修改记录全部保留，可在「对比模式」下逐一核对</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Download size={16} className="text-emerald-400" />
              导出活动复盘前怎么复核
            </h2>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="p-3 bg-slate-700/50 rounded">
              <p className="text-slate-200 font-medium mb-2">强制复核流程</p>
              <ol className="text-slate-400 text-xs space-y-2 list-decimal list-inside">
                <li>进入「导出中心」，点击「重新检查」开始一致性复核</li>
                <li>复核完成后查看各项检查结果</li>
                <li>
                  <span className="text-amber-400">黄色警告</span>：建议处理但不阻止导出（如待确认反馈、无备注异常）
                </li>
                <li>
                  <span className="text-red-400">红色失败</span>：必须修复后才能导出
                </li>
                <li>确认无误后点击「导出活动复盘」</li>
              </ol>
            </div>
            <div className="p-3 bg-slate-700/50 rounded">
              <p className="text-slate-200 font-medium mb-2">重点核对清单</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  排行榜修改次数是否符合预期
                </label>
                <label className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  异常排班是否都添加了说明
                </label>
                <label className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  玩家反馈是否都已处理确认
                </label>
                <label className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  重复数据是否已标记处理
                </label>
                <label className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  导入源文件记录完整
                </label>
                <label className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  排班与反馈时间范围匹配
                </label>
              </div>
            </div>
            <p className="text-slate-500 text-xs">
              💡 导出的 Excel 包含完整的修改历史工作表，可用于审计和追溯，确保活动复盘和明细数据一致
            </p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Database size={16} className="text-purple-400" />
              数据保存说明
            </h2>
          </div>
          <div className="p-4 text-sm text-slate-400 space-y-2">
            <p>• 所有数据保存在浏览器本地（LocalStorage），不会上传到任何服务器</p>
            <p>• 建议定期导出 JSON 格式备份，包含完整的修改历史</p>
            <p>• 清理浏览器缓存/数据会导致数据丢失，请谨慎操作</p>
            <p>• 不同浏览器/设备之间数据不互通</p>
          </div>
        </div>
      </div>
    </div>
  );
}
