import React from 'react';
import { Leaf, Upload, Play, Search, Filter, AlertTriangle, Download, CheckCircle, FileText, Clock } from 'lucide-react';

const QuickGuide: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Leaf className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">绿色债券资金用途管理系统</h1>
        <p className="text-gray-600">5分钟快速上手指南</p>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-green-600" />
          快速流程
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="font-medium text-gray-800">加载示例数据（1分钟）</h3>
              <p className="text-sm text-gray-600 mt-1">
                点击左侧边栏底部的「加载示例数据」按钮，一键导入演示数据，快速了解系统功能。
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="font-medium text-gray-800">查看总览（1分钟）</h3>
              <p className="text-sm text-gray-600 mt-1">
                在「总览」页面查看资金整体使用情况、分类分布、审核状态和待处理差异。
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="font-medium text-gray-800">处理差异（2分钟）</h3>
              <p className="text-sm text-gray-600 mt-1">
                进入「差异处理」页面，查看系统检测到的不一致项，逐一标记解决或要求解释。
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
              4
            </div>
            <div>
              <h3 className="font-medium text-gray-800">导出报告（1分钟）</h3>
              <p className="text-sm text-gray-600 mt-1">
                在「数据导入」的导出标签页，选择需要的内容，生成CSV或汇总报告。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold">数据导入</h3>
          </div>
          <div className="card-body text-sm text-gray-600 space-y-2">
            <p><strong>支持三类数据源：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><span className="text-blue-600 font-medium">募集说明书</span> - 债券基本信息、计划用途、披露标准</li>
              <li><span className="text-purple-600 font-medium">项目台账</span> - 项目执行进度、计划与实际金额</li>
              <li><span className="text-green-600 font-medium">付款凭证</span> - 实际支付记录、发票、审批</li>
            </ul>
            <p className="mt-3"><strong>CSV格式要求：</strong></p>
            <p className="text-xs bg-gray-50 p-2 rounded font-mono mt-1">
              详见「数据导入」页面右侧格式说明
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Play className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold">数据处理</h3>
          </div>
          <div className="card-body text-sm text-gray-600 space-y-2">
            <p><strong>系统自动完成：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>按「项目名称」自动匹配三类数据</li>
              <li>根据实际凭证调整用途分类</li>
              <li>检测金额、日期、分类不一致</li>
              <li>标记凭证缺口和披露口径问题</li>
              <li>记录每一项差异的影响结果</li>
            </ul>
            <p className="mt-3 text-orange-600">
              <strong>⚠️ 分类变更会直接影响审核状态和披露结果</strong>
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Search className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold">筛选查询</h3>
          </div>
          <div className="card-body text-sm text-gray-600 space-y-2">
            <p><strong>支持多维度筛选：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>按用途分类（清洁能源、清洁交通等）</li>
              <li>按审核状态（待处理、已通过、需解释）</li>
              <li>按差异状态（有/无差异）</li>
              <li>按日期范围</li>
              <li>关键词搜索（项目名、代码）</li>
              <li>多字段排序</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold">差异处理</h3>
          </div>
          <div className="card-body text-sm text-gray-600 space-y-2">
            <p><strong>五类差异自动检测：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><span className="text-red-600">用途错类</span> - 实际分类与计划不符</li>
              <li><span className="text-orange-600">凭证缺口</span> - 缺少凭证、发票或审批</li>
              <li><span className="text-yellow-600">披露口径</span> - 使用旧版披露标准</li>
              <li><span className="text-purple-600">金额不一致</span> - 三类数据金额不匹配</li>
              <li><span className="text-blue-600">日期不一致</span> - 支付日期晚于计划</li>
            </ul>
            <p className="mt-3">
              <strong>每项差异都标有具体影响结果，不会悄无声息通过</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Filter className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold">三类核心数据如何改变处理结论</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                用途归类
              </h4>
              <p className="text-sm text-blue-700">
                系统优先使用实际付款凭证的分类。如凭证多数为某一分类，即使募集说明书或台账写的是其他分类，也会以凭证为准，并标记为差异，要求解释原因。
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                凭证追踪
              </h4>
              <p className="text-sm text-green-700">
                缺少凭证、发票或审批的支出，系统会自动标记为"需解释"状态。缺口金额超过5%时，无法直接通过审核，必须补充凭证或说明原因。
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                披露版本
              </h4>
              <p className="text-sm text-yellow-700">
                使用旧版披露口径（v1.0之前）的项目，系统自动标记为高风险，要求在1个月内完成口径更新，否则影响绿色评估结果。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Download className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold">数据导出</h3>
        </div>
        <div className="card-body text-sm text-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="font-medium mb-2">CSV导出包含：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>资金用途明细表（项目、金额、分类、状态等）</li>
                <li>差异记录表（含影响分析）</li>
                <li>操作处理历史</li>
                <li>数据来源和版本信息</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-2">汇总报告包含：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>总体概览（金额、进度、差异数）</li>
                <li>分类明细（各分类金额和进度）</li>
                <li>待处理差异TOP10</li>
                <li>纯文本格式，便于转发和归档</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-gray-50">
        <div className="card-header">
          <h3 className="font-semibold">常见问题</h3>
        </div>
        <div className="card-body text-sm space-y-4">
          <div>
            <p className="font-medium text-gray-800">Q: 数据保存在哪里？</p>
            <p className="text-gray-600 mt-1">A: 所有数据保存在浏览器本地存储（LocalStorage），不会上传到服务器。建议定期导出备份。</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Q: 如何确保"项目名称"一致？</p>
            <p className="text-gray-600 mt-1">A: 建议建立标准化的项目命名规范，三类数据源使用完全相同的项目名称。</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Q: 分类变更后如何处理？</p>
            <p className="text-gray-600 mt-1">A: 系统会自动记录变更历史，包括旧值、新值、操作人和原因。变更后的记录会重新进入"待处理"状态。</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Q: 可以多人协作吗？</p>
            <p className="text-gray-600 mt-1">A: 当前版本为单用户模式。如需多人协作，建议一人维护，定期导出数据共享。</p>
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500 pb-8">
        <p>准备就绪？点击左侧「加载示例数据」开始体验吧！</p>
      </div>
    </div>
  );
};

export default QuickGuide;
