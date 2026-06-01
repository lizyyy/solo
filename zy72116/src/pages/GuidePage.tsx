import React, { useState } from 'react';
import { 
  BookOpen, Play, Settings, AlertTriangle, 
  ChevronDown, ChevronRight, Download, 
  FileText, Upload, BarChart3
} from 'lucide-react';

const GuidePage: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>('quickstart');

  const sections = [
    {
      id: 'quickstart',
      title: '🚀 快速开始 - 跑样例',
      icon: Play,
      content: (
        <div className="space-y-4">
          <ol className="list-decimal list-inside space-y-3">
            <li className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-slate-800">进入首页</p>
              <p className="text-sm text-slate-600 mt-1">打开应用后默认在数据导入页面</p>
            </li>
            <li className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-slate-800">点击「加载样例数据并开始分析」</p>
              <p className="text-sm text-slate-600 mt-1">
                这个按钮在左侧「快速开始」卡片中，点击后会自动加载预设的样例数据
              </p>
              <div className="mt-2 p-2 bg-white rounded border border-blue-200 font-mono text-xs">
                <p className="text-slate-500">// 样例数据包含</p>
                <p>✓ 12个数据点，每5秒采样一次</p>
                <p>✓ 2个极端值异常点（2850N、3100N）</p>
                <p>✓ 正常范围约 1250-1310N</p>
              </div>
            </li>
            <li className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-slate-800">查看分析结果</p>
              <p className="text-sm text-slate-600 mt-1">
                跳转到分析页面后，可以看到：
              </p>
              <ul className="text-sm text-slate-600 mt-2 space-y-1 ml-4">
                <li>• 图表中红色圆点标记的异常点</li>
                <li>• 异常数量统计（应该检测到 2 个异常）</li>
                <li>• 数据表格中高亮的异常行</li>
              </ul>
            </li>
            <li className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-slate-800">导出报告</p>
              <p className="text-sm text-slate-600 mt-1">
                点击右上角「导出报告」按钮，选择 HTML 格式，可获得完整的分析报告
              </p>
            </li>
          </ol>
        </div>
      )
    },
    {
      id: 'params',
      title: '⚙️ 怎么改参数',
      icon: Settings,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-3">三种检测方法</h4>
            <div className="space-y-3">
              <div className="p-3 bg-white rounded border">
                <p className="font-medium text-blue-600">IQR 四分位距法（推荐）</p>
                <p className="text-sm text-slate-600 mt-1">
                  基于统计学的四分位距，适合大多数情况。通过调整「IQR 乘数」控制灵敏度：
                </p>
                <ul className="text-sm text-slate-600 mt-2 ml-4">
                  <li>• 1.0 - 1.5：严格，容易检测出异常</li>
                  <li>• 1.5 - 2.0：适中，默认值</li>
                  <li>• 2.0 - 3.0：宽松，只检测极端异常</li>
                </ul>
              </div>
              <div className="p-3 bg-white rounded border">
                <p className="font-medium text-green-600">Z-Score 法</p>
                <p className="text-sm text-slate-600 mt-1">
                  基于标准差，假设数据呈正态分布。调整「Z-Score 阈值」：
                </p>
                <ul className="text-sm text-slate-600 mt-2 ml-4">
                  <li>• 2.0：约 95% 置信度</li>
                  <li>• 3.0：约 99.7% 置信度（默认）</li>
                </ul>
              </div>
              <div className="p-3 bg-white rounded border">
                <p className="font-medium text-amber-600">手动阈值</p>
                <p className="text-sm text-slate-600 mt-1">
                  完全人工设定上下限，适合有明确标准的场景：
                </p>
                <ul className="text-sm text-slate-600 mt-2 ml-4">
                  <li>• 设置「下限」和「上限」</li>
                  <li>• 超出范围即为异常</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>💡 提示：</strong>
              修改参数后，图表和统计数据会实时更新，方便对比不同检测方法的效果。
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'troubleshoot',
      title: '🔍 哪里看失败原因',
      icon: AlertTriangle,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <h4 className="font-medium text-red-800 mb-3">常见问题及解决</h4>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-red-700">Q: 数据校验不通过，显示"方向符号无法识别"</p>
                <p className="text-sm text-slate-600 mt-1">
                  A: 请检查数据中的「方向」列，支持以下格式：
                </p>
                <div className="mt-1 p-2 bg-white rounded font-mono text-xs">
                  正 / 负 / positive / negative / + / -
                </div>
              </div>
              <div>
                <p className="font-medium text-red-700">Q: 显示"离心力数值无效"</p>
                <p className="text-sm text-slate-600 mt-1">
                  A: 离心力列必须是纯数字，不能包含单位或其他字符。
                  例如：正确的是 "1250"，而不是 "1250N" 或 "约1250"
                </p>
              </div>
              <div>
                <p className="font-medium text-red-700">Q: 检测不到我预期的异常点</p>
                <p className="text-sm text-slate-600 mt-1">
                  A: 尝试以下方法：
                </p>
                <ul className="text-sm text-slate-600 ml-4 mt-1">
                  <li>1. 降低检测阈值（IQR乘数改小）</li>
                  <li>2. 切换检测方法试试</li>
                  <li>3. 使用「手动阈值」模式直接设定范围</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-red-700">Q: CSV 文件上传后解析错误</p>
                <p className="text-sm text-slate-600 mt-1">
                  A: 请确保 CSV 格式正确：
                </p>
                <ul className="text-sm text-slate-600 ml-4 mt-1">
                  <li>• 第一行是表头</li>
                  <li>• 使用英文逗号分隔</li>
                  <li>• 编码为 UTF-8</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-2">查看详细校验结果</h4>
            <p className="text-sm text-slate-600">
              在分析页面右侧「数据校验结果」面板中，可以看到：
            </p>
            <ul className="text-sm text-slate-600 ml-4 mt-2">
              <li>• <span className="text-red-600">错误</span>：必须修复的问题</li>
              <li>• <span className="text-amber-600">警告</span>：建议检查的问题</li>
              <li>• 每个问题都有行号和具体建议</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'dirtydata',
      title: '🧹 脏数据处理说明',
      icon: AlertTriangle,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>设计原则：</strong>
              脏材料进来时也要有交代，不静默失败，不猜测数据。
            </p>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-lg border">
              <h5 className="font-medium text-slate-800">✅ 能处理的情况</h5>
              <ul className="text-sm text-slate-600 mt-2 space-y-1">
                <li>• 方向缺失 → 标记为「未知」，产生错误提示</li>
                <li>• 数值无效 → 设为 0，产生错误提示</li>
                <li>• 单位异常 → 保留原值，产生警告</li>
                <li>• 时间间隔不均 → 正常处理，产生警告</li>
                <li>• 多种单位混用 → 全部保留，产生警告</li>
              </ul>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <h5 className="font-medium text-slate-800">❌ 不会做的事</h5>
              <ul className="text-sm text-slate-600 mt-2 space-y-1">
                <li>• 不会自动补全缺失值</li>
                <li>• 不会自动转换单位</li>
                <li>• 不会删除"看起来有问题"的数据</li>
                <li>• 不会平均或平滑原始数据</li>
              </ul>
            </div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>测试方法：</strong>
              在导入页面点击「测试脏数据处理能力」，可以加载一份预设的脏数据，
              观察系统如何给出清晰的错误和警告提示。
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'export',
      title: '📤 导出说明',
      icon: Download,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <FileText className="w-8 h-8 text-blue-600 mb-2" />
              <h5 className="font-medium text-blue-800">HTML 报告</h5>
              <p className="text-xs text-blue-600 mt-2">推荐用于交接</p>
              <ul className="text-xs text-blue-700 mt-2 space-y-1">
                <li>• 可打印，格式美观</li>
                <li>• 包含完整异常原因</li>
                <li>• 包含检测配置说明</li>
                <li>• 包含补录备注差异</li>
              </ul>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <FileText className="w-8 h-8 text-green-600 mb-2" />
              <h5 className="font-medium text-green-800">CSV 数据</h5>
              <p className="text-xs text-green-600 mt-2">用于二次分析</p>
              <ul className="text-xs text-green-700 mt-2 space-y-1">
                <li>• Excel 可直接打开</li>
                <li>• 包含异常标记列</li>
                <li>• 包含异常原因列</li>
              </ul>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <FileText className="w-8 h-8 text-purple-600 mb-2" />
              <h5 className="font-medium text-purple-800">JSON 原始数据</h5>
              <p className="text-xs text-purple-600 mt-2">用于程序处理</p>
              <ul className="text-xs text-purple-700 mt-2 space-y-1">
                <li>• 完整的会话数据</li>
                <li>• 包含所有元数据</li>
                <li>• 便于自动化处理</li>
              </ul>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h5 className="font-medium text-slate-800 mb-2">交接报告包含哪些信息？</h5>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>✅ 数据来源、处理人、处理时间</li>
              <li>✅ 异常统计摘要（数量、最大值等）</li>
              <li>✅ 每个异常点的具体原因</li>
              <li>✅ 使用的检测方法和参数</li>
              <li>✅ 补录备注及前后对比</li>
              <li>✅ 重要说明：基于原始数据，未做平均</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'supplementary',
      title: '📝 补录备注功能',
      icon: FileText,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>使用场景：</strong>
              项目助理小宋先跑一小包材料，后来发现需要临时补充一些说明
            </p>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-lg border">
              <h5 className="font-medium text-slate-800">操作步骤</h5>
              <ol className="text-sm text-slate-600 mt-2 space-y-2 list-decimal list-inside">
                <li>在分析页面右侧找到「添加补录备注」按钮</li>
                <li>输入需要补充的说明（如：工况变化、设备异常等）</li>
                <li>点击「保存」</li>
              </ol>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <h5 className="font-medium text-slate-800">补录后会发生什么</h5>
              <ul className="text-sm text-slate-600 mt-2 space-y-1">
                <li>• 页面顶部显示「有补录备注」标记</li>
                <li>• 保存补录前的数据快照</li>
                <li>• 导出报告时包含补录内容</li>
                <li>• 报告中显示补录前后的差异对比</li>
              </ul>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>⚠️ 注意：</strong>
                补录备注仅用于记录说明，<strong>不会改变</strong>异常检测的结果。
                这是为了保证检测结果的客观性和可追溯性。
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-blue-600" />
          使用说明
        </h1>
        <p className="text-slate-600">
          「游乐设施离心力提醒」工具完整使用指南
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div 
            key={section.id} 
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <section.icon className="w-5 h-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-800">{section.title}</h2>
              </div>
              {expandedSection === section.id ? (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {expandedSection === section.id && (
              <div className="px-6 pb-6">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
        <h3 className="font-semibold text-slate-800 mb-3">💡 一句话总结</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-600" />
            <span className="text-slate-700">导入数据</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span className="text-slate-700">分析异常</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-slate-700">补录备注</span>
          </div>
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-600" />
            <span className="text-slate-700">导出交接</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;
