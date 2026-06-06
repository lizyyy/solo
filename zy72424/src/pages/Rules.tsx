import { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react';

export default function Rules() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const copyToClipboard = (section: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const rules = [
    {
      id: 'remark',
      title: '备注保留规则',
      icon: FileText,
      color: 'bg-amber-50 border-amber-200',
      iconColor: 'text-amber-600',
      description: '曲目别名表备注字段保留原始格式，不做任何清洗',
      rules: [
        '保留原始换行符（\\n），展示时使用 white-space: pre-wrap',
        '保留原始空格和缩进，不做 trim 处理',
        '保留特殊字符，不做转义或过滤',
        '统计展示时备注原样显示，不截断为单行',
        '历史变更记录备注字段做字符级 diff 对比',
      ],
      codeSnippet: `// src/utils/boundaryRules.ts
export const remarkPreserveRules = {
  preserveLineBreaks: true,
  preserveWhitespace: true,
  noTruncation: true,
};

// CSS 样式
.remark-preserve {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
}`,
    },
    {
      id: 'rework',
      title: '返工原因判定规则',
      icon: AlertTriangle,
      color: 'bg-danger-50 border-danger-200',
      iconColor: 'text-danger-600',
      description: '轨道备注中包含特定关键词时自动标记为待复核',
      rules: [
        '检测关键词：返工、重录、补录、修正、重新',
        '判定不区分大小写',
        '支持正则匹配配置（默认关闭）',
        '判定结果可在异常复核中人工覆盖',
        '含返工原因的记录不归入正常统计，待复核通过后计入',
      ],
      codeSnippet: `// src/utils/reworkDetector.ts
export const REWORK_KEYWORDS = ['返工', '重录', '补录', '修正', '重新'];

export function detectReworkReason(remark: string): ReworkDetectionResult {
  const matchedKeywords = REWORK_KEYWORDS.filter(
    keyword => remark.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return {
    hasRework: matchedKeywords.length > 0,
    matchedKeywords,
    detectionTime: new Date(),
  };
}`,
    },
    {
      id: 'duplicate',
      title: '重复导入规则',
      icon: FileCode,
      color: 'bg-primary-50 border-primary-200',
      iconColor: 'text-primary-600',
      description: '合同页截图基于文件哈希去重，不重复统计',
      rules: [
        '使用 SHA-256 算法计算文件哈希',
        '同一文件重复导入时更新最后导入时间，不创建新记录',
        '重复导入时统计数量不翻倍',
        '重复导入时给出明确提示，显示首次导入时间',
        '记录导入次数，便于追溯',
      ],
      codeSnippet: `// src/utils/fileHash.ts
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hash = CryptoJS.SHA256(
    CryptoJS.lib.WordArray.create(arrayBuffer)
  ).toString();
  return \`sha256_\${hash}\`;
}

export function handleDuplicateImport(
  existing: ContractScreenshot
): { updated: ContractScreenshot; message: string } {
  return {
    updated: {
      ...existing,
      lastImportTime: new Date(),
      importCount: existing.importCount + 1,
    },
    message: \`该文件已于 \${existing.lastImportTime} 导入\`,
  };
}`,
    },
    {
      id: 'history',
      title: '历史追溯规则',
      icon: FileText,
      color: 'bg-success-50 border-success-200',
      iconColor: 'text-success-600',
      description: '所有字段修改均记录完整历史，支持回滚',
      rules: [
        '记录修改前值、修改后值、操作人、时间戳',
        '单条备注修改时，历史记录中并排对比改前改后',
        '支持按操作人、时间范围筛选变更历史',
        '支持回滚到历史版本（仅限备注字段）',
        '变更记录不可删除，永久保留',
      ],
      codeSnippet: `// src/utils/historyTracker.ts
export function recordChange<T>(
  recordId: string,
  oldData: T,
  newData: T,
  fieldName: keyof T,
  changedBy: string
): ChangeHistory | null {
  const oldValue = String(oldData[fieldName] ?? '');
  const newValue = String(newData[fieldName] ?? '');
  
  if (oldValue === newValue) return null;
  
  return {
    id: generateId('history'),
    recordId,
    fieldName: String(fieldName),
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date(),
    changeType: 'update',
  };
}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary-800">
          边界规则说明
        </h1>
        <p className="text-gray-600 mt-1">
          系统核心边界规则，代码与文档同步更新，不依赖口头约定
        </p>
      </div>

      <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-3">
        <FileCode className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-primary-800">规则同步原则</p>
          <p className="text-xs text-primary-700 mt-0.5">
            本页面展示的规则与实际代码保持一致。如需修改规则，请同时更新代码和文档，
            确保边界条件明确，避免仅靠口头约定产生的歧义。
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => {
          const Icon = rule.icon;
          const isCodeExpanded = expandedCode === rule.id;

          return (
            <div key={rule.id} className={`card border ${rule.color}`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${rule.color} ${rule.iconColor}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-serif font-semibold text-primary-800">
                    {rule.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{rule.description}</p>

                  <ul className="mt-4 space-y-2">
                    {rule.rules.map((r, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-primary-500 mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4">
                    <button
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                      onClick={() =>
                        setExpandedCode(isCodeExpanded ? null : rule.id)
                      }
                    >
                      {isCodeExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      查看代码实现
                    </button>

                    {isCodeExpanded && (
                      <div className="mt-3 relative">
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto scrollbar-thin">
                          <code>{rule.codeSnippet}</code>
                        </pre>
                        <button
                          className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors"
                          onClick={() => copyToClipboard(rule.id, rule.codeSnippet)}
                        >
                          {copiedSection === rule.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3 className="text-lg font-serif font-semibold text-primary-800 mb-4">
          三步工作流规范
        </h3>
        <div className="space-y-4">
          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary-700 text-white flex items-center justify-center font-serif font-bold flex-shrink-0">
              1
            </div>
            <div>
              <h4 className="font-medium text-primary-800">合同页截图第一次导入</h4>
              <p className="text-sm text-gray-600 mt-1">
                店长上传合同截图，系统自动基于 SHA-256 哈希去重，同一文件重复导入不翻倍统计。
                导入时保留原始文件名和上传时间。
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary-700 text-white flex items-center justify-center font-serif font-bold flex-shrink-0">
              2
            </div>
            <div>
              <h4 className="font-medium text-primary-800">琴行店长老周补看曲目别名表</h4>
              <p className="text-sm text-gray-600 mt-1">
                店长对照截图补充/修正曲目别名和备注。备注字段保留原始换行和格式，
                系统不做任何清洗。修改时自动记录变更历史，可查看改前改后差异。
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary-700 text-white flex items-center justify-center font-serif font-bold flex-shrink-0">
              3
            </div>
            <div>
              <h4 className="font-medium text-primary-800">排练变更记录更新</h4>
              <p className="text-sm text-gray-600 mt-1">
                基于别名表更新迟到统计。系统自动检测轨道备注，
                如包含「返工、重录、补录、修正、重新」关键词，自动标记为待复核，
                不归入正常统计，留给版权运营复核。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
