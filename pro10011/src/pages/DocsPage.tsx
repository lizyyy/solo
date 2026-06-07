import { useState } from 'react';
import { ChevronRight, ChevronDown, Play, FileUp, Edit3, Eye, Download } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { downloadTemplate } from '../utils/fileParser';

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

export const DocsPage = () => {
  const [expandedSections, setExpandedSections] = useState<string[]>(['start', 'import', 'judgment']);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const sections: Section[] = [
    {
      id: 'start',
      title: '系统启动',
      content: (
        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
            <p className="font-medium text-gray-900 mb-2">启动步骤</p>
            <ol className="space-y-2 list-decimal list-inside">
              <li>打开终端，进入项目根目录</li>
              <li>执行 <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">npm install</code> 安装依赖（首次运行）</li>
              <li>执行 <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">npm run dev</code> 启动开发服务器</li>
              <li>浏览器自动打开或手动访问 <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">http://localhost:5173</code></li>
            </ol>
          </div>
          <div className="bg-blue-50 p-4 rounded-sm border border-blue-200">
            <p className="font-medium text-blue-900 mb-2">说明</p>
            <ul className="space-y-1 text-blue-800">
              <li>• 系统首次启动时会自动加载 35 条 Mock 示例数据</li>
              <li>• 所有操作记录保存在浏览器 LocalStorage 中，刷新页面不丢失</li>
              <li>• 如需重置数据，可在浏览器控制台执行 <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">localStorage.clear()</code></li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'import',
      title: '导入样例',
      content: (
        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
            <p className="font-medium text-gray-900 mb-2">操作步骤</p>
            <ol className="space-y-3 list-decimal list-inside">
              <li>
                <span className="font-medium">下载模板</span>
                <p className="mt-1 ml-5 text-gray-600">
                  在「材料导入」页面点击「下载导入模板」按钮，获取标准 Excel 模板
                </p>
              </li>
              <li>
                <span className="font-medium">填写数据</span>
                <p className="mt-1 ml-5 text-gray-600">
                  按照模板格式填写数据，必填字段：交易编号、交易对手、产品类型、名义本金
                </p>
              </li>
              <li>
                <span className="font-medium">上传文件</span>
                <p className="mt-1 ml-5 text-gray-600">
                  拖拽文件到上传区域，或点击「选择文件」按钮选择文件
                </p>
              </li>
              <li>
                <span className="font-medium">预览确认</span>
                <p className="mt-1 ml-5 text-gray-600">
                  系统解析后预览前 10 条数据，确认无误后点击「确认导入」
                </p>
              </li>
              <li>
                <span className="font-medium">导入完成</span>
                <p className="mt-1 ml-5 text-gray-600">
                  导入成功后自动跳转到异常列表页面
                </p>
              </li>
            </ol>
          </div>
          
          <div className="bg-white p-4 rounded-sm border border-gray-200">
            <p className="font-medium text-gray-900 mb-3">导入模板字段说明</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">字段名</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">必填</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">说明</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-mono">交易编号</td>
                  <td className="py-2 px-3"><span className="text-red-500">是</span></td>
                  <td className="py-2 px-3">场外期权交易的唯一标识</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-mono">交易对手</td>
                  <td className="py-2 px-3"><span className="text-red-500">是</span></td>
                  <td className="py-2 px-3">对手方机构名称</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-mono">产品类型</td>
                  <td className="py-2 px-3"><span className="text-red-500">是</span></td>
                  <td className="py-2 px-3">期权产品类型（欧式、雪球、凤凰等）</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-mono">名义本金</td>
                  <td className="py-2 px-3"><span className="text-red-500">是</span></td>
                  <td className="py-2 px-3">交易名义本金金额（元）</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-mono">估值金额</td>
                  <td className="py-2 px-3">否</td>
                  <td className="py-2 px-3">当前版本的估值金额</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-mono">估值版本</td>
                  <td className="py-2 px-3">否</td>
                  <td className="py-2 px-3">版本号，如 V1、V2 等</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono">说明</td>
                  <td className="py-2 px-3">否</td>
                  <td className="py-2 px-3">该版本的临时说明，将作为版本备注保存</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700 transition-colors"
          >
            <Download size={14} />
            下载导入模板
          </button>
        </div>
      )
    },
    {
      id: 'judgment',
      title: '人工改判（旧理由盖掉）',
      content: (
        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
            <p className="font-medium text-gray-900 mb-2">操作步骤</p>
            <ol className="space-y-3 list-decimal list-inside">
              <li>
                <span className="font-medium">进入异常列表</span>
                <p className="mt-1 ml-5 text-gray-600">
                  在左侧菜单点击「异常列表」，查看所有记录
                </p>
              </li>
              <li>
                <span className="font-medium">找到目标记录</span>
                <p className="mt-1 ml-5 text-gray-600">
                  使用筛选器缩小范围，或直接搜索交易编号
                </p>
              </li>
              <li>
                <span className="font-medium">点击改判按钮</span>
                <p className="mt-1 ml-5 text-gray-600">
                  在操作列点击「编辑」图标（小铅笔），弹出改判窗口
                </p>
              </li>
              <li>
                <span className="font-medium">选择新状态</span>
                <p className="mt-1 ml-5 text-gray-600">
                  在下拉框中选择新的状态：待处理、正常、异常、误命中
                </p>
              </li>
              <li>
                <span className="font-medium">填写改判理由</span>
                <p className="mt-1 ml-5 text-gray-600">
                  在文本框中输入新的改判理由，旧理由会显示在上方并自动留存
                </p>
              </li>
              <li>
                <span className="font-medium">确认改判</span>
                <p className="mt-1 ml-5 text-gray-600">
                  点击「确认改判」按钮提交
                </p>
              </li>
            </ol>
          </div>

          <div className="bg-amber-50 p-4 rounded-sm border border-amber-200">
            <p className="font-medium text-amber-900 mb-2">旧理由处理规则</p>
            <ul className="space-y-1 text-amber-800">
              <li>• <strong>自动留存</strong>：每次改判时，旧状态和旧理由会自动保存到历史记录中</li>
              <li>• <strong>不可删除</strong>：改判历史永久保存，不可删除或修改</li>
              <li>• <strong>界面显示</strong>：旧理由以灰色斜体删除线样式显示，新理由正常显示</li>
              <li>• <strong>追溯查看</strong>：在记录详情页的「人工改判历史」标签页可查看所有改判记录</li>
            </ul>
          </div>

          <div className="bg-white p-4 rounded-sm border border-gray-200">
            <p className="font-medium text-gray-900 mb-2">查看改判历史</p>
            <ol className="space-y-2 list-decimal list-inside text-gray-600">
              <li>在异常列表中点击交易编号，进入记录详情页</li>
              <li>点击「人工改判历史」标签页</li>
              <li>点击每条记录左侧的展开箭头，可查看改判前后的详细对比</li>
              <li>左侧显示改判前（旧）的状态和理由，右侧显示改判后（新）的状态和理由</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: 'filter',
      title: '名单误命中筛选',
      content: (
        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
            <p className="font-medium text-gray-900 mb-2">操作说明</p>
            <ul className="space-y-2 text-gray-600">
              <li>• 在异常列表页面的筛选栏中，勾选「排除名单误命中」复选框</li>
              <li>• 系统将自动过滤掉所有标记为「误命中」的记录</li>
              <li>• 如需仅查看误命中记录，在状态筛选中选择「误命中」即可</li>
              <li>• 取消勾选即可恢复显示所有记录</li>
            </ul>
          </div>
          <div className="bg-green-50 p-4 rounded-sm border border-green-200">
            <p className="font-medium text-green-900 mb-2">应用场景</p>
            <ul className="space-y-1 text-green-800">
              <li>• 集中处理真实异常时，排除已知的误命中记录</li>
              <li>• 核对误命中名单时，单独筛选出所有误命中记录</li>
              <li>• 避免误命中记录干扰正常的异常处理流程</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'chart',
      title: '图表钻取明细',
      content: (
        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
            <p className="font-medium text-gray-900 mb-2">功能说明</p>
            <ul className="space-y-2 text-gray-600">
              <li>• 在工作台首页的异常概览图表中，点击任意饼图区块或柱形</li>
              <li>• 系统会自动跳转到异常列表页面，并按点击的状态进行筛选</li>
              <li>• 例如：点击饼图的「异常」区块，列表会只显示状态为「异常」的记录</li>
              <li>• 点击统计卡片也有同样的钻取效果</li>
            </ul>
          </div>
          <div className="bg-blue-50 p-4 rounded-sm border border-blue-200">
            <p className="font-medium text-blue-900 mb-2">特点</p>
            <ul className="space-y-1 text-blue-800">
              <li>• 从汇总数据直接定位到明细记录，不只是停留在汇总层面</li>
              <li>• 减少手动筛选操作，提高处理效率</li>
              <li>• 支持饼图和柱状图两种图表的交互钻取</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'version',
      title: '估值版本链路追踪',
      content: (
        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
            <p className="font-medium text-gray-900 mb-2">查看方式</p>
            <ol className="space-y-2 list-decimal list-inside text-gray-600">
              <li>在异常列表中点击任意交易编号，进入记录详情页</li>
              <li>默认显示「估值版本链路」标签页</li>
              <li>按时间顺序展示所有估值版本，最新版本高亮显示</li>
              <li>每个版本包含：版本号、估值金额、操作人、版本说明</li>
            </ol>
          </div>
          <div className="bg-amber-50 p-4 rounded-sm border border-amber-200">
            <p className="font-medium text-amber-900 mb-2">设计说明</p>
            <ul className="space-y-1 text-amber-800">
              <li>• 解决同事给的估值版本记录夹着临时说明的问题</li>
              <li>• 把各版本的临时说明和最终状态聚合到一起展示</li>
              <li>• 形成完整的追踪链路，从初版到最终结论一目了然</li>
              <li>• 最新版本突出显示，便于快速识别当前状态</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  return (
    <Layout title="说明文档">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-sm p-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">场外期权敞口穿透预警 - 操作指南</h1>
          <p className="text-sm text-gray-500 mb-6">系统使用说明，涵盖主要操作步骤</p>
          
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.id} className="border border-gray-200 rounded-sm overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {section.id === 'start' && <Play size={16} className="text-green-600" />}
                    {section.id === 'import' && <FileUp size={16} className="text-blue-600" />}
                    {section.id === 'judgment' && <Edit3 size={16} className="text-amber-600" />}
                    {section.id === 'filter' && <Eye size={16} className="text-purple-600" />}
                    {section.id === 'chart' && <Eye size={16} className="text-cyan-600" />}
                    {section.id === 'version' && <FileUp size={16} className="text-indigo-600" />}
                    <span className="text-sm font-medium text-gray-900">{section.title}</span>
                  </div>
                  {expandedSections.includes(section.id) ? (
                    <ChevronDown size={18} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={18} className="text-gray-400" />
                  )}
                </button>
                {expandedSections.includes(section.id) && (
                  <div className="p-4 border-t border-gray-200">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};
