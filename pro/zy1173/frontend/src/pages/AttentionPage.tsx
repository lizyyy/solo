import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { inferenceApi } from '@/api'
import { AttentionHeatmapResult } from '@/api'
import { Play, AlertCircle, RefreshCw, Eye, Info } from 'lucide-react'

const sampleTexts = [
  { label: '简单句子', text: 'The cat sat on the mat' },
  { label: '中文句子', text: '我喜欢吃苹果和香蕉' },
  { label: '注意力示例', text: 'The animal did not cross the street because it was tired' },
  { label: '复杂句子', text: 'Artificial intelligence is transforming how we work and live' },
]

export default function AttentionPage() {
  const [text, setText] = useState('')
  const [selectedLayer, setSelectedLayer] = useState(0)

  const heatmapMutation = useMutation({
    mutationFn: () => inferenceApi.getAttentionHeatmap(text),
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">注意力机制可视化</h1>
          <p className="text-gray-600 mt-1">
            通过热力图直观理解自注意力机制如何让模型关注序列中的相关 token
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            输入文本
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在此输入要分析的文本..."
            rows={2}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="text-sm text-gray-500">示例:</div>
          {sampleTexts.map((sample, index) => (
            <button
              key={index}
              onClick={() => setText(sample.text)}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => heatmapMutation.mutate()}
            disabled={heatmapMutation.isPending || !text.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {heatmapMutation.isPending ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Eye size={18} />
            )}
            {heatmapMutation.isPending ? '分析中...' : '查看注意力热力图'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">什么是自注意力机制？</h3>
            <p className="text-sm text-blue-700 leading-relaxed">
              自注意力机制（Self-Attention）允许模型在处理序列中的每个 token 时，
              动态地关注序列中的其他相关 token。热力图中的每个单元格 (i, j) 表示
              第 i 个 token 在计算时对第 j 个 token 的注意力权重。颜色越深表示权重越高。
              <br /><br />
              例如，在句子 "The animal did not cross the street because it was tired" 中，
              模型需要理解 "it" 指的是 "animal" 而不是 "street"。注意力热力图可以展示
              这种依赖关系的捕获过程。
            </p>
          </div>
        </div>
      </div>

      {heatmapMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-red-600">
            {heatmapMutation.error instanceof Error ? heatmapMutation.error.message : '分析失败'}
          </div>
        </div>
      )}

      {heatmapMutation.data && (
        <HeatmapDisplay 
          result={heatmapMutation.data.data} 
          selectedLayer={selectedLayer}
          onLayerChange={setSelectedLayer}
        />
      )}
    </div>
  )
}

function HeatmapDisplay({ 
  result, 
  selectedLayer, 
  onLayerChange 
}: { 
  result: AttentionHeatmapResult
  selectedLayer: number
  onLayerChange: (layer: number) => void
}) {
  const layerData = result.layers[selectedLayer]
  const tokens = layerData?.tokens || []

  const getAttentionColor = (value: number, max: number) => {
    const normalized = Math.min(value / (max || 1), 1)
    const intensity = Math.round(normalized * 255)
    if (intensity < 64) {
      return `rgb(240, 249, 255)`
    } else if (intensity < 128) {
      return `rgb(186, 230, 253)`
    } else if (intensity < 192) {
      return `rgb(59, 130, 246)`
    } else {
      return `rgb(30, 64, 175)`
    }
  }

  const getTextColor = (value: number, max: number) => {
    const normalized = value / (max || 1)
    return normalized > 0.5 ? 'white' : 'rgb(30, 64, 175)'
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">选择层</h3>
            <div className="flex flex-wrap gap-2">
              {result.layers.map((layer, index) => (
                <button
                  key={index}
                  onClick={() => onLayerChange(index)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedLayer === index
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Layer {index + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Token 数量:</span> {tokens.length}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">层数:</span> {result.num_layers}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">头数:</span> {result.num_heads}
            </div>
          </div>
        </div>
      </div>

      {layerData && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Layer {selectedLayer + 1} 注意力热力图
          </h3>

          <div className="mb-4 flex items-center justify-end gap-2">
            <span className="text-sm text-gray-500">低</span>
            <div className="flex">
              <div className="w-6 h-4" style={{ backgroundColor: 'rgb(240, 249, 255)' }} />
              <div className="w-6 h-4" style={{ backgroundColor: 'rgb(186, 230, 253)' }} />
              <div className="w-6 h-4" style={{ backgroundColor: 'rgb(59, 130, 246)' }} />
              <div className="w-6 h-4" style={{ backgroundColor: 'rgb(30, 64, 175)' }} />
            </div>
            <span className="text-sm text-gray-500">高</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-sm font-medium text-gray-500 sticky left-0 bg-white z-10">
                    ↓ Query / Key →
                  </th>
                  {tokens.map((token, index) => (
                    <th 
                      key={index} 
                      className="p-2 text-center text-xs font-mono text-gray-700 bg-gray-50 min-w-[60px]"
                    >
                      <div className="truncate" title={token}>
                        {token.length > 8 ? token.substring(0, 8) + '...' : token}
                      </div>
                      <div className="text-[10px] text-gray-400">{index}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {layerData.attention_matrix.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="p-2 text-sm font-mono text-gray-700 bg-gray-50 sticky left-0 z-10">
                      <div className="truncate max-w-[100px]" title={tokens[rowIndex]}>
                        {tokens[rowIndex]}
                      </div>
                      <div className="text-[10px] text-gray-400">{rowIndex}</div>
                    </td>
                    {row.map((value, colIndex) => {
                      const maxAttention = layerData.max_attention
                      const isDiagonal = rowIndex === colIndex
                      const isCausalMasked = colIndex > rowIndex
                      
                      return (
                        <td
                          key={colIndex}
                          className="p-1 text-center"
                          title={`Query: ${tokens[rowIndex]} → Key: ${tokens[colIndex]}\n注意力权重: ${(value * 100).toFixed(2)}%`}
                        >
                          <div
                            className={`heatmap-cell w-10 h-10 flex items-center justify-center text-xs font-mono rounded cursor-help ${
                              isCausalMasked ? 'bg-gray-100 opacity-30' : ''
                            }`}
                            style={{
                              backgroundColor: isCausalMasked 
                                ? undefined 
                                : getAttentionColor(value, maxAttention),
                              color: isCausalMasked 
                                ? undefined 
                                : getTextColor(value, maxAttention),
                              border: isDiagonal ? '2px solid #3b82f6' : undefined,
                            }}
                          >
                            {isCausalMasked ? (
                              <span className="text-gray-300">—</span>
                            ) : (
                              <span>{(value * 100).toFixed(0)}</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="font-medium text-yellow-800 mb-2">图例说明</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• <strong>行 (Query):</strong> 表示当前正在处理的 token 位置</li>
              <li>• <strong>列 (Key):</strong> 表示被关注的 token 位置</li>
              <li>• <strong>单元格值:</strong> 注意力权重百分比 (0-100%)</li>
              <li>• <strong>蓝色边框:</strong> 对角线位置 (token 关注自身)</li>
              <li>• <strong>灰色单元格 (—):</strong> 因果掩码区域 (无法关注未来的 token)</li>
            </ul>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">各层注意力统计</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.layers.map((layer, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                selectedLayer === index
                  ? 'bg-primary-50 border-primary-300'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => onLayerChange(index)}
            >
              <h4 className="font-medium text-gray-900 mb-2">Layer {index + 1}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">最大注意力:</span>
                  <span className="ml-1 font-mono text-primary-600">
                    {(layer.max_attention * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">最小注意力:</span>
                  <span className="ml-1 font-mono text-gray-600">
                    {(layer.min_attention * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">因果掩码 (Causal Masking) 说明</h3>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          在 GPT 等自回归模型中，使用因果掩码（Causal Mask）来确保每个 token 只能关注
          <strong>之前的 token 以及自身</strong>，而无法关注未来的 token。这是因为在生成文本时，
          模型是从左到右逐个 token 生成的，在生成第 i 个 token 时，还不知道第 i+1 个及之后的 token。
        </p>
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">掩码矩阵示意（5个 token）:</h4>
          <div className="font-mono text-sm">
            <pre className="whitespace-pre-wrap">{`
Token 0: [✓, ✗, ✗, ✗, ✗]  只能关注自身
Token 1: [✓, ✓, ✗, ✗, ✗]  能关注 0 和 1
Token 2: [✓, ✓, ✓, ✗, ✗]  能关注 0, 1, 2
Token 3: [✓, ✓, ✓, ✓, ✗]  能关注 0, 1, 2, 3
Token 4: [✓, ✓, ✓, ✓, ✓]  能关注所有 token
            `}</pre>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-4">
          在热力图中，右上三角形（列索引 > 行索引）的单元格被掩码（显示为灰色的 "—"），
          表示这些位置的注意力权重被设置为负无穷，经过 softmax 后趋近于 0。
        </p>
      </div>
    </div>
  )
}
