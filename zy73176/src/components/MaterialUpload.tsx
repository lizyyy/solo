import { useState, useRef } from 'react';
import type { MaterialSource, MaterialItem } from '../types';
import { RemarkParser } from '../utils/remarkParser';
import { SourceTypeBadge } from './StatusBadge';

interface MaterialUploadProps {
  onUpload: (material: {
    title: string;
    materials: MaterialSource[];
    items: MaterialItem[];
    scoreRemark: string;
    oralNote: string;
    caliberVersionId: string;
  }) => void;
  activeCaliberId: string;
  onCancel: () => void;
}

export function MaterialUpload({ onUpload, activeCaliberId, onCancel }: MaterialUploadProps) {
  const [title, setTitle] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [scoreRemark, setScoreRemark] = useState('');
  const [oralNote, setOralNote] = useState('');
  const [sources, setSources] = useState<Array<{ type: 'file' | 'remark' | 'oral'; name: string; content: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      
      const parsed = RemarkParser.parseFileContent(content);
      if (!title) {
        setTitle(parsed.title);
      }
      
      setSources((prev) => [
        ...prev,
        {
          type: 'file',
          name: file.name,
          content
        }
      ]);
    };
    reader.readAsText(file);
  };

  const addRemark = () => {
    const content = prompt('请输入评分备注内容：');
    if (content) {
      setSources((prev) => [
        ...prev,
        {
          type: 'remark',
          name: `评分备注-${prev.filter(s => s.type === 'remark').length + 1}`,
          content
        }
      ]);
    }
  };

  const addOralNote = () => {
    const content = prompt('请输入口头说明内容：');
    if (content) {
      setSources((prev) => [
        ...prev,
        {
          type: 'oral',
          name: `口头说明-${prev.filter(s => s.type === 'oral').length + 1}`,
          content
        }
      ]);
    }
  };

  const removeSource = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      alert('请输入材料标题');
      return;
    }
    if (sources.length === 0) {
      alert('请至少上传一份材料');
      return;
    }

    const allContent = sources.map((s) => s.content).join('\n');
    const parsedItems = RemarkParser.extractItemsFromContent(allContent);

    const materialSources: MaterialSource[] = sources.map((s) => ({
      ...s,
      uploadTime: new Date().toISOString(),
      caliberVersionId: activeCaliberId
    }));

    onUpload({
      title: title.trim(),
      materials: materialSources,
      items: parsedItems,
      scoreRemark,
      oralNote,
      caliberVersionId: activeCaliberId
    });
  };

  const simulatedContent = `客户A，对公企业，评级AA
PD=2.5%
LGD=45%
EAD=500万元
备注：样本量n=120，置信度95%`;

  const fillDemoData = () => {
    setTitle('测试材料 - 对公客户A');
    setFileContent(simulatedContent);
    setSources([
      {
        type: 'file',
        name: '客户A评级报告.txt',
        content: simulatedContent
      },
      {
        type: 'remark',
        name: '评分备注-1',
        content: '边界样本较少，需关注尾部风险'
      }
    ]);
    setScoreRemark('整体评级合理，但PD接近阈值，建议复核');
    setOralNote('小岑口头说明：该客户属于传统制造业，近期行业风险上升');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">上传新材料</h3>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              材料标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入材料标题"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              材料来源
            </label>
            
            <div className="flex gap-2 mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.md,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                📄 上传文件
              </button>
              <button
                onClick={addRemark}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                📝 添加评分备注
              </button>
              <button
                onClick={addOralNote}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                💬 添加口头说明
              </button>
              <button
                onClick={fillDemoData}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium ml-auto"
              >
                🎯 填充示例数据
              </button>
            </div>

            {sources.length > 0 && (
              <div className="space-y-2">
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <SourceTypeBadge type={source.type} />
                      <span className="text-sm text-gray-700">{source.name}</span>
                    </div>
                    <button
                      onClick={() => removeSource(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}

            {sources.length === 0 && (
              <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                <p className="text-4xl mb-2">📁</p>
                <p>点击上方按钮添加材料</p>
                <p className="text-xs text-gray-400 mt-1">支持 .txt, .csv, .md, .json 格式</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              评分备注（可选）
            </label>
            <textarea
              value={scoreRemark}
              onChange={(e) => setScoreRemark(e.target.value)}
              placeholder="输入评分备注，系统将自动解析关键词..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              临时口头说明（可选）
            </label>
            <textarea
              value={oralNote}
              onChange={(e) => setOralNote(e.target.value)}
              placeholder="记录建模助教小岑的口头说明..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
            />
          </div>

          {fileContent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                解析预览
              </label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                  {fileContent}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            创建材料
          </button>
        </div>
      </div>
    </div>
  );
}
