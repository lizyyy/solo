import React from 'react';
import { 
  BedDouble, 
  Users, 
  CheckSquare, 
  AlertTriangle, 
  CreditCard, 
  Package,
  Download,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Shield,
  FileText
} from 'lucide-react';

function ProcessGuide() {
  const normalCheckout = [
    {
      step: 1,
      title: '客人入住',
      description: '在「客房房单」中开房登记，选择空闲客房，录入客人信息',
      icon: Users,
      color: 'bg-blue-100 text-blue-700'
    },
    {
      step: 2,
      title: '客人退房',
      description: '客人提出退房请求，前台在「客房房单」中点击退房',
      icon: BedDouble,
      color: 'bg-green-100 text-green-700'
    },
    {
      step: 3,
      title: '清洁检查',
      description: '清洁员对客房进行清洁检查，确认无问题后在「清洁检查」中登记',
      icon: CheckSquare,
      color: 'bg-purple-100 text-purple-700'
    },
    {
      step: 4,
      title: '完成退房',
      description: '确认无任何问题后，房单状态变为「已退房」，客房恢复「空闲」',
      icon: CheckCircle,
      color: 'bg-green-100 text-green-700'
    }
  ];

  const damageProcess = [
    {
      step: 1,
      title: '发现污损',
      description: '清洁员在退房检查时发现布草有污渍或损坏',
      icon: AlertTriangle,
      color: 'bg-orange-100 text-orange-700',
      highlight: true
    },
    {
      step: 2,
      title: '报损登记',
      description: '在「报损登记」中添加记录，选择房单、布草类型、数量。系统自动检查该房单下是否已有同类布草报损，防止重复报损',
      icon: Shield,
      color: 'bg-blue-100 text-blue-700',
      highlight: true
    },
    {
      step: 3,
      title: '清洁员复核',
      description: '另一位清洁员或主管在「报损登记」中点击「确认报损」，复核后系统自动：1. 调整库存（在用→报损）；2. 生成赔付单',
      icon: CheckSquare,
      color: 'bg-purple-100 text-purple-700',
      highlight: true
    },
    {
      step: 4,
      title: '客人赔付',
      description: '前台在「客人赔付」中确认收款，点击「收款」标记为已赔付',
      icon: CreditCard,
      color: 'bg-green-100 text-green-700',
      highlight: true
    },
    {
      step: 5,
      title: '完成退房',
      description: '所有报损赔付完成后，前台在「客房房单」中点击退房',
      icon: CheckCircle,
      color: 'bg-gray-100 text-gray-700'
    }
  ];

  const prevention = [
    {
      title: '防止重复报损',
      description: '在同一房单下，相同类型的布草只能报损一次。当尝试添加第二条同类布草报损时，系统会报错：「该布草已存在 N 件报损记录，防止重复报损」',
      icon: Shield,
      color: 'border-blue-200 bg-blue-50'
    },
    {
      title: '未结房单不能退房',
      description: '如果房单下有报损记录但赔付未完成，点击退房时系统会报错：「存在 N 条未处理的报损记录，无法退房」。必须先完成所有赔付才能退房',
      icon: AlertCircle,
      color: 'border-red-200 bg-red-50'
    },
    {
      title: '报损确认后锁定',
      description: '报损一旦被「确认」，不能再取消，防止已调整的库存和已生成的赔付单被撤销',
      icon: CheckCircle,
      color: 'border-green-200 bg-green-50'
    }
  ];

  const fullWorkflow = [
    {
      step: 1,
      title: '空数据状态',
      description: '首次使用系统时，数据库已预置：5间客房、4名员工、5种布草类型、初始库存数据',
      page: '客房管理 / 库存管理'
    },
    {
      step: 2,
      title: '开房登记',
      description: '客人入住时，在「客房房单」中开房，选择空闲客房，输入客人姓名，房间状态变为「入住」',
      page: '客房房单 → 开房登记'
    },
    {
      step: 3,
      title: '退房检查',
      description: '客人退房时，清洁员进行清洁检查。如果发现布草损坏，进入报损流程；否则直接退房',
      page: '清洁检查'
    },
    {
      step: 4,
      title: '报损登记',
      description: '发现损坏后，在「报损登记」中添加记录。系统自动检查该房单+布草类型组合是否已有报损，防止重复。状态为「已上报」',
      page: '报损登记 → 新增报损',
      manual: '此步骤产生需要人工复核的记录：状态为「已上报」的报损单需要清洁主管复核确认'
    },
    {
      step: 5,
      title: '主管复核确认',
      description: '主管在「报损登记」中点击「确认报损」。系统自动：1. 库存调整（在用→报损，可用减少）；2. 生成库存变动记录；3. 生成赔付单（单价×数量）',
      page: '报损登记 → 确认报损'
    },
    {
      step: 6,
      title: '客人赔付',
      description: '前台在「客人赔付」中收取客人费用，点击「收款」标记为「已支付」。至此该报损闭环完成',
      page: '客人赔付 → 收款'
    },
    {
      step: 7,
      title: '完成退房',
      description: '确认所有赔付完成后，前台在「客房房单」中点击退房。系统检查：所有报损必须已赔付，否则阻止退房。退房后房单关闭，房间恢复「空闲」',
      page: '客房房单 → 退房'
    },
    {
      step: 8,
      title: '导出日报',
      description: '每日结束后，点击侧边栏「导出日报」按钮，下载 Excel 文件，包含：今日房单、赔付记录、库存变动、汇总数据。可给前厅和客房主管核对',
      page: '侧边栏 → 导出日报'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">操作流程说明</h2>
        <p className="text-gray-600">了解系统的完整业务流程，从入住到退房的全链路操作指南</p>
      </div>

      <section className="mb-10">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CheckCircle className="text-green-500" />
          正常退房流程（无报损）
        </h3>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            {normalCheckout.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="flex items-center">
                  <div className="text-center max-w-[180px]">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${item.color} mb-3`}>
                      <Icon size={24} />
                    </div>
                    <div className="font-semibold text-gray-800 mb-1">
                      {item.step}. {item.title}
                    </div>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                  {index < normalCheckout.length - 1 && (
                    <ArrowRight className="mx-4 text-gray-300 flex-shrink-0" size={24} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="text-orange-500" />
          发现污损赔付流程（含清洁员复核）
        </h3>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-wrap items-start justify-between">
            {damageProcess.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="flex items-start">
                  <div className="text-center max-w-[160px]">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${item.color} mb-3`}>
                      <Icon size={24} />
                    </div>
                    <div className="font-semibold text-gray-800 mb-1">
                      {item.step}. {item.title}
                    </div>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                  {index < damageProcess.length - 1 && (
                    <ArrowRight className="mx-3 mt-6 text-gray-300 flex-shrink-0" size={20} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Shield className="text-blue-500" />
          防错机制说明
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {prevention.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className={`border rounded-lg p-4 ${item.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={20} />
                  <h4 className="font-semibold text-gray-800">{item.title}</h4>
                </div>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="text-purple-500" />
          从空数据到最终导出的完整流程
        </h3>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {fullWorkflow.map((step, index) => (
            <div 
              key={step.step} 
              className={`p-4 ${index < fullWorkflow.length - 1 ? 'border-b border-gray-100' : ''} ${step.manual ? 'bg-yellow-50' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {step.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-800">{step.title}</h4>
                    {step.manual && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                        <AlertCircle size={12} />
                        需人工处理
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{step.description}</p>
                  <p className="text-xs text-blue-600">
                    操作位置：{step.page}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Download className="text-green-500" />
          日报导出说明
        </h3>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600 mb-4">
            点击侧边栏「导出日报」按钮，系统会生成一个 Excel 文件（.xlsx 格式），包含以下 4 个工作表：
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">1. 今日房单</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>房号、客人、入住/退房时间</li>
                <li>房单状态</li>
                <li>报损数、已赔付数</li>
                <li>总金额、已收金额</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">2. 赔付记录</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>房号、客人、布草类型</li>
                <li>数量、金额</li>
                <li>支付状态、支付时间</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">3. 库存变动</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>布草类型、变动数量</li>
                <li>变动类型（报损/采购等）</li>
                <li>变动时间、备注</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">4. 汇总</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>日期、今日房单数</li>
                <li>报损总数</li>
                <li>已赔付金额、待收金额</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>使用说明：</strong>此日报可同时发送给<strong>前厅主管</strong>核对赔付收款，以及<strong>客房主管</strong>核对布草报损和库存变动情况。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <AlertCircle className="text-red-500" />
          关键人工处理节点
        </h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-gray-800 mb-3">
            在完整流程中，<strong className="text-red-600">第 4 步「报损登记」</strong>是产生需要人工处理记录的节点：
          </p>
          <div className="bg-white border border-yellow-300 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">报损登记后产生的待处理记录</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-1">•</span>
                <span>状态为「已上报」的报损单需要 <strong>清洁主管复核确认</strong>（在报损登记页点击「确认报损」）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-1">•</span>
                <span>报损确认后生成的赔付单需要 <strong>前厅收款确认</strong>（在客人赔付页点击「收款」）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-1">•</span>
                <span>所有赔付完成后，<strong>前台操作退房</strong>（在客房房单页点击「退房」）</span>
              </li>
            </ul>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            系统设计保证：任何需要人工介入的环节都不会自动跳过，所有数据流转都有明确的状态标记和操作入口。
          </p>
        </div>
      </section>
    </div>
  );
}

export default ProcessGuide;
