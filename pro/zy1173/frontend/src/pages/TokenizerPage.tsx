import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { tokenizerApi } from '@/api'
import { Copy, Trash2, AlertCircle } from 'lucide-react'

const sampleTexts = [
  { label: '英文示例', text: 'Hello world! This is a test of the GPT tokenizer.' },
  { label: '中文示例', text: '你好世界！这是GPT分词器的测试。' },
  { label: '混合文本', text: 'GPT stands for "Generative Pre-trained Transformer". GPT是生成式预训练变换器的缩写。' },
  { label: '代码示例', text: 'const hello = () => { console.log("Hello, World!"); };' },
]

const tokenColors = [
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-green-100 text-green-800 border-green-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-teal-100 text-teal-800 border-teal-300',
]

function TokenVisualizer({
  tokens,
  tokenIds,
}: {
  tokens: Array<{
    token: string
    token_id: number
    start_pos: number
    end_pos: number
    is_whitespace: boolean
  }>
  tokenIds: number[]
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const nonWhitespaceTokens = tokens.filter((t) => !t.is_whitespace)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Token 可视化</h3>
        <div className="flex flex-wrap gap-2">
          {nonWhitespaceTokens.map((token, index) => {
            const colorIndex = index % tokenColors.length
            const isHovered = hoveredIndex === index

            return (
              <div
                key={index}
                className={`token-box relative cursor-pointer rounded-lg border-2 px-3 py-2 transition-all ${
                  tokenColors[colorIndex]
                } ${isHovered ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="text-sm font-medium">{token.token}</div>
                <div className="text-xs opacity-75">ID: {token.token_id}</div>

                {isHovered && (
                  <div className="absolute z-10 mt-2 w-48 rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg">
                    <div className="font-medium mb-1">Token: {token.token}</div>
                    <div className="text-gray-300">ID: {token.token_id}</div>
                    <div className="text-gray-300">
                      位置: [{token.start_pos}, {token.end_pos})
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Token ID 序列</h3>
          <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
            <code className="text-sm text-gray-700 whitespace-pre-wrap break-all">
              [{tokenIds.join(', ')}]
            </code>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(tokenIds))}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Copy size={14} />
              复制
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">统计信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{nonWhitespaceTokens.length}</div>
              <div className="text-sm text-blue-600">Token 数量</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {tokens.reduce((acc, t) => acc + (t.end_pos - t.start_pos), 0)}
              </div>
              <div className="text-sm text-green-600">字符数量</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {nonWhitespaceTokens.length > 0
                  ? (
                      tokens.reduce((acc, t) => acc + (t.end_pos - t.start_pos), 0) /
                      nonWhitespaceTokens.length
                    ).toFixed(2)
                  : 0}
              </div>
              <div className="text-sm text-purple-600">平均字符/Token</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {new Set(tokenIds).size}
              </div>
              <div className="text-sm text-orange-600">唯一 Token 数量</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">详细表格</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  索引
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Token
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Token ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  起始位置
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  结束位置
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {nonWhitespaceTokens.map((token, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {index}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                      {token.token}
                    </code>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                    {token.token_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {token.start_pos}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {token.end_pos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TruncationDemo() {
  const [text, setText] = useState('这是一段用于测试上下文窗口截断的示例文本。它包含了多个句子，用来演示当文本长度超过最大 token 限制时如何进行截断。')
  const [maxTokens, setMaxTokens] = useState(10)
  const [truncationSide, setTruncationSide] = useState<'left' | 'right'>('right')

  const truncateMutation = useMutation({
    mutationFn: () => tokenizerApi.truncate(text, maxTokens, truncationSide),
  })

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">上下文窗口截断演示</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            最大 Token 数量
          </label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value) || 10)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            min={1}
            max={100}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            截断方向
          </label>
          <select
            value={truncationSide}
            onChange={(e) => setTruncationSide(e.target.value as 'left' | 'right')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="right">右侧截断 (保留开头)</option>
            <option value="left">左侧截断 (保留结尾)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => truncateMutation.mutate()}
            disabled={truncateMutation.isPending || !text.trim()}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {truncateMutation.isPending ? '处理中...' : '执行截断'}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          输入文本
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
        />
      </div>

      {truncateMutation.isError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-red-600">
            {truncateMutation.error instanceof Error ? truncateMutation.error.message : '截断失败'}
          </div>
        </div>
      )}

      {truncateMutation.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${truncateMutation.data.data.truncated ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="text-sm font-medium mb-1">
                {truncateMutation.data.data.truncated ? '已截断' : '无需截断'}
              </div>
              <div className="text-2xl font-bold">
                {truncateMutation.data.data.original_count} → {truncateMutation.data.data.truncated_ids.length}
              </div>
              <div className="text-xs opacity-75">Token 数量</div>
            </div>
            {truncateMutation.data.data.truncated && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="text-sm font-medium mb-1">移除的 Token</div>
                <div className="text-2xl font-bold text-red-600">
                  {truncateMutation.data.data.removed_count}
                </div>
                <div className="text-xs opacity-75">个 Token</div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">原始文本</div>
              <div className="p-3 bg-gray-50 rounded-lg font-mono text-sm whitespace-pre-wrap break-all">
                {truncateMutation.data.data.original_text}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">截断后文本</div>
              <div className="p-3 bg-primary-50 rounded-lg font-mono text-sm whitespace-pre-wrap break-all border border-primary-200">
                {truncateMutation.data.data.truncated_text}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TokenizerPage() {
  const [text, setText] = useState('')
  const [useHf, setUseHf] = useState(true)

  const tokenizeMutation = useMutation({
    mutationFn: () => tokenizerApi.tokenize(text, useHf),
  })

  const handleSampleClick = (sampleText: string) => {
    setText(sampleText)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tokenizer 可视化</h1>
          <p className="text-gray-600 mt-1">
            探索文本如何被切分成 token，了解 token ID 映射和上下文窗口截断
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            输入文本
          </label>
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="在此输入要分析的文本..."
              rows={3}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useHf}
                onChange={(e) => setUseHf(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">使用 HuggingFace Tokenizer</span>
            </label>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setText('')}
            className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            清空
          </button>

          <button
            onClick={() => tokenizeMutation.mutate()}
            disabled={tokenizeMutation.isPending || !text.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {tokenizeMutation.isPending ? '分析中...' : '分析 Token'}
          </button>
        </div>

        <div>
          <div className="text-sm text-gray-500 mb-2">示例文本:</div>
          <div className="flex flex-wrap gap-2">
            {sampleTexts.map((sample, index) => (
              <button
                key={index}
                onClick={() => handleSampleClick(sample.text)}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tokenizeMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-red-600">
            {tokenizeMutation.error instanceof Error ? tokenizeMutation.error.message : 'Tokenization 失败'}
          </div>
        </div>
      )}

      {tokenizeMutation.data && (
        <TokenVisualizer
          tokens={tokenizeMutation.data.data.tokens}
          tokenIds={tokenizeMutation.data.data.token_ids}
        />
      )}

      <TruncationDemo />
    </div>
  )
}
