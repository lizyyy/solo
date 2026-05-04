import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { dataApi, SeedData } from '@/api'
import { Upload, RefreshCw, Copy, AlertCircle, Database, FileText, ChevronRight } from 'lucide-react'

const tabConfig = [
  { key: 'corpus', label: '预训练语料', icon: Database },
  { key: 'finetune', label: '微调样本', icon: FileText },
  { key: 'edge-cases', label: '异常样例', icon: AlertCircle },
]

export default function DataPage() {
  const [activeTab, setActiveTab] = useState('corpus')
  const [importFile, setImportFile] = useState<File | null>(null)
  const queryClient = useQueryClient()

  const { data: seedData, isLoading } = useQuery({
    queryKey: ['seedData'],
    queryFn: () => dataApi.getAllSeedData(),
  })

  const handleImport = async () => {
    if (!importFile) return
    try {
      if (activeTab === 'corpus') {
        await dataApi.importCorpus(importFile)
      } else if (activeTab === 'finetune') {
        await dataApi.importFinetune(importFile)
      }
      queryClient.invalidateQueries({ queryKey: ['seedData'] })
      setImportFile(null)
      alert('导入成功！')
    } catch (error) {
      console.error('Import failed:', error)
      alert('导入失败，请检查文件格式')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据管理</h1>
          <p className="text-gray-600 mt-1">
            管理预训练语料、微调样本和异常测试样例
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-6 border border-primary-200">
        <h3 className="font-semibold text-gray-900 mb-2">内置 Seed 数据</h3>
        <p className="text-sm text-gray-600">
          本项目包含内置的 seed 数据，包括：
          <span className="font-medium"> 5 条预训练语料</span>、
          <span className="font-medium"> 3 条微调样本</span>、
          <span className="font-medium"> 6 个异常测试样例</span>。
          这些数据可以帮助你快速开始实验和测试。
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabConfig.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin mx-auto mb-4 text-gray-400" size={32} />
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : seedData ? (
            <TabContent
              activeTab={activeTab}
              seedData={seedData.data.data}
              onCopy={copyToClipboard}
            />
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">导入数据</h3>
        <p className="text-sm text-gray-600 mb-4">
          你可以导入自己的语料数据或微调样本。支持 JSON 格式文件。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">语料数据格式</h4>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`[
  {
    "id": "corpus-1",
    "text": "文本内容...",
    "source": "my-data",
    "category": "general"
  }
]`}
            </pre>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">微调样本格式</h4>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`[
  {
    "id": "ft-1",
    "prompt": "问题：...",
    "completion": "回答：...",
    "category": "qa"
  }
]`}
            </pre>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <input
            type="file"
            accept=".json"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
          <button
            onClick={handleImport}
            disabled={!importFile}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Upload size={16} />
            导入到 {activeTab === 'corpus' ? '语料库' : activeTab === 'finetune' ? '微调样本' : '异常样例'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TabContent({
  activeTab,
  seedData,
  onCopy,
}: {
  activeTab: string
  seedData: SeedData
  onCopy: (text: string) => void
}) {
  if (activeTab === 'corpus') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">
            内置预训练语料 ({seedData.corpus.length} 条)
          </h4>
        </div>
        <div className="space-y-4">
          {seedData.corpus.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {item.category}
                  </span>
                  <span className="text-xs text-gray-500">来源: {item.source}</span>
                </div>
                <button
                  onClick={() => onCopy(item.text)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                >
                  <Copy size={14} />
                  复制文本
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{item.text}</p>
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                <ChevronRight size={14} />
                <span>长度: {item.text.length} 字符</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (activeTab === 'finetune') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">
            内置微调样本 ({seedData.finetune.length} 条)
          </h4>
        </div>
        <div className="space-y-6">
          {seedData.finetune.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                  {item.category}
                </span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Prompt:</div>
                  <div className="p-3 bg-white rounded border font-mono text-sm">
                    {item.prompt}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Completion:</div>
                  <div className="p-3 bg-primary-50 rounded border border-primary-200 font-mono text-sm">
                    {item.completion}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => onCopy(item.prompt)}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                >
                  <Copy size={12} />
                  复制 Prompt
                </button>
                <button
                  onClick={() => onCopy(item.completion)}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                >
                  <Copy size={12} />
                  复制 Completion
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (activeTab === 'edge-cases') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">
            异常测试样例 ({seedData.edge_cases.length} 个)
          </h4>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-4">
          <p className="text-sm text-yellow-700">
            <strong>提示：</strong>这些异常样例可用于测试系统的鲁棒性。
            包括空文本、超长文本、多语言混合、特殊字符等边界情况。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seedData.edge_cases.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-medium text-gray-900">{item.description}</h5>
                <button
                  onClick={() => onCopy(item.text)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                >
                  <Copy size={14} />
                  复制
                </button>
              </div>
              <div className="p-3 bg-white rounded border font-mono text-sm">
                {item.text === '' ? (
                  <span className="text-gray-400 italic">(空文本)</span>
                ) : item.text.length > 50 ? (
                  <span>{item.text.substring(0, 50)}... ({item.text.length} 字符)</span>
                ) : (
                  <span>{item.text}</span>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                长度: {item.text.length} 字符
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
