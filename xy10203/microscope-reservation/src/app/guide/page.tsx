'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Microscope,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  CheckSquare,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Zap,
  Shield
} from 'lucide-react';

interface Step {
  id: number;
  title: string;
  description: string;
  details: string[];
  icon: React.ReactNode;
  action?: string;
  actionUrl?: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: '系统自动初始化',
    description: '首次访问系统时，数据库会自动创建并填充示例数据',
    details: [
      '4 台显微镜（蔡司、尼康、奥林巴斯、徕卡）',
      '22 个附件（倍率模块 + 样品台）',
      '3 个课题组（分子生物、细胞生物、神经科学）',
      '6 个用户账号'
    ],
    icon: <Zap className="h-6 w-6 text-yellow-500" />,
    action: '访问首页',
    actionUrl: '/'
  },
  {
    id: 2,
    title: '创建预约',
    description: '选择显微镜、附件、时间，系统自动检测冲突',
    details: [
      '选择显微镜：从4台设备中选择',
      '选择附件：倍率模块和样品台一起锁定',
      '设置时间：最短30分钟，最长24小时',
      '实时冲突检测：选择后自动检查资源占用'
    ],
    icon: <Calendar className="h-6 w-6 text-blue-500" />,
    action: '新建预约',
    actionUrl: '/reservations/new'
  },
  {
    id: 3,
    title: '处理资源冲突',
    description: '如果发现冲突，调整时间或附件后重试',
    details: [
      '冲突类型1：显微镜时间重叠',
      '冲突类型2：附件（倍率/样品台）被占用',
      '解决方案：调整时间段或更换附件',
      '提示：同一显微镜的不同附件也会冲突'
    ],
    icon: <AlertTriangle className="h-6 w-6 text-orange-500" />
  },
  {
    id: 4,
    title: '提交审批',
    description: '预约创建后自动进入待审批状态',
    details: [
      '状态变为：待审批',
      '记录操作日志：创建时间、预约人',
      '资源预锁定：其他预约无法占用相同资源',
      '可在审批中心查看所有待审批项'
    ],
    icon: <Clock className="h-6 w-6 text-yellow-500" />,
    action: '审批中心',
    actionUrl: '/approvals'
  },
  {
    id: 5,
    title: '审批确认',
    description: '管理员审核预约，批准或拒绝',
    details: [
      '二次冲突检测：审批时再次验证资源状态',
      '批准：状态变为已批准，资源正式锁定',
      '拒绝：填写拒绝原因，预约被驳回',
      '所有操作记录在操作日志中'
    ],
    icon: <CheckSquare className="h-6 w-6 text-green-500" />
  },
  {
    id: 6,
    title: '查看资源看板',
    description: '实时查看设备占用情况和统计报表',
    details: [
      '时间轴视图：按小时展示每台设备占用',
      '颜色区分：绿色=已批准，黄色=待审批',
      '统计数据：待审批、已批准、设备数量',
      '可按日期查看历史记录'
    ],
    icon: <BarChart3 className="h-6 w-6 text-purple-500" />,
    action: '资源看板',
    actionUrl: '/dashboard'
  }
];

const boundaryCases = [
  {
    title: '重复提交',
    description: '已批准的预约不能修改或重复提交',
    icon: <Shield className="h-5 w-5 text-blue-500" />
  },
  {
    title: '状态冲突',
    description: '只有待审批状态可以批准/拒绝，已批准的需要先取消',
    icon: <CheckCircle className="h-5 w-5 text-green-500" />
  },
  {
    title: '来源记录缺失',
    description: '访问不存在的预约会显示错误页面，不会静默失败',
    icon: <AlertTriangle className="h-5 w-5 text-orange-500" />
  },
  {
    title: '审批时再次冲突',
    description: '如果批准时发现新冲突，会阻止批准并提示用户',
    icon: <AlertTriangle className="h-5 w-5 text-red-500" />
  }
];

export default function GuidePage() {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));

  function toggleStep(id: number) {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSteps(newExpanded);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
              <ArrowLeft className="h-5 w-5 mr-2" />
              返回
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">使用指南</h1>
              <p className="text-sm text-gray-500">从空数据到资源看板的完整流程</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-start">
            <Microscope className="h-8 w-8 text-blue-600 mr-4 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-blue-900 mb-2">系统核心目标</h2>
              <p className="text-blue-800">
                解决实验室显微镜被多个课题组共享预约时的资源冲突问题。
                <strong className="text-blue-900">关键主线：主设备和附件组合资源的同步占用检测</strong>。
                倍率模块和样品台作为独立资源，与主设备一起锁定。
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            完整操作流程
          </h2>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="bg-white rounded-xl shadow-sm border overflow-hidden"
              >
                <button
                  onClick={() => toggleStep(step.id)}
                  className="w-full p-4 flex items-center text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold mr-2">
                        {step.id}
                      </span>
                      <h3 className="font-semibold text-gray-900">{step.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{step.description}</p>
                  </div>
                  <div className="flex items-center ml-4">
                    {step.action && step.actionUrl && (
                      <Link
                        href={step.actionUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors mr-3"
                      >
                        {step.action}
                      </Link>
                    )}
                    {expandedSteps.has(step.id) ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {expandedSteps.has(step.id) && (
                  <div className="px-4 pb-4 pt-2 border-t bg-gray-50">
                    <ul className="space-y-2">
                      {step.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start text-sm text-gray-700">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {index < steps.length - 1 && (
                  <div className="flex justify-center py-2">
                    <div className="w-0.5 h-4 bg-gray-200"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="h-5 w-5 text-purple-600 mr-2" />
            边界情况覆盖
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {boundaryCases.map((item, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Search className="h-5 w-5 text-blue-600 mr-2" />
            验收要点
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">✓ 主线验证</h3>
              <p className="text-sm text-green-700">
                在资源看板中，应能明显看出<strong>主设备和附件组合资源的同步占用</strong>。
                当一个预约被批准后，该显微镜及其选择的附件在同一时间段都不能被其他预约使用。
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">✓ 用户反馈</h3>
              <p className="text-sm text-blue-700">
                所有关键操作（提交、批准、拒绝、取消）都有明确的Toast提示。
                异常情况（冲突、状态错误、记录缺失）不会静默吞掉，会以红色错误框显示详细信息。
              </p>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-medium text-purple-800 mb-2">✓ 操作追踪</h3>
              <p className="text-sm text-purple-700">
                每个预约详情页都有完整的操作历史记录，可以追踪从创建到最终状态的每一次改动。
                包括创建、修改、提交、批准、拒绝、取消等所有操作。
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-medium text-gray-900 mb-3">快速测试路径</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold mr-2">1</span>
                访问 <Link href="/reservations/new" className="text-blue-600 hover:underline">新建预约</Link>，创建第一个预约
              </li>
              <li className="flex items-center">
                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold mr-2">2</span>
                选择相同的显微镜和附件，创建第二个预约（应该检测到冲突）
              </li>
              <li className="flex items-center">
                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold mr-2">3</span>
                访问 <Link href="/approvals" className="text-blue-600 hover:underline">审批中心</Link>，批准第一个预约
              </li>
              <li className="flex items-center">
                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold mr-2">4</span>
                访问 <Link href="/dashboard" className="text-blue-600 hover:underline">资源看板</Link>，查看设备占用情况
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
