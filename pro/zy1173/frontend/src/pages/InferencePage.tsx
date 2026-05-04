import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { inferenceApi } from '@/api'
import { GenerateResult, KVCacheComparisonResult, SamplingComparisonResult } from '@/api'
import { Play, AlertCircle, Zap, BarChart3, RefreshCw, Save } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts'

const samplePrompts = [
  { label: 'AI 介绍', text: '人工智能是' },
  { label: '技术预测', text: '未来的技术发展趋势是' },
  { label: '创意写作', text: '在一个遥远的星球上，' },
  { label: '代码示例', text: '写一个 Python 函数来计算阶乘：' },
]

export default function InferencePage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'kv-cache' | 'sampling'>('generate')

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">推理演示</h1>
          <p className="text-gray-600 mt-1">
            体验 next-token 预测、KV Cache 性能对比和不同采样策略
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('generate')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'generate'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Play size={16} />
            文本生成
          </div>
        </button>
        <button
          onClick={() => setActiveTab('kv-cache')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'kv-cache'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap size={16} />
            KV Cache 对比
          </div>
        </button>
        <button
          onClick={() => setActiveTab('sampling')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'sampling'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={16} />
            采样策略对比
          </div>
        </button>
      </div>

      {activeTab === 'generate' && <GenerateTab />}
      {activeTab === 'kv-cache' && <KVCacheTab />}
      {activeTab === 'sampling' && <SamplingTab />}
    </div>
  )
}

function GenerateTab() {
  const [text, setText] = useState('')
  const [maxNewTokens, setMaxNewTokens] = useState(20)
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.9)
  const [topK, setTopK] = useState(0)
  const [samplingType, setSamplingType] = useState<'greedy' | 'temperature' | 'top_p' | 'top_k'>('greedy')
  const [useKvCache, setUseKvCache] = useState(true)

  const generateMutation = useMutation({
    mutationFn: () =>
      inferenceApi.generate({
        text,
        max_new_tokens: maxNewTokens,
        temperature,
        top_p: topP,
        top_k: topK,
        sampling_type: samplingType,
        use_kv_cache: useKvCache,
      }),
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            输入文本 (Prompt)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在此输入要继续生成的文本..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none font-mono"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              最大生成 Token 数: {maxNewTokens}
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={maxNewTokens}
              onChange={(e) => setMaxNewTokens(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              采样策略
            </label>
            <select
              value={samplingType}
              onChange={(e) => setSamplingType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="greedy">Greedy Search (贪婪搜索)</option>
              <option value="temperature">Temperature</option>
              <option value="top_p">Top-P (Nucleus)</option>
              <option value="top_k">Top-K</option>
            </select>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useKvCache}
                onChange={(e) => setUseKvCache(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">使用 KV Cache</span>
            </label>
          </div>

          {(samplingType === 'temperature' || samplingType === 'top_p') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperature: {temperature.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.0 (确定性)</span>
                <span>1.0 (中性)</span>
                <span>2.0 (随机)</span>
              </div>
            </div>
          )}

          {(samplingType === 'top_p' || samplingType === 'temperature') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Top-P: {topP.toFixed(2)}
              </label>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          {samplingType === 'top_k' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Top-K: {topK}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">0 = 不限制</div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-gray-500">示例:</div>
          {samplePrompts.map((sample, index) => (
            <button
              key={index}
              onClick={() => setText(sample.text)}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !text.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generateMutation.isPending ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Play size={18} />
            )}
            {generateMutation.isPending ? '生成中...' : '开始生成'}
          </button>
        </div>
      </div>

      {generateMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-red-600">
            {generateMutation.error instanceof Error ? generateMutation.error.message : '生成失败'}
          </div>
        </div>
      )}

      {generateMutation.data && (
        <GenerateResultDisplay result={generateMutation.data.data} />
      )}
    </div>
  )
}

function GenerateResultDisplay({ result }: { result: GenerateResult }) {
  const latencyChartData = result.latency_per_token_ms.map((latency, index) => ({
    token: index + 1,
    latency: parseFloat(latency.toFixed(2)),
  }))

  return (
    <div className="space-y-6">
      {result.risks.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
            <AlertCircle size={16} />
            ⚠️ 风险说明
          </h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {result.risks.map((risk, index) => (
              <li key={index}>• {risk}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">生成结果</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">输入文本:</div>
              <div className="p-3 bg-gray-50 rounded-lg font-mono text-sm">
                {result.input_text}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">生成的 Token ID:</div>
              <div className="p-3 bg-primary-50 rounded-lg font-mono text-sm overflow-x-auto">
                [{result.generated_tokens.join(', ')}]
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">性能统计</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {result.latency_ms.toFixed(2)}ms
              </div>
              <div className="text-sm text-blue-600">总延迟</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {result.generated_tokens.length}
              </div>
              <div className="text-sm text-green-600">生成 Token 数</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {(result.latency_ms / result.generated_tokens.length).toFixed(2)}ms
              </div>
              <div className="text-sm text-purple-600">平均每 Token 延迟</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {result.using_kv_cache ? '是' : '否'}
              </div>
              <div className="text-sm text-orange-600">使用 KV Cache</div>
            </div>
          </div>
        </div>
      </div>

      {latencyChartData.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">每 Token 延迟趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="token" label={{ value: 'Token 序号', position: 'bottom' }} />
              <YAxis label={{ value: '延迟 (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6' }}
                name="延迟 (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Token 概率分布 (前 5 个候选)</h3>
        <div className="space-y-4">
          {result.token_probs.slice(0, 10).map((probs, tokenIndex) => (
            <div key={tokenIndex} className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Token {tokenIndex + 1} 候选概率:
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(probs).map(([tokenId, prob]) => (
                  <div
                    key={tokenId}
                    className="px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm"
                  >
                    <span className="font-mono text-gray-600">ID:{tokenId}</span>
                    <span className="ml-2 font-medium text-primary-600">
                      {(prob * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {result.token_probs.length > 10 && (
            <div className="text-sm text-gray-500 text-center">
              ... 还有 {result.token_probs.length - 10} 个 token 的概率数据
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KVCacheTab() {
  const [text, setText] = useState('这是一个测试文本，用来演示 KV Cache 对推理性能的影响。')
  const [maxNewTokens, setMaxNewTokens] = useState(20)
  const [iterations, setIterations] = useState(3)

  const compareMutation = useMutation({
    mutationFn: () =>
      inferenceApi.compareKVCache({
        text,
        max_new_tokens: maxNewTokens,
        iterations,
      }),
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">KV Cache 性能对比测试</h3>
          <p className="text-sm text-gray-600">
            KV Cache 是一种优化技术，通过缓存之前计算的 Key 和 Value 状态，
            避免每次生成都重新计算整个序列的注意力，从而显著加速自回归推理过程。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              输入文本
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              生成 Token 数: {maxNewTokens}
            </label>
            <input
              type="range"
              min={5}
              max={50}
              value={maxNewTokens}
              onChange={(e) => setMaxNewTokens(parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              测试迭代次数: {iterations}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={iterations}
              onChange={(e) => setIterations(parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => compareMutation.mutate()}
            disabled={compareMutation.isPending || !text.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {compareMutation.isPending ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Zap size={18} />
            )}
            {compareMutation.isPending ? '测试中...' : '开始对比测试'}
          </button>
        </div>
      </div>

      {compareMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-red-600">
            {compareMutation.error instanceof Error ? compareMutation.error.message : '测试失败'}
          </div>
        </div>
      )}

      {compareMutation.data && (
        <KVCacheResultDisplay result={compareMutation.data.data} />
      )}
    </div>
  )
}

function KVCacheResultDisplay({ result }: { result: KVCacheComparisonResult }) {
  const chartData = [
    {
      name: '使用 KV Cache',
      平均延迟: result.with_kv_cache.mean_ms,
      最小延迟: result.with_kv_cache.min_ms,
      最大延迟: result.with_kv_cache.max_ms,
    },
    {
      name: '不使用 KV Cache',
      平均延迟: result.without_kv_cache.mean_ms,
      最小延迟: result.without_kv_cache.min_ms,
      最大延迟: result.without_kv_cache.max_ms,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">测试结果</h3>
            <p className="text-gray-600">{result.explanation}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-green-600">
              {result.speedup_ratio.toFixed(2)}x
            </div>
            <div className="text-sm text-green-600">加速比</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">性能对比</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: '延迟 (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="平均延迟" fill="#3b82f6" name="平均延迟 (ms)" />
              <Bar dataKey="最小延迟" fill="#10b981" name="最小延迟 (ms)" />
              <Bar dataKey="最大延迟" fill="#f59e0b" name="最大延迟 (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">详细统计</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">使用 KV Cache</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">平均延迟:</span>
                  <span className="font-mono">{result.with_kv_cache.mean_ms.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">标准差:</span>
                  <span className="font-mono">{result.with_kv_cache.std_ms.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">范围:</span>
                  <span className="font-mono">
                    {result.with_kv_cache.min_ms.toFixed(2)} - {result.with_kv_cache.max_ms.toFixed(2)}ms
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <h4 className="font-medium text-orange-800 mb-2">不使用 KV Cache</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">平均延迟:</span>
                  <span className="font-mono">{result.without_kv_cache.mean_ms.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">标准差:</span>
                  <span className="font-mono">{result.without_kv_cache.std_ms.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">范围:</span>
                  <span className="font-mono">
                    {result.without_kv_cache.min_ms.toFixed(2)} - {result.without_kv_cache.max_ms.toFixed(2)}ms
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">原始数据</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">使用 KV Cache 各次延迟:</h4>
            <div className="flex flex-wrap gap-2">
              {result.with_kv_cache.latencies_ms.map((latency, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-mono"
                >
                  #{index + 1}: {latency.toFixed(2)}ms
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">不使用 KV Cache 各次延迟:</h4>
            <div className="flex flex-wrap gap-2">
              {result.without_kv_cache.latencies_ms.map((latency, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm font-mono"
                >
                  #{index + 1}: {latency.toFixed(2)}ms
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SamplingTab() {
  const [text, setText] = useState('今天天气')
  const [maxNewTokens, setMaxNewTokens] = useState(10)

  const compareMutation = useMutation({
    mutationFn: () => inferenceApi.compareSampling(text, maxNewTokens),
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">采样策略对比</h3>
          <p className="text-sm text-gray-600">
            对比不同采样策略对生成结果的影响：Greedy Search、Temperature、Top-P、Top-K
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              输入文本
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              生成 Token 数: {maxNewTokens}
            </label>
            <input
              type="range"
              min={5}
              max={30}
              value={maxNewTokens}
              onChange={(e) => setMaxNewTokens(parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => compareMutation.mutate()}
            disabled={compareMutation.isPending || !text.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {compareMutation.isPending ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <BarChart3 size={18} />
            )}
            {compareMutation.isPending ? '对比中...' : '开始对比'}
          </button>
        </div>
      </div>

      {compareMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-red-600">
            {compareMutation.error instanceof Error ? compareMutation.error.message : '对比失败'}
          </div>
        </div>
      )}

      {compareMutation.data && (
        <SamplingResultDisplay result={compareMutation.data.data} />
      )}
    </div>
  )
}

function SamplingResultDisplay({ result }: { result: SamplingComparisonResult }) {
  const latencyChartData = result.comparisons.map((c) => ({
    name: c.method,
    延迟: c.latency_ms,
  }))

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">各策略延迟对比</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={latencyChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: '延迟 (ms)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="延迟" fill="#8b5cf6" name="延迟 (ms)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        {result.comparisons.map((comparison, index) => (
          <div
            key={index}
            className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 text-lg">{comparison.method}</h4>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500">
                  延迟: <span className="font-mono font-medium">{comparison.latency_ms.toFixed(2)}ms</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">参数配置:</div>
                <div className="p-3 bg-gray-50 rounded-lg text-sm font-mono">
                  <div>采样类型: {comparison.parameters.sampling_type}</div>
                  <div>Temperature: {comparison.parameters.temperature}</div>
                  <div>Top-P: {comparison.parameters.top_p}</div>
                  <div>Top-K: {comparison.parameters.top_k}</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">生成的 Token ID:</div>
                <div className="p-3 bg-primary-50 rounded-lg text-sm font-mono overflow-x-auto">
                  [{comparison.generated_tokens.join(', ')}]
                </div>
              </div>
            </div>

            {comparison.risks.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-sm font-medium text-yellow-800 mb-1">风险提示:</div>
                <ul className="text-sm text-yellow-700">
                  {comparison.risks.map((risk, riskIndex) => (
                    <li key={riskIndex}>• {risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
