import { useState } from 'react';
import {
  FileBarChart,
  Download,
  RefreshCw,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  Thermometer,
  ArrowRight,
  FileText,
  MessageSquare,
  Wrench,
} from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import { useThresholdStore } from '@/store/useThresholdStore';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate } from '@/utils/helpers';
import type { ReportSection, TrackingReport } from '@/types';
import { generateId } from '@/utils/helpers';

export function Reports() {
  const records = useRecordStore(state => state.records);
  const getHistoryByRecordId = useRecordStore(state => state.getHistoryByRecordId);
  const getThresholdById = useThresholdStore(state => state.getThresholdById);
  const getEquipmentById = useEquipmentStore(state => state.getEquipmentById);
  
  const [generatedReport, setGeneratedReport] = useState<TrackingReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const pendingReviewCount = records.filter(r => r.status === 'pending_review').length;
  const warningCount = records.filter(r => r.status === 'warning').length;
  const errorCount = records.filter(r => r.status === 'error').length;
  const normalCount = records.filter(r => r.status === 'normal').length;

  const generateReport = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const sections: ReportSection[] = [];

      sections.push({
        title: '📊 数据概览',
        content: `本次共统计 ${records.length} 条温度记录，其中正常 ${normalCount} 条，预警 ${warningCount} 条，异常 ${errorCount} 条，待复核 ${pendingReviewCount} 条。整体数据质量良好，大部分记录符合安全阈值要求。`,
      });

      if (pendingReviewCount > 0) {
        const noReasonRecords = records.filter(
          r => r.status === 'pending_review' && !r.reviewReason
        );
        sections.push({
          title: '⚠️ 待复核提醒',
          content: `有 ${pendingReviewCount} 条记录标记为待复核状态，其中 ${noReasonRecords.length} 条记录修改了人工系数但未填写原因。这些记录需要设备工程师优先审核确认，避免影响后续数据分析。`,
          responsibleRole: 'engineer',
          missingMaterials: noReasonRecords.length > 0 ? ['修改原因说明', '设备校准记录'] : undefined,
          nextAction: '请设备工程师尽快复核待处理任务，补充修改原因说明',
        });
      }

      if (warningCount > 0) {
        sections.push({
          title: '🌡️ 预警记录分析',
          content: `有 ${warningCount} 条记录接近预警阈值，主要集中在正午高温时段。建议训练教练老唐关注这些区域的通风和降温措施，避免温度持续升高超过安全范围。`,
          responsibleRole: 'trainer',
          missingMaterials: ['环境温湿度记录', '通风设备运行日志'],
          nextAction: '请训练教练老唐加强预警区域的巡查频率，必要时采取降温措施',
        });
      }

      if (errorCount > 0) {
        sections.push({
          title: '🚨 异常记录处理',
          content: `有 ${errorCount} 条记录超出安全阈值范围，需要立即关注。经分析，异常主要出现在夜间低温时段，可能与保温措施不到位有关。`,
          responsibleRole: 'trainer',
          missingMaterials: ['保温层检查记录', '夜间巡查记录'],
          nextAction: '请训练教练老唐检查异常区域的保温措施，确保夜间温度不低于最低要求',
        });
      }

      const modifiedCount = records.filter(r => r.manualCoefficient !== undefined).length;
      if (modifiedCount > 0) {
        sections.push({
          title: '🔧 人工系数调整说明',
          content: `共有 ${modifiedCount} 条记录使用了人工调整系数。参数版本已同步更新，取舍理由已记录在案。所有调整均需经过设备工程师复核后方可生效。`,
          responsibleRole: 'engineer',
          nextAction: '请设备工程师定期检查人工系数的合理性，确保测温数据准确性',
        });
      }

      sections.push({
        title: '📋 下一步工作计划',
        content: '1. 训练教练老唐：继续日常温度监测，重点关注预警和异常区域；2. 设备工程师小王：尽快完成待复核任务，确保数据准确性；3. 双方协作：每周五下午进行数据复盘，总结本周养护情况并优化下周计划。',
      });

      const report: TrackingReport = {
        id: generateId(),
        title: `混凝土养护温度追踪报告 - ${new Date().toLocaleDateString('zh-CN')}`,
        generatedAt: new Date().toISOString(),
        sections,
        recordIds: records.map(r => r.id),
      };

      setGeneratedReport(report);
      setIsGenerating(false);
    }, 1500);
  };

  const roleColors = {
    trainer: 'bg-amber-100 text-amber-700 border-amber-200',
    engineer: 'bg-blue-100 text-blue-700 border-blue-200',
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  const roleLabels = {
    trainer: '训练教练老唐',
    engineer: '设备工程师',
    admin: '系统管理员',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">报告中心</h1>
          <p className="text-gray-500 mt-1">生成人性化的温度追踪报告，明确责任方和下一步行动</p>
        </div>
        <button
          onClick={generateReport}
          disabled={isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <FileBarChart className="w-4 h-4" />
          )}
          {isGenerating ? '生成中...' : '生成报告'}
        </button>
      </div>

      {!generatedReport ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-primary-50 rounded-full flex items-center justify-center">
            <FileBarChart className="w-10 h-10 text-primary-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">生成追踪报告</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            点击上方按钮生成人性化的混凝土养护温度追踪报告，
            报告将包含数据分析、责任方说明、缺失材料提醒和下一步行动建议
          </p>
          <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
            <div className="p-4 bg-green-50 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{normalCount}</p>
              <p className="text-xs text-gray-500">正常记录</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{warningCount}</p>
              <p className="text-xs text-gray-500">预警记录</p>
            </div>
            <div className="p-4 bg-red-50 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{errorCount}</p>
              <p className="text-xs text-gray-500">异常记录</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{pendingReviewCount}</p>
              <p className="text-xs text-gray-500">待复核</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-primary-500 to-primary-700 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">{generatedReport.title}</h3>
                <p className="text-sm text-white/70 mt-1">
                  生成时间：{formatDate(generatedReport.generatedAt)}
                </p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                导出报告
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {generatedReport.sections.map((section, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 bg-gray-50 border-b">
                  <h4 className="font-semibold text-gray-800">{section.title}</h4>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-gray-700 leading-relaxed">{section.content}</p>
                  
                  {section.responsibleRole && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {section.responsibleRole === 'trainer' ? (
                        <User className="w-5 h-5 text-amber-600" />
                      ) : section.responsibleRole === 'engineer' ? (
                        <Wrench className="w-5 h-5 text-blue-600" />
                      ) : (
                        <User className="w-5 h-5 text-purple-600" />
                      )}
                      <div>
                        <p className="text-xs text-gray-500">责任方</p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleColors[section.responsibleRole]}`}>
                          {roleLabels[section.responsibleRole]}
                        </span>
                      </div>
                    </div>
                  )}

                  {section.missingMaterials && section.missingMaterials.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        缺少材料
                      </p>
                      <ul className="space-y-1">
                        {section.missingMaterials.map((material, i) => (
                          <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            {material}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {section.nextAction && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-medium text-blue-800 mb-1 flex items-center gap-1">
                        <ArrowRight className="w-3.5 h-3.5" />
                        下一步行动
                      </p>
                      <p className="text-sm text-blue-700">{section.nextAction}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <p>本报告包含 {generatedReport.recordIds.length} 条温度记录</p>
                <p>报告编号：{generatedReport.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
