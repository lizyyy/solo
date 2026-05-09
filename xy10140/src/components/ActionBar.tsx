import { useState } from 'react';
import { TableState, ReplayCommand, HistoryEntry, ValidationError } from '../types';
import { getHistory, addToHistory, removeFromHistory, formatHistoryTime, clearHistory } from '../utils/history';
import { getSavedCommands, createReplayCommand, saveCommand, removeCommand, serializeCommand, deserializeCommand } from '../utils/idempotent';
import { createReport, exportAsJSON, exportAsCSV, exportAsZip } from '../utils/export';
import { setStateToURL, encodeTableState, decodeTableState } from '../utils/urlState';
import { TABLE_COLUMNS } from '../data/mockData';
import { TableRow } from '../types';

interface ActionBarProps {
  state: TableState;
  totalCount: number;
  filteredData: TableRow[];
  urlErrors: ValidationError[];
  onRestoreState: (state: TableState) => void;
  onExecuteCommand: (command: ReplayCommand) => Promise<void>;
  onReset: () => void;
  lastCommandResult?: ReplayCommand['result'];
}

export default function ActionBar({
  state,
  totalCount,
  filteredData,
  urlErrors,
  onRestoreState,
  onExecuteCommand,
  onReset,
  lastCommandResult,
}: ActionBarProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [commandName, setCommandName] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);

  const history = getHistory();
  const commands = getSavedCommands();

  const handleCopyURL = () => {
    const url = setStateToURL(state);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveHistory = () => {
    addToHistory(state, commandName || undefined);
    setCommandName('');
    setShowHistory(true);
  };

  const handleSaveCommand = () => {
    if (!commandName.trim()) {
      alert('请输入命令名称');
      return;
    }
    const cmd = createReplayCommand(commandName.trim(), state);
    saveCommand(cmd);
    setCommandName('');
    setShowCommands(true);
  };

  const handleImportCommand = () => {
    try {
      const cmd = deserializeCommand(importText);
      saveCommand(cmd);
      setImportText('');
      setImportError('');
      setShowImport(false);
      setShowCommands(true);
      alert('命令导入成功');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '导入失败');
    }
  };

  const handleImportURLState = () => {
    try {
      const result = decodeTableState(importText);
      if (result.errors.length > 0) {
        throw new Error(result.errors.map(e => e.message).join('; '));
      }
      onRestoreState(result.state);
      setImportText('');
      setImportError('');
      setShowImport(false);
      alert('状态恢复成功');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '导入失败');
    }
  };

  const handleExportJSON = async () => {
    const cmd = createReplayCommand('临时命令', state);
    const report = createReport(
      cmd.id,
      cmd.name,
      Date.now(),
      state,
      lastCommandResult || {
        success: true,
        message: `导出 ${filteredData.length} 条记录`,
        errors: [],
        matchedRows: filteredData.length,
        timestamp: Date.now(),
      },
      filteredData
    );
    await exportAsJSON(report);
    setShowExport(false);
  };

  const handleExportCSV = async () => {
    if (filteredData.length === 0) {
      alert('没有数据可导出');
      return;
    }
    await exportAsCSV(filteredData, 'table_data');
    setShowExport(false);
  };

  const handleExportZip = async () => {
    const cmd = createReplayCommand('临时命令', state);
    const report = createReport(
      cmd.id,
      cmd.name,
      Date.now(),
      state,
      lastCommandResult || {
        success: true,
        message: `导出 ${filteredData.length} 条记录`,
        errors: [],
        matchedRows: filteredData.length,
        timestamp: Date.now(),
      },
      filteredData
    );
    await exportAsZip(report, filteredData);
    setShowExport(false);
  };

  const formatStatePreview = (s: TableState) => {
    const parts: string[] = [];
    if (s.searchText) parts.push(`搜索:"${s.searchText}"`);
    if (s.filters.length > 0) parts.push(`筛选:${s.filters.length}个`);
    if (s.sort) {
      const label = TABLE_COLUMNS.find(c => c.key === s.sort?.field)?.label || s.sort.field;
      parts.push(`排序:${label}${s.sort.direction === 'asc' ? '↑' : '↓'}`);
    }
    if (s.groupBy) {
      const label = TABLE_COLUMNS.find(c => c.key === s.groupBy?.field)?.label || s.groupBy.field;
      parts.push(`分组:${label}`);
    }
    if (s.selectedIds.length > 0) parts.push(`选中:${s.selectedIds.length}条`);
    return parts.length > 0 ? parts.join(' | ') : '默认状态';
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      {urlErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="font-medium text-red-800 mb-1">URL 状态加载错误（未静默跳过）：</div>
          <ul className="list-disc list-inside text-sm text-red-700">
            {urlErrors.map((e, i) => (
              <li key={i}>
                <strong>[{e.field}]</strong> {e.message}
                {e.value !== undefined && (
                  <span className="text-red-500"> (值: {JSON.stringify(e.value).slice(0, 100)})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastCommandResult && (
        <div className={`border rounded-md p-3 ${lastCommandResult.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className={`font-medium ${lastCommandResult.success ? 'text-green-800' : 'text-yellow-800'} mb-1`}>
            命令执行结果: {lastCommandResult.message}
          </div>
          {lastCommandResult.errors.length > 0 && (
            <ul className="list-disc list-inside text-sm text-yellow-700">
              {lastCommandResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={commandName}
          onChange={(e) => setCommandName(e.target.value)}
          placeholder="输入名称（可选）..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md"
        />
        <button
          onClick={handleCopyURL}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {copied ? '已复制!' : '复制链接'}
        </button>
        <button
          onClick={handleSaveHistory}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          保存历史
        </button>
        <button
          onClick={handleSaveCommand}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
        >
          保存命令
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`px-4 py-2 rounded-md ${showHistory ? 'bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          历史 ({history.length})
        </button>
        <button
          onClick={() => setShowCommands(!showCommands)}
          className={`px-4 py-2 rounded-md ${showCommands ? 'bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          命令 ({commands.length})
        </button>
        <button
          onClick={() => setShowExport(!showExport)}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
        >
          导出
        </button>
        <button
          onClick={() => setShowImport(!showImport)}
          className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
        >
          导入
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          重置
        </button>
      </div>

      <div className="text-sm text-gray-600">
        当前状态: {formatStatePreview(state)} | 匹配 {totalCount} 条
      </div>

      {showHistory && (
        <div className="border rounded-md p-3 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">历史记录</h3>
            {history.length > 0 && (
              <button
                onClick={() => { clearHistory(); }}
                className="text-sm text-red-600 hover:text-red-800"
              >
                清空
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无历史记录</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((entry: HistoryEntry) => (
                <div key={entry.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {entry.label || '未命名'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {formatStatePreview(entry.state)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatHistoryTime(entry.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={() => { onRestoreState(entry.state); setShowHistory(false); }}
                    className="px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    恢复
                  </button>
                  <button
                    onClick={() => removeFromHistory(entry.id)}
                    className="px-2 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCommands && (
        <div className="border rounded-md p-3 bg-gray-50">
          <h3 className="font-medium mb-2">可复验命令（幂等执行）</h3>
          {commands.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无命令。保存的命令可重复执行，相同状态会命中缓存。</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {commands.map((cmd: ReplayCommand) => (
                <div key={cmd.id} className="bg-white p-2 rounded border">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {cmd.name}
                        {cmd.isExecuted && (
                          <span className={`text-xs px-1 rounded ${cmd.result?.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cmd.result?.success ? '成功' : '失败'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {formatStatePreview(cmd.state)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => { onRestoreState(cmd.state); setShowCommands(false); }}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      加载状态
                    </button>
                    <button
                      onClick={() => onExecuteCommand(cmd)}
                      className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                      执行
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(serializeCommand(cmd));
                      }}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      复制
                    </button>
                    <button
                      onClick={() => removeCommand(cmd.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showExport && (
        <div className="border rounded-md p-3 bg-gray-50">
          <h3 className="font-medium mb-2">导出报告</h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportJSON}
              className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              JSON 报告
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              CSV 数据
            </button>
            <button
              onClick={handleExportZip}
              className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              ZIP 包（含说明）
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(encodeTableState(state));
              }}
              className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              复制状态编码
            </button>
          </div>
        </div>
      )}

      {showImport && (
        <div className="border rounded-md p-3 bg-gray-50">
          <h3 className="font-medium mb-2">导入</h3>
          {importError && (
            <div className="bg-red-100 text-red-700 text-sm p-2 rounded mb-2">
              {importError}
            </div>
          )}
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="粘贴命令 JSON 或状态编码..."
            className="w-full px-3 py-2 border rounded mb-2 h-24 font-mono text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleImportCommand}
              className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              导入命令
            </button>
            <button
              onClick={handleImportURLState}
              className="px-3 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
            >
              恢复状态
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
