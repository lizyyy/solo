import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { curlExamples } from '../lib/api';

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PATCH: 'bg-yellow-100 text-yellow-700',
  PUT: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function ApiDocs() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const handleCopy = async (curl: string, index: number) => {
    await navigator.clipboard.writeText(curl);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">API 文档</h2>
          <p className="text-gray-600">
            以下是所有关键接口的 curl 样例，可直接复制到终端测试。系统 Base URL: <code className="bg-gray-100 px-2 py-1 rounded text-sm">http://localhost:3001</code>
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {curlExamples.map((example, index) => (
            <div key={index} className="group">
              <div
                className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleExpand(index)}
              >
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 text-xs font-bold rounded ${methodColors[example.method]}`}>
                    {example.method}
                  </span>
                  <div>
                    <h3 className="font-medium text-gray-900">{example.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{example.path}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(example.curl, index);
                    }}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="复制 curl 命令"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedIndex === index ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {expandedIndex === index && (
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-4">{example.description}</p>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{example.curl}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">核心功能模块</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
              <div>
                <span className="font-medium">转调校验</span>：调号格式、主唱音域、乐器调弦检查
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
              <div>
                <span className="font-medium">版本历史</span>：字段级变更追踪，支持回滚
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full mt-1.5" />
              <div>
                <span className="font-medium">增量合并</span>：后到数据只补全，不覆盖已有值
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full mt-1.5" />
              <div>
                <span className="font-medium">冲突检测</span>：调号错误、时长超限、旧版混入
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5" />
              <div>
                <span className="font-medium">数据追溯</span>：每个数字可追溯计算来源
              </div>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">快速测试脚本</h3>
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-100">
              <code>{`# 一键测试所有接口（bash 脚本）
#!/bin/bash
BASE="http://localhost:3001"

echo "=== 1. 获取歌单列表 ==="
curl -s \\$BASE/api/setlists | python3 -m json.tool

echo -e "\\n=== 2. 创建新歌单 ==="
curl -s -X POST \\$BASE/api/setlists \\\n  -H "Content-Type: application/json" \\\n  -d '{"tourName":"测试巡演","venue":"测试场馆","date":"2026-01-01","maxDuration":7200}' | python3 -m json.tool

echo -e "\\n=== 3. 测试调号校验（错误调号 H#） ==="
curl -s "http://localhost:3001/api/setlists/validate/key?key=H%23" | python3 -m json.tool

echo -e "\\n=== 4. 对默认歌单执行完整校验 ==="
curl -s -X POST \\$BASE/api/setlists/sl-001/validate | python3 -m json.tool

echo -e "\\n=== 5. 生成检查报告 ==="
curl -s -X POST \\$BASE/api/setlists/sl-001/report | python3 -m json.tool

echo -e "\\n=== 6. 查看版本历史 ==="
curl -s \\$BASE/api/setlists/sl-001/versions | python3 -m json.tool

echo -e "\\n=== 7. 数据追溯示例 ==="
curl -s "http://localhost:3001/api/setlists/sl-001/trace?field=totalDuration" | python3 -m json.tool

echo -e "\\n=== 8. 计算分解示例 ==="
curl -s "http://localhost:3001/api/setlists/sl-001/trace/breakdown?field=totalDuration" | python3 -m json.tool`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
