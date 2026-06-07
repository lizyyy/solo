import { useState } from 'react';
import {
  BookOpen,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Upload,
  FileText,
  Link2,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Code,
  Users,
  Clock
} from 'lucide-react';

interface RuleSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: {
    title: string;
    description: string;
    codeExample?: string;
  }[];
}

const ruleSections: RuleSection[] = [
  {
    id: 'detection',
    title: '异常判定规则',
    icon: <AlertTriangle className="w-5 h-5" />,
    content: [
      {
        title: '阈值与报告值不一致判定',
        description: '当阈值实际值与报告中记录的值不相等时，系统自动判定为"阈值改过但报告仍写旧值"异常。判定精度为 0.0001，即差值小于 0.0001 时视为一致。',
        codeExample: `// 判定逻辑
const isConsistent = Math.abs(thresholdValue - reportValue) < 0.0001;

// 异常处理
if (!isConsistent) {
  status = 'pending_review'; // 标记为待复核
  hasAnomaly = true;
  // 不归入正常，等待数据科学家复核
}`
      },
      {
        title: '异常状态流转',
        description: '检测到异常后，记录状态自动设为"待复核"(pending_review)，不会自动转为"正常"。必须由数据科学家手动复核后才能改变状态。'
      }
    ]
  },
  {
    id: 'import',
    title: '导入规则',
    icon: <Upload className="w-5 h-5" />,
    content: [
      {
        title: '去重机制',
        description: '基于 noteId（调参笔记唯一标识）进行去重检测。重复导入时，数量不会翻倍，仅更新变更的字段（如阈值、备注），并生成版本历史记录。',
        codeExample: `// 去重检测
const existing = records.find(r => r.noteId === importedNoteId);

if (existing) {
  // 合并更新，不新建
  const { merged, updatedFields } = merge(existing, newData);
  // 生成版本历史
  createVersionHistory(updatedFields);
} else {
  // 新建记录
  createNewRecord();
}`
      },
      {
        title: '字段更新规则',
        description: '重复导入时，仅对比并更新有变化的字段。阈值变更会触发重新检测一致性，备注修改会单独记录版本历史。'
      }
    ]
  },
  {
    id: 'review',
    title: '复核流程',
    icon: <Users className="w-5 h-5" />,
    content: [
      {
        title: '数据科学家复核',
        description: '所有标记为"待复核"的记录，必须由数据科学家审核后方可改变状态。复核有两种结果：确认正常（阈值修改是有意为之）或需修改（需要修正报告值）。'
      },
      {
        title: '三步流程中的异常处理',
        description: '在"导入调参笔记 → 补看线上实验桶 → 分层指标更新"三步流程中，若碰到阈值改过但报告仍写旧值的情况，别急着归正常，留给数据科学家复核。异常项在分层指标更新时会高亮标记。'
      }
    ]
  },
  {
    id: 'version',
    title: '版本与回滚',
    icon: <RefreshCw className="w-5 h-5" />,
    content: [
      {
        title: '版本历史记录',
        description: '所有字段修改（阈值、备注等）都会生成版本历史记录，记录修改前、修改后的值，以及操作人和时间。修改备注时，历史中能清晰看出改前改后的差别。'
      },
      {
        title: '回滚机制',
        description: '支持回滚到任意历史版本。回滚操作本身也会生成一条新的版本历史，标记为"回滚"类型，确保操作可追溯。',
        codeExample: `// 回滚操作
const rollback = (targetVersionId) => {
  const version = getVersion(targetVersionId);
  // 恢复旧值
  restoreValue(version.fieldName, version.oldValue);
  // 生成回滚记录
  createVersionHistory({
    fieldName: version.fieldName,
    oldValue: version.newValue,
    newValue: version.oldValue,
    changeType: 'rollback'
  });
};`
      }
    ]
  },
  {
    id: 'visualization',
    title: '可视化回溯规则',
    icon: <TrendingUp className="w-5 h-5" />,
    content: [
      {
        title: '3D/图表展示要求',
        description: '选择3D或图表展示时，必须先服务复核。点击到一条"阈值改过但报告仍写旧值"的记录时，要能快速回到阈值调参笔记或线上实验桶，不能只剩漂亮画面。'
      },
      {
        title: '数据点绑定信息',
        description: '每个可视化数据点必须绑定：关联的调参笔记ID、关联的线上实验桶URL。点击时弹出快捷跳转菜单。'
      }
    ]
  },
  {
    id: 'error',
    title: '错误提示规则',
    icon: <AlertTriangle className="w-5 h-5" />,
    content: [
      {
        title: '人性化错误提示',
        description: '所有错误提示必须说人话，不能只吐内部字段名。例如：不要说"field threshold_value cannot be null"，要说"请填写阈值数值，不能为空"。',
        codeExample: `// ❌ 错误示例
throw new Error("field 'threshold_value' cannot be null");

// ✅ 正确示例
showError("请填写阈值数值，不能为空");`
      },
      {
        title: '常见错误提示对照表',
        description: '文件为空 → "请选择要导入的文件，文件不能为空"；文件格式错误 → "文件格式不正确，请上传有效的阈值调参笔记文件"；URL格式错误 → "请输入有效的线上实验桶链接"。'
      }
    ]
  },
  {
    id: 'workflow',
    title: '三步工作流',
    icon: <FileText className="w-5 h-5" />,
    content: [
      {
        title: '第一步：导入阈值调参笔记',
        description: '支持拖拽或点击上传JSON格式文件。系统自动检测阈值一致性，标记异常项。支持重复导入，自动去重合并。'
      },
      {
        title: '第二步：补看线上实验桶',
        description: '关联对应的线上实验桶链接，方便后续回溯。支持添加多个实验桶关联。'
      },
      {
        title: '第三步：分层指标更新',
        description: '记录各分层的指标变更情况。异常项会高亮显示，提醒需要数据科学家复核。完成后可提交归档。'
      }
    ]
  }
];

export const RulesPage = () => {
  const [expandedSections, setExpandedSections] = useState<string[]>(['detection']);

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 font-display mb-2">边界规则说明</h1>
        <p className="text-gray-500">
          所有规则均已代码化，消除口头约定。包含判定规则、修改流程、回滚机制等
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4 p-4 bg-primary-50 rounded-lg border border-primary-200">
          <Code className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-primary-800 mb-1">代码即规则</h3>
            <p className="text-sm text-primary-700">
              本页面描述的所有边界规则，均已在系统代码中实现。
              核心逻辑位于 <code className="px-1.5 py-0.5 bg-primary-100 rounded text-xs">src/utils/index.ts</code> 和
              <code className="px-1.5 py-0.5 bg-primary-100 rounded text-xs ml-1">src/store/index.ts</code> 中。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {ruleSections.map((section) => {
          const isExpanded = expandedSections.includes(section.id);
          return (
            <div
              key={section.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
                    {section.icon}
                  </span>
                  <h2 className="text-lg font-semibold text-gray-800 font-display">
                    {section.title}
                  </h2>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-6">
                  {section.content.map((item, index) => (
                    <div key={index} className="pt-4 border-t border-gray-100 first:border-t-0 first:pt-0">
                      <h3 className="font-medium text-gray-800 mb-2">{item.title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed mb-3">
                        {item.description}
                      </p>
                      {item.codeExample && (
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                          <code>{item.codeExample}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 font-display mb-4">
          <span className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-500" />
            快速操作指南
          </span>
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-2">
              <span className="font-bold">1</span>
            </div>
            <p className="text-sm font-medium text-gray-700">导入调参笔记</p>
            <p className="text-xs text-gray-500 mt-1">自动去重和异常检测</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-gray-700">异常自动标记</p>
            <p className="text-xs text-gray-500 mt-1">阈值≠报告值待复核</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-gray-700">科学家复核</p>
            <p className="text-xs text-gray-500 mt-1">10分钟快速审核</p>
          </div>
        </div>
      </div>
    </div>
  );
};
