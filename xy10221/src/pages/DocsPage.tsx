import { CheckCircle, XCircle, AlertCircle, FileText, ArrowRight } from 'lucide-react';

export function DocsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">验收文档</h2>
        <p className="mt-2 text-gray-600">
          本文档说明了校服尺码换领协同台的验证规则、验收标准和处理流程。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-green-800">验证通过</h3>
              <p className="text-sm text-green-600">可以进入后续处理</p>
            </div>
          </div>
          <p className="text-sm text-green-700">
            所有验证项都通过，换领申请与原始数据完全匹配，可以进入库存检查和处理流程。
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-red-800">验证失败</h3>
              <p className="text-sm text-red-600">需要人工处理</p>
            </div>
          </div>
          <p className="text-sm text-red-700">
            存在无法自动修复的问题，或重试次数已达上限，需要人工介入核查和处理。
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-yellow-800">可重试</h3>
              <p className="text-sm text-yellow-600">修正后可重新验证</p>
            </div>
          </div>
          <p className="text-sm text-yellow-700">
            问题可以通过修正数据解决，按照重试指引修正后可以重新进行验证。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">验证规则详解</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-gray-900">1. 尺码是否生效</h4>
            <p className="mt-2 text-sm text-gray-600">
              检查学生的尺码信息是否已激活生效。只有生效的尺码信息才被认为是可靠的基准数据。
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>通过</strong>：学生的 <code className="bg-gray-100 px-1 rounded">isSizeActive</code> 字段为 <code className="bg-gray-100 px-1 rounded">true</code></span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>失败</strong>：学生的 <code className="bg-gray-100 px-1 rounded">isSizeActive</code> 字段为 <code className="bg-gray-100 px-1 rounded">false</code></span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>可重试</strong>：需要先激活学生尺码信息后重试</span>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-gray-900">2. 发放记录核对</h4>
            <p className="mt-2 text-sm text-gray-600">
              检查换领申请关联的发放记录是否完整可靠。发放记录需要有接收人签字，且尺码和服装类型与申请一致。
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>通过条件</strong>：</span>
              </div>
              <ul className="ml-6 space-y-1 text-sm text-gray-600 list-disc">
                <li>发放记录存在且可关联</li>
                <li>接收人已签字 (<code className="bg-gray-100 px-1 rounded">recipientSignature = true</code>)</li>
                <li>发放尺码与申请中原尺码一致</li>
                <li>服装类型与申请一致</li>
              </ul>
              <div className="flex items-start gap-2 text-sm mt-3">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>失败</strong>：未找到关联的发放记录</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>可重试</strong>：缺少签字或尺码/类型不一致，补签或修正数据后可重试</span>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-gray-900">3. 换领申请匹配</h4>
            <p className="mt-2 text-sm text-gray-600">
              检查换领申请是否与原始数据对应，确保申请逻辑合理。
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>通过条件</strong>：</span>
              </div>
              <ul className="ml-6 space-y-1 text-sm text-gray-600 list-disc">
                <li>发放记录与学生匹配（学生ID一致）</li>
                <li>原尺码与申请尺码不同（确实需要换领）</li>
              </ul>
              <div className="flex items-start gap-2 text-sm mt-3">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>失败</strong>：发放记录与学生不匹配</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700"><strong>可重试</strong>：原尺码与申请尺码相同，需要修正申请尺码</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">处理流程</h3>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-stretch gap-4">
            <div className="flex-1 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">1. 创建申请</span>
              </div>
              <p className="text-sm text-blue-700">
                班主任或管理员创建换领申请，关联学生和发放记录
              </p>
            </div>
            <div className="hidden md:flex items-center">
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-900">2. 数据验证</span>
              </div>
              <p className="text-sm text-purple-700">
                系统自动验证尺码生效、发放记录、申请匹配
              </p>
            </div>
            <div className="hidden md:flex items-center">
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">3. 验证通过</span>
              </div>
              <p className="text-sm text-green-700">
                进入库存检查 → 处理 → 发货 → 完成
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">验证可重试</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-yellow-700">
                <p>1. 查看验证结果中的失败原因</p>
                <p>2. 按照重试指引修正数据</p>
                <p>3. 返回详情页点击"重新验证"</p>
                <p className="text-yellow-600">注意：最多重试 3 次</p>
              </div>
            </div>

            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-900">验证失败（人工处理）</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-red-700">
                <p>1. 查看"需要人工处理"提示</p>
                <p>2. 联系相关人员核查数据</p>
                <p>3. 手动处理后可以取消申请或重置数据</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">验收用例</h3>
        </div>
        <div className="p-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用例ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">场景描述</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">预期结果</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mock数据</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">TC-001</td>
                <td className="px-4 py-3 text-sm text-gray-600">数据完全正确，尺码已生效，发放记录完整</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    验证通过
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">小明 (req-1)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">TC-002</td>
                <td className="px-4 py-3 text-sm text-gray-600">发放尺码与登记尺码不符</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                    <XCircle className="w-3 h-3" />
                    验证失败
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">小红 (req-2)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">TC-003</td>
                <td className="px-4 py-3 text-sm text-gray-600">尺码未生效且发放记录无签字</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                    <AlertCircle className="w-3 h-3" />
                    可重试
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">小刚 (req-3)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">TC-004</td>
                <td className="px-4 py-3 text-sm text-gray-600">验证通过后检查库存</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                    库存检查中
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">小华 (req-4)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">题目边界说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">班级发放</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>换领申请必须关联具体班级</li>
              <li>统计报表按班级分组展示</li>
              <li>筛选支持按班级过滤</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-2">学生尺码</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>每个学生有登记的尺码信息</li>
              <li>尺码需生效状态才有效</li>
              <li>发放尺码需与登记尺码比对</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-2">换领库存</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>验证通过后检查目标尺码库存</li>
              <li>库存不足时无法继续推进</li>
              <li>库存信息与申请状态联动</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
