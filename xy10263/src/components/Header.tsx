import { FileText, Upload, RotateCcw, Download, Play, AlertTriangle, Database } from 'lucide-react';
import { useWorkspace } from '../store/context';
import { sampleWorkspace } from '../data/sample';
import { prepareExportData, generateFileName, downloadJson, downloadMarkdown } from '../utils/exporter';

export function Header() {
  const { workspace, dispatch, analyzeData } = useWorkspace();

  const handleLoadSample = () => {
    dispatch({ type: 'LOAD_SAMPLE', payload: sampleWorkspace });
  };

  const handleReset = () => {
    if (window.confirm('确定要重置工作区吗？所有数据将被清空。')) {
      dispatch({ type: 'RESET_WORKSPACE' });
    }
  };

  const handleExportJson = () => {
    const data = prepareExportData(workspace);
    const filename = generateFileName(workspace, 'json');
    downloadJson(data, filename);
  };

  const handleExportMarkdown = () => {
    const data = prepareExportData(workspace);
    const filename = generateFileName(workspace, 'md');
    downloadMarkdown(data, filename);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const imported = JSON.parse(content);
        if (imported && imported.players && imported.clues) {
          dispatch({ type: 'IMPORT_DATA', payload: {
            ...imported,
            updatedAt: Date.now(),
          }});
          alert('导入成功！');
        } else {
            alert('无效的数据格式');
          }
      } catch (error) {
        alert('导入失败：' + (error as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{workspace.name}</h1>
              <p className="text-sm text-slate-400">{workspace.scriptName}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={analyzeData}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>分析</span>
          </button>
          
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>导入</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          <button
            onClick={handleLoadSample}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>样例</span>
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              <span>导出</span>
            </button>
            <div className="absolute right-0 top-full mt-1 bg-slate-800 rounded-lg shadow-lg border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={handleExportJson}
                className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-t-lg"
              >
                JSON 格式
              </button>
              <button
                onClick={handleExportMarkdown}
                className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-b-lg"
              >
                Markdown 报告
              </button>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重置</span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <input
        type="text"
        placeholder="工作区名称"
        value={workspace.name}
        onChange={(e) => dispatch({
          type: 'UPDATE_WORKSPACE_INFO',
          payload: {
            name: e.target.value,
            scriptName: workspace.scriptName,
          }
        })}
        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
      />
        <input
          type="text"
          placeholder="剧本名称"
          value={workspace.scriptName}
          onChange={(e) => dispatch({
            type: 'UPDATE_WORKSPACE_INFO',
            payload: {
              name: workspace.name,
              scriptName: e.target.value,
            }
          })}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
        />
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Database className="w-4 h-4" />
          <span>自动保存</span>
        </div>
      </div>
    </header>
  );
}
