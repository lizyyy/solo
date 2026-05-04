import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home, Brain, FileText, FlaskConical, Database } from 'lucide-react'
import TokenizerPage from './pages/TokenizerPage'
import InferencePage from './pages/InferencePage'
import AttentionPage from './pages/AttentionPage'
import ExperimentPage from './pages/ExperimentPage'
import DataPage from './pages/DataPage'

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/tokenizer', label: 'Tokenizer', icon: FileText },
  { path: '/inference', label: '推理演示', icon: Brain },
  { path: '/attention', label: '注意力机制', icon: Brain },
  { path: '/experiments', label: '实验管理', icon: FlaskConical },
  { path: '/data', label: '数据管理', icon: Database },
]

function NavItem({ item }: { item: typeof navItems[0] }) {
  const location = useLocation()
  const isActive = location.pathname === item.path
  const Icon = item.icon

  return (
    <Link
      to={item.path}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        isActive
          ? 'bg-primary-500 text-white shadow-md'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{item.label}</span>
    </Link>
  )
}

function HomePage() {
  const features = [
    {
      title: 'Tokenizer 可视化',
      description: '查看文本如何被切分成 token，了解 token ID 映射关系',
      path: '/tokenizer',
      icon: FileText,
    },
    {
      title: '推理演示',
      description: '体验 next-token 预测，对比不同采样策略的效果',
      path: '/inference',
      icon: Brain,
    },
    {
      title: '注意力机制',
      description: '通过热力图直观理解自注意力机制的工作原理',
      path: '/attention',
      icon: Brain,
    },
    {
      title: '实验管理',
      description: '保存和导出实验结果，支持 Markdown 和 JSON 格式',
      path: '/experiments',
      icon: FlaskConical,
    },
    {
      title: '数据管理',
      description: '导入语料和微调样本，使用内置的 seed 数据',
      path: '/data',
      icon: Database,
    },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12 fade-in">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          GPT 原理沙盘
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          一个交互式的 GPT 工作原理演示工具，帮助你理解 Tokenization、
          注意力机制、采样策略和 KV Cache 等核心概念。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.path}
              to={feature.path}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-lg hover:border-primary-300 transition-all fade-in"
            >
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Icon className="text-primary-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </Link>
          )
        })}
      </div>

      <div className="mt-12 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-8 fade-in">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">核心概念</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2">Tokenization</h3>
            <p className="text-gray-600 text-sm">
              将文本切分成子词单元（token），每个 token 映射到一个唯一的 ID。
              这是语言模型处理文本的第一步。
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2">Attention Mechanism</h3>
            <p className="text-gray-600 text-sm">
              自注意力机制允许模型在处理每个 token 时关注序列中的其他相关 token，
              捕获长距离依赖关系。
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2">Sampling Strategies</h3>
            <p className="text-gray-600 text-sm">
              Temperature、Top-P、Top-K 等采样策略控制生成文本的随机性和多样性，
              平衡创意性和一致性。
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2">KV Cache</h3>
            <p className="text-gray-600 text-sm">
              缓存之前计算的 Key/Value 状态，避免每次生成都重新计算整个序列，
              显著加速自回归推理过程。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Brain className="text-primary-600" size={28} />
              <span className="text-xl font-bold text-gray-900">GPT 原理沙盘</span>
            </Link>
            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tokenizer" element={<TokenizerPage />} />
          <Route path="/inference" element={<InferencePage />} />
          <Route path="/attention" element={<AttentionPage />} />
          <Route path="/experiments" element={<ExperimentPage />} />
          <Route path="/data" element={<DataPage />} />
        </Routes>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          GPT 原理沙盘 - 交互式理解大语言模型的工作原理
        </div>
      </footer>
    </div>
  )
}
