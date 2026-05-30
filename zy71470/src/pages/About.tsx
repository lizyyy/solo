import { BookOpen, Code, FileText, ArrowLeft, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { versionMeta, ENGINE_VERSION } from '@/data/cieData';

export const About = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto p-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors"
        >
          <ArrowLeft size={18} />
          返回工作台
        </Link>

        <h1
          className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          关于薄膜干涉计算引擎
        </h1>
        <p className="text-gray-400 mb-8">版本追溯与物理模型说明</p>

        <div className="space-y-8">
          <section className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Code className="text-cyan-400" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">版本信息</h2>
                <p className="text-sm text-gray-400">计算引擎版本与更新记录</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="text-xs text-gray-500 mb-1">引擎版本</div>
                <div className="text-2xl font-mono text-cyan-400">v{versionMeta.engineVersion}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="text-xs text-gray-500 mb-1">模型名称</div>
                <div className="text-lg font-medium text-white">{versionMeta.modelName}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="text-xs text-gray-500 mb-1">最后更新</div>
                <div className="text-lg font-mono text-white">{versionMeta.lastUpdated}</div>
              </div>
            </div>

            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">模型描述</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {versionMeta.modelDescription}
              </p>
            </div>
          </section>

          <section className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <BookOpen className="text-purple-400" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">引用来源</h2>
                <p className="text-sm text-gray-400">物理模型与数据来源</p>
              </div>
            </div>

            <div className="space-y-3">
              {versionMeta.references.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-start gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-mono text-gray-400 flex-shrink-0">
                    {ref.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white">{ref.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {ref.authors} ({ref.year})
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">{ref.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <FileText className="text-green-400" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">计算流程说明</h2>
                <p className="text-sm text-gray-400">从参数输入到颜色输出的完整链路</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                {
                  step: '01',
                  title: '参数验证',
                  desc: '检查薄膜厚度、折射率、入射角等参数的物理合法性，检测角度单位混淆、波长范围缺失等常见错误。',
                  impact: '参数错误会直接影响后续所有计算环节，系统会明确标注受影响的计算步骤。',
                },
                {
                  step: '02',
                  title: '多光束干涉计算',
                  desc: '基于菲涅耳系数计算薄膜上下表面的多次反射，考虑s/p偏振态的不同反射特性。',
                  formula: 'r = (r₁₂ + r₂₃e^(-iδ)) / (1 + r₁₂r₂₃e^(-iδ))',
                },
                {
                  step: '03',
                  title: '光谱采样',
                  desc: '在指定波长范围内以设定步长计算每个波长的反射率，生成反射光谱曲线。',
                  note: '默认5nm步长，高精度模式支持1nm步长。波长范围必须覆盖可见光区域(380-780nm)才能获得有意义的颜色。',
                },
                {
                  step: '04',
                  title: 'CIE光谱积分',
                  desc: '使用CIE 1931标准观察者配色函数和D65标准光源，将反射光谱转换为CIE-XYZ三刺激值。',
                  formula: 'X = k∫S(λ)R(λ)x̄(λ)dλ',
                },
                {
                  step: '05',
                  title: '颜色空间转换',
                  desc: '通过IEC 61966-2-1标准矩阵将XYZ值转换为sRGB颜色空间，并进行gamma校正。',
                  note: '超出sRGB色域的颜色会被压缩，可能导致颜色饱和度降低。',
                },
                {
                  step: '06',
                  title: '结果输出',
                  desc: '输出反射光颜色、主波长、相关色温、干涉级次等关键参数，并生成3D场景渲染。',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700"
                >
                  <div className="text-2xl font-mono text-cyan-400 flex-shrink-0 w-12">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                    {item.formula && (
                      <code className="block mt-2 p-2 bg-slate-900/50 rounded text-xs font-mono text-cyan-300">
                        {item.formula}
                      </code>
                    )}
                    {item.note && (
                      <p className="text-xs text-yellow-400/80 mt-2 flex items-start gap-1">
                        <span className="text-yellow-500">⚠️</span>
                        {item.note}
                      </p>
                    )}
                    {item.impact && (
                      <p className="text-xs text-red-400/80 mt-2 flex items-start gap-1">
                        <span className="text-red-500">!</span>
                        {item.impact}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
            <h2 className="text-xl font-semibold mb-4">快速上手指南</h2>
            <div className="text-sm text-gray-400 space-y-3">
              <p>
                <span className="text-cyan-400 font-semibold">1. 调节参数：</span>
                左侧面板拖动滑块或输入数值，调整薄膜厚度、折射率、入射角等参数。
              </p>
              <p>
                <span className="text-cyan-400 font-semibold">2. 观察变化：</span>
                中间3D场景实时显示薄膜结构和反射光颜色，右侧面板展示计算结果和光谱曲线。
              </p>
              <p>
                <span className="text-cyan-400 font-semibold">3. 注意警告：</span>
                红色/黄色警告表示参数可能存在问题，请展开查看受影响的计算环节和修正建议。
              </p>
              <p>
                <span className="text-cyan-400 font-semibold">4. 对比实验：</span>
                点击"加入对比"保存当前结果，最多可对比4组实验，查看参数变化对结果的影响。
              </p>
              <p>
                <span className="text-cyan-400 font-semibold">5. 数据导出：</span>
                点击"导出数据"可保存完整的计算结果，包含引擎版本号便于后续追溯。
              </p>
            </div>
          </section>

          <div className="text-center text-gray-600 text-sm pt-4 border-t border-slate-800">
            <p>薄膜干涉颜色计算引擎 v{ENGINE_VERSION} · 用于物理教学演示</p>
            <p className="mt-1 flex items-center justify-center gap-1">
              计算结果携带版本号，确保可追溯性
              <ExternalLink size={12} />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
