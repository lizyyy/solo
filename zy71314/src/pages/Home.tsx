import { useState } from 'react';
import { Github, HelpCircle, BookOpen, X } from 'lucide-react';
import DataInput from '@/components/DataInput';
import ResultDisplay from '@/components/ResultDisplay';
import ChartPanel from '@/components/ChartPanel';
import ErrorAnalysis from '@/components/ErrorAnalysis';
import DemoSamples from '@/components/DemoSamples';
import ReportGenerator from '@/components/ReportGenerator';
import ValidationPanel from '@/components/ValidationPanel';

export default function Home() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-white text-xl">🔬</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">单摆重力加速度计算器</h1>
                <p className="text-xs text-slate-400">高中物理实验数据处理平台</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHelp(true)}
                className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                title="使用帮助"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                title="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <DataInput />
            <ValidationPanel />
            <ResultDisplay />
            <ChartPanel />
          </div>

          <div className="space-y-6">
            <DemoSamples />
            <ErrorAnalysis />
            <ReportGenerator />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-700/50 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>© 2024 单摆实验平台 - 为高中物理兴趣课设计</p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-slate-400 transition-colors">使用说明</a>
              <a href="#" className="hover:text-slate-400 transition-colors">物理原理</a>
              <a href="#" className="hover:text-slate-400 transition-colors">关于我们</a>
            </div>
          </div>
        </div>
      </footer>

      {showHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-bold text-white">使用帮助</h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">📊 基本使用流程</h3>
                <ol className="space-y-2 text-slate-300 text-sm">
                  <li>1. 在"实验数据输入"区域填写摆长、周期等实验数据</li>
                  <li>2. 点击"添加"按钮将数据加入表格</li>
                  <li>3. 添加至少2组有效数据后，点击"开始计算"</li>
                  <li>4. 查看计算结果、可视化图表和误差分析</li>
                  <li>5. 导出PDF报告或Excel数据</li>
                </ol>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white mb-3">📐 物理原理</h3>
                <div className="bg-slate-700/30 rounded-xl p-4 text-sm text-slate-300">
                  <p className="mb-2">根据单摆周期公式：</p>
                  <p className="text-center text-lg font-mono text-blue-400 mb-3">
                    T = 2π√(L/g)
                  </p>
                  <p className="mb-2">变形得到重力加速度：</p>
                  <p className="text-center text-lg font-mono text-green-400 mb-3">
                    g = 4π²L / T²
                  </p>
                  <p>通过多组数据做 T²-L 线性拟合，从斜率计算重力加速度。</p>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white mb-3">⚠️ 注意事项</h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li>• 摆角应小于15°，否则小角度近似不成立</li>
                  <li>• 摆长是从悬点到小球质心的距离</li>
                  <li>• 建议测量多个周期的总时间以减小误差</li>
                  <li>• 确保单摆在竖直平面内摆动</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white mb-3">🎯 演示样例说明</h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li><span className="text-amber-400">大角度近似失效：</span>展示摆角过大时的系统误差</li>
                  <li><span className="text-red-400">周期漏记样例：</span>演示漏记半个周期的典型错误</li>
                  <li><span className="text-blue-400">离群点回归：</span>展示如何检测和处理异常数据</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
