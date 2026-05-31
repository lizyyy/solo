import { useState } from 'react';
import { BookOpen, Tag, AlertTriangle, Download, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

const Guide = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>('difficulty');

  const sections = [
    {
      id: 'difficulty',
      icon: Tag,
      title: '如何放置难度标签',
      color: 'purple',
      content: (
        <div className="space-y-4">
          <p className="text-slate-600">
            难度标签是概率树复核的核心。正确的难度标签能帮助学生和老师快速定位题目。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { level: '基础', desc: '学生应该一眼就会，90%正确率', color: 'green' },
              { level: '简单', desc: '需要简单思考，70-80%正确率', color: 'emerald' },
              { level: '中等', desc: '需要仔细分析，50-60%正确率', color: 'yellow' },
              { level: '困难', desc: '需要综合运用，30-40%正确率', color: 'orange' },
              { level: '挑战', desc: '尖子生挑战，<30%正确率', color: 'red' },
            ].map((item) => (
              <div
                key={item.level}
                className={`p-4 rounded-lg border-2 border-${item.color}-200 bg-${item.color}-50`}
              >
                <div className={`font-bold text-${item.color}-700 mb-1`}>{item.level}</div>
                <div className="text-xs text-slate-600">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h5 className="font-medium text-blue-800 mb-2">💡 放置技巧</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 根据<strong>实际答题数据</strong>调整难度，不要凭感觉</li>
              <li>• 难度标签应与<strong>知识点层级</strong>匹配</li>
              <li>• 同类型题目保持<strong>难度一致性</strong></li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'boundary',
      icon: AlertTriangle,
      title: '空集边界检查',
      color: 'amber',
      content: (
        <div className="space-y-4">
          <p className="text-slate-600">
            空集边界是最容易漏掉的情况。在概率树中，某些条件组合可能产生"不可能"的分支。
          </p>
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h5 className="font-medium text-amber-800 mb-3">🔍 检查清单</h5>
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span className="text-amber-700">
                  <strong>互斥事件</strong>：检查是否存在同时发生的互斥条件
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span className="text-amber-700">
                  <strong>条件概率</strong>：P(A|B) 中 B 是否可能发生
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span className="text-amber-700">
                  <strong>概率和为1</strong>：所有分支概率之和是否等于1
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span className="text-amber-700">
                  <strong>边界案例</strong>：0和1的极端情况
                </span>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h5 className="font-medium text-slate-700 mb-2">📌 在哪里看？</h5>
            <p className="text-sm text-slate-600">
              在<strong>记录详情页</strong>的「概率树」字段中，检查每个节点的条件描述。
              如果发现空集边界通常出现在<strong>变更历史</strong>中标记为"题库修改"的记录里。
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'export',
      icon: Download,
      title: '导出讲评稿前复核',
      color: 'green',
      content: (
        <div className="space-y-4">
          <p className="text-slate-600">
            导出讲评稿是给备课组的最终交付物。导出前请完成以下复核步骤：
          </p>
          <div className="space-y-3">
            {[
              { step: 1, title: '检查变更历史完整性', desc: '确认所有修改都有记录，操作人、原因、时间戳齐全' },
              { step: 2, title: '确认状态标记正确', desc: '"补材料"和"改结论"区分清楚，不要混淆' },
              { step: 3, title: '验证难度标签一致性', desc: '当前难度与最后一次修改记录保持一致' },
              { step: 4, title: '讲评记录已补全', desc: '确保讲评内容完整，没有空白字段' },
              { step: 5, title: '待处理原因已解决', desc: '所有待处理项都有明确的处理说明' },
            ].map((item) => (
              <div key={item.step} className="flex items-start space-x-4 p-3 bg-white rounded-lg border border-slate-200">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-700 font-bold text-sm">{item.step}</span>
                </div>
                <div>
                  <div className="font-medium text-slate-800">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h5 className="font-medium text-green-800 mb-2">✅ 导出按钮位置</h5>
            <p className="text-sm text-green-700">
              在<strong>记录详情页</strong>右上角点击「导出讲评稿」按钮，
              会生成包含完整变更历史的文本文件。
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 font-serif mb-2">
          教研组长操作指南
        </h1>
        <p className="text-slate-500">
          三步完成概率树复核工作
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;
          return (
            <div
              key={section.id}
              className="bg-white rounded-xl shadow-card overflow-hidden"
            >
              <button
              onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  section.color === 'purple' ? 'bg-purple-100' :
                  section.color === 'amber' ? 'bg-amber-100' :
                  'bg-green-100'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    section.color === 'purple' ? 'text-purple-600' :
                    section.color === 'amber' ? 'text-amber-600' :
                    'text-green-600'
                  }`} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {section.title}
                </h3>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {isExpanded && (
              <div className="px-6 pb-6 border-t border-slate-100">
                <div className="pt-4">
                  {section.content}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl border border-primary-200">
        <h4 className="font-bold text-primary-800 mb-4">📋 快速回顾</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-3xl font-bold text-primary-600">5</div>
            <div className="text-sm text-primary-700">难度等级</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-3xl font-bold text-accent-600">4</div>
            <div className="text-sm text-accent-700">检查项</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-3xl font-bold text-green-600">5</div>
            <div className="text-sm text-green-700">复核步骤</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Guide;
