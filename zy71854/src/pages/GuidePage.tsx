import React, { useState } from 'react';
import { BookOpen, FileText, SkipForward, CheckSquare, Download, ChevronDown, ChevronUp, Upload, Folder } from 'lucide-react';
import { useAppStore } from '@/store';
import { ProcessingBadge } from '@/components/common/ProcessingBadge';

export const GuidePage: React.FC = () => {
  const { scripts } = useAppStore();
  const [expandedSection, setExpandedSection] = useState<string | null>('sample');

  const skippedScripts = scripts.filter((s) => s.isSkipped);

  const sections = [
    {
      id: 'sample',
      icon: FileText,
      title: '演示脚本样例放置说明',
      description: '如何准备和放置演示脚本文件',
    },
    {
      id: 'skipped',
      icon: SkipForward,
      title: '查看被跳过的步骤',
      description: '了解哪些演示步骤被跳过及原因',
    },
    {
      id: 'review',
      icon: CheckSquare,
      title: '导出前复核清单',
      description: '导出课堂记录前的必核检查项',
    },
  ];

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const sampleCSVContent = `stepNumber,title,content
1,太阳系结构概述,太阳系由太阳、八大行星及其卫星、小行星、彗星等天体组成。
2,行星轨道特征,八大行星按距离太阳由近到远依次为：水星、金星、地球、火星、木星、土星、天王星、海王星。
3,开普勒三定律,开普勒第一定律：行星绕太阳运行的轨道是椭圆，太阳位于椭圆的一个焦点上。
4,地球轨道参数,地球轨道半长轴约1.496亿公里（1天文单位），公转周期365.256天。
5,小行星带与柯伊伯带,小行星带位于火星和木星之间，包含数百万颗小行星。`;

  const downloadSample = () => {
    const blob = new Blob(['\ufeff' + sampleCSVContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '太阳系轨道演示脚本_样例.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reviewChecklist = [
    {
      title: '数据完整性检查',
      items: [
        '所有演示脚本步骤是否已导入？',
        '零件清单是否完整，数量是否正确？',
        '零散备注是否已录入并关联到对应知识点？',
        '是否有未生成知识点的演示脚本？',
      ],
    },
    {
      title: '状态标记检查',
      items: [
        '"已确认"的知识点是否都有完整的追溯依据？',
        '"待补"的知识点是否已安排补充计划？',
        '"人工修改"的知识点是否都填写了修改原因？',
        '状态变更是否都有对应的处理口径记录？',
      ],
    },
    {
      title: '处理口径检查',
      items: [
        '重复导入的数据是否都标记了"重复导入自动合并"？',
        '人工修改的处理口径是否清晰说明修改内容？',
        '撤回操作是否都有对应的口径记录？',
        '导出前确认筛选条件是否正确？',
      ],
    },
    {
      title: '导出准备检查',
      items: [
        '确认需要导出的状态分类（已确认/待补/人工修改）',
        '确认时间范围筛选是否正确',
        '确认导出文件名是否符合规范',
        '导出后检查 CSV 文件是否能正常打开',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-graphite flex items-center gap-3">
          <BookOpen className="text-star-gold" />
          操作指南
        </h2>
        <p className="text-graphite-light mt-1">
          培训老师快速上手：样例放置、跳过步骤查看、导出前复核
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedSection === section.id;
          return (
            <div
              key={section.id}
              className="card overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    section.id === 'sample' ? 'bg-blue-100 text-blue-600' :
                    section.id === 'skipped' ? 'bg-amber-100 text-amber-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    <section.icon size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-serif font-semibold text-lg text-graphite">
                      {section.title}
                    </h3>
                    <p className="text-sm text-graphite-light">{section.description}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp size={24} className="text-graphite-light" />
                ) : (
                  <ChevronDown size={24} className="text-graphite-light" />
                )}
              </button>

              {isExpanded && (
                <div className="mt-6 pt-6 border-t border-slate-200 animate-fade-in">
                  {section.id === 'sample' && (
                    <div className="space-y-6">
                      <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
                        <h4 className="font-medium text-blue-800 mb-4 flex items-center gap-2">
                          <Upload size={20} />
                          文件格式要求
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="text-sm font-medium text-blue-700 mb-2">演示脚本 CSV 格式</h5>
                            <ul className="text-sm text-blue-600 space-y-1">
                              <li>• stepNumber / 步骤编号：演示步骤序号</li>
                              <li>• title / 标题：步骤标题</li>
                              <li>• content / 内容：详细讲解内容</li>
                            </ul>
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-blue-700 mb-2">零件清单 CSV 格式</h5>
                            <ul className="text-sm text-blue-600 space-y-1">
                              <li>• partNumber / 零件编号：零件唯一标识</li>
                              <li>• name / 名称：零件名称</li>
                              <li>• quantity / 数量：所需数量</li>
                              <li>• description / 描述：零件说明</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                        <h4 className="font-medium text-graphite mb-4 flex items-center gap-2">
                          <Folder size={20} />
                          放置位置说明
                        </h4>
                        <div className="space-y-3 text-sm text-graphite-light">
                          <p>1. 在"数据管理"页面，点击对应区域的"选择文件"按钮</p>
                          <p>2. 或直接拖拽 CSV 文件到对应的虚线框内</p>
                          <p>3. 系统会自动识别文件类型并校验格式</p>
                          <p>4. 导入成功后会显示导入数量和合并的重复数据数量</p>
                          <p>5. 重复导入同一文件时，系统会自动合并版本，保留较新内容</p>
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <button
                          onClick={downloadSample}
                          className="btn-primary flex items-center gap-2"
                        >
                          <Download size={16} />
                          下载演示脚本样例 CSV
                        </button>
                      </div>
                    </div>
                  )}

                  {section.id === 'skipped' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 mb-4">
                        <p className="text-sm text-amber-700">
                          <strong>提示：</strong>被跳过的步骤不会自动生成知识点，可以在
                          演示脚本列表中查看并决定是否恢复。
                        </p>
                      </div>

                      {skippedScripts.length === 0 ? (
                        <div className="text-center py-8">
                          <SkipForward size={48} className="mx-auto text-graphite-light mb-4 opacity-50" />
                          <p className="text-graphite-light">暂无被跳过的步骤</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {skippedScripts.map((script) => (
                            <div
                              key={script.id}
                              className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-1 rounded">
                                    步骤 {script.stepNumber}
                                  </span>
                                  <h5 className="font-medium text-graphite">{script.title}</h5>
                                </div>
                                <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded">
                                  <SkipForward size={12} className="mr-1" />
                                  已跳过
                                </span>
                              </div>
                              <p className="text-sm text-graphite-light mb-2">{script.content}</p>
                              {script.skipReason && (
                                <div className="p-2 bg-amber-50 rounded text-xs text-amber-700">
                                  <strong>跳过原因：</strong>{script.skipReason}
                                </div>
                              )}
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs text-graphite-light">
                                  来源：{script.sourceFile}
                                </span>
                                <ProcessingBadge rule={script.processingRule} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {section.id === 'review' && (
                    <div className="space-y-6">
                      <div className="p-4 bg-green-50 rounded-xl border border-green-200 mb-4">
                        <p className="text-sm text-green-700">
                          <strong>重要提示：</strong>导出课堂记录前，请务必完成以下检查，
                          确保交给教研负责人的记录准确、完整、口径一致。
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reviewChecklist.map((section, idx) => (
                          <div
                            key={idx}
                            className="p-5 bg-white rounded-xl border border-slate-200"
                          >
                            <h5 className="font-medium text-graphite mb-4 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-space-deep text-white flex items-center justify-center text-sm font-bold">
                                {idx + 1}
                              </span>
                              {section.title}
                            </h5>
                            <ul className="space-y-2">
                              {section.items.map((item, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-3 text-sm text-graphite-light"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 w-4 h-4 rounded border-slate-300 text-space-blue focus:ring-space-blue"
                                  />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      <div className="p-6 bg-space-deep/5 rounded-xl border border-space-blue/20">
                        <h5 className="font-medium text-space-deep mb-3">导出操作步骤</h5>
                        <ol className="space-y-2 text-sm text-graphite-light">
                          <li className="flex items-start gap-2">
                            <span className="font-bold text-star-gold">1.</span>
                            前往"课堂记录"页面，选择要导出的状态分类标签
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold text-star-gold">2.</span>
                            设置时间范围筛选（如需）
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold text-star-gold">3.</span>
                            确认筛选结果数量和内容正确
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold text-star-gold">4.</span>
                            点击右上角"导出当前筛选结果"按钮
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold text-star-gold">5.</span>
                            打开下载的 CSV 文件，检查首行处理口径是否正确
                          </li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
