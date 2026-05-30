import { useState, useRef } from 'react';
import { useDrumKitStore } from '@/store/useDrumKitStore';
import {
  Save,
  FolderOpen,
  Download,
  Camera,
  FileText,
  RotateCcw,
  HelpCircle,
  ChevronDown,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { generateReportText, downloadTextFile, captureScreenshot, downloadImage, getReportFilename } from '@/utils/exportReport';

function SaveLoadMenu() {
  const { 
    session, 
    saveSession, 
    loadSession, 
    deleteSavedSession, 
    getSavedSessions,
    resetSession,
    importSession,
  } = useDrumKitStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [saveName, setSaveName] = useState(session.name);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const savedSessions = getSavedSessions();
  
  const handleSave = async () => {
    const screenshot = await captureScreenshot('canvas-container');
    saveSession(saveName || '未命名方案', screenshot);
    setIsOpen(false);
  };
  
  const handleLoad = (id: string) => {
    loadSession(id);
    setIsOpen(false);
  };
  
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定删除此方案吗？')) {
      deleteSavedSession(id);
    }
  };
  
  const handleReset = () => {
    if (confirm('确定重置为默认配置吗？当前未保存的更改将丢失。')) {
      resetSession();
      setIsOpen(false);
    }
  };
  
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
      setShowImport(true);
    };
    reader.readAsText(file);
  };
  
  const handleImportConfirm = () => {
    const success = importSession(importText);
    if (success) {
      setShowImport(false);
      setImportText('');
      setIsOpen(false);
    } else {
      alert('导入失败：无效的方案数据格式');
    }
  };
  
  const handleExportJson = () => {
    const json = JSON.stringify(session, null, 2);
    downloadTextFile(json, getReportFilename(session.name, 'text').replace('.txt', '.json'));
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setSaveName(session.name);
        }}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
      >
        <FolderOpen className="w-4 h-4" />
        <span className="text-sm">方案管理</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-2 w-80 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-200 mb-3">保存当前方案</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="输入方案名称..."
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm flex items-center gap-1 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            </div>
            
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-200 mb-3">已保存方案</h3>
              {savedSessions.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  暂无保存的方案
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedSessions.map(saved => (
                    <div
                      key={saved.id}
                      className="flex items-center gap-2 p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg cursor-pointer group transition-colors"
                      onClick={() => handleLoad(saved.id)}
                    >
                      {saved.thumbnail && (
                        <img
                          src={saved.thumbnail}
                          alt={saved.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate">{saved.name}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(saved.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, saved.id)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleExportJson}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  导出JSON
                </button>
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  导入JSON
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.txt"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>
              </div>
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/50 rounded-lg text-amber-400 text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重置为默认配置
              </button>
            </div>
          </div>
        </>
      )}
      
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-[500px] max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-200">导入方案数据</h3>
              <button
                onClick={() => setShowImport(false)}
                className="p-1 hover:bg-slate-700 rounded text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full h-48 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 font-mono focus:border-blue-500 focus:outline-none resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImport(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImportConfirm}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm transition-colors"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopToolbar() {
  const { session, analysis, resetSession } = useDrumKitStore();
  const [showHelp, setShowHelp] = useState(false);
  
  const handleExportReport = async () => {
    const report = generateReportText(session, analysis);
    downloadTextFile(report, getReportFilename(session.name, 'text'));
  };
  
  const handleScreenshot = async () => {
    const screenshot = await captureScreenshot('canvas-container');
    if (screenshot) {
      downloadImage(screenshot, getReportFilename(session.name, 'image'));
    } else {
      alert('截图失败，请重试');
    }
  };
  
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">🎵</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100">鼓组摆位拾音模拟器</h1>
              <p className="text-xs text-slate-500">Drum Kit Miking Simulator</p>
            </div>
          </div>
          
          <SaveLoadMenu />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleScreenshot}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm transition-colors"
          >
            <Camera className="w-4 h-4" />
            截图
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            导出报告
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
            title="帮助"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-[600px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">使用帮助</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 hover:bg-slate-700 rounded text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-slate-300">
              <div>
                <h4 className="font-medium text-slate-100 mb-2">基本操作</h4>
                <ul className="space-y-1 text-slate-400">
                  <li>• 鼠标左键拖拽：旋转3D视图</li>
                  <li>• 鼠标滚轮：缩放视图</li>
                  <li>• 鼠标右键拖拽：平移视图</li>
                  <li>• 点击麦克风：选中并查看参数</li>
                  <li>• 拖拽麦克风：调整位置（按ESC取消）</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-100 mb-2">颜色含义</h4>
                <ul className="space-y-1 text-slate-400">
                  <li>• <span className="text-green-400">绿色</span>：正常状态，相位一致</li>
                  <li>• <span className="text-amber-400">琥珀色</span>：警告，相位偏移或距离问题</li>
                  <li>• <span className="text-red-400">红色</span>：错误，相位反向或严重问题</li>
                  <li>• <span className="text-blue-400">蓝色</span>：选中状态</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-100 mb-2">校验规则</h4>
                <ul className="space-y-1 text-slate-400">
                  <li>• 麦克风与鼓件距离过近（小于5cm）会警告</li>
                  <li>• 同鼓件上下麦相位需要反向</li>
                  <li>• 立体声顶置麦高度差不宜超过10cm</li>
                  <li>• 麦克风与鼓件之间有遮挡会警告</li>
                  <li>• 距离单位、极性模式会校验格式</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-100 mb-2">数据来源</h4>
                <ul className="space-y-1 text-slate-400">
                  <li>• 所有参数、警告、报告使用同一套数据源</li>
                  <li>• 3D摆位、相位计算、串音分析实时联动</li>
                  <li>• 错误会提示具体字段和修复建议</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
