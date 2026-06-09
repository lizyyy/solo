import PageContainer from '@/components/layout/PageContainer';
import RecordTable from '@/components/inspection/RecordTable';
import DuplicateBanner from '@/components/inspection/DuplicateBanner';
import ConfirmPanel from '@/components/inspection/ConfirmPanel';
import Drawer from '@/components/common/Drawer';
import WarningDetailContent from '@/components/common/WarningDetailContent';
import { useAppStore } from '@/store/useAppStore';
import { PlusCircle, Download, RefreshCw } from 'lucide-react';

export default function InspectionsPage() {
  const records = useAppStore((s) => s.records);
  const warnings = useAppStore((s) => s.warnings);
  const selectedId = useAppStore((s) => s.selectedRecordId);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const getRecordById = useAppStore((s) => s.getRecordById);
  const selected = selectedId ? getRecordById(selectedId) : undefined;
  const rules = useAppStore((s) => s.rules);

  return (
    <PageContainer
      title="巡检明细与异常管理"
      subtitle="录入、查看、确认巡检数据。若顶部出现黄色提示条，请先处理设备编号重复的人工确认——系统会等您选择后再给出最终预警数字。"
      breadcrumb={[{ label: '巡检明细' }]}
      actions={
        <>
          <button className="btn-secondary">
            <Download className="w-4 h-4" />
            导出巡检表
          </button>
          <button className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            同步口径
          </button>
          <button className="btn-primary">
            <PlusCircle className="w-4 h-4" />
            新建巡检记录
          </button>
        </>
      }
    >
      <DuplicateBanner />
      <RecordTable records={records} warnings={warnings} />

      <div className="card-base p-5">
        <h3 className="section-title">材料入口与异常出口指引</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-gradient-to-br from-industrial-50 to-white border border-industrial-100">
            <div className="text-xs font-bold text-industrial-600 uppercase tracking-wider mb-2">
              ▶ 材料入口
            </div>
            <ol className="space-y-1.5 text-industrial-600 text-xs leading-relaxed list-decimal pl-4">
              <li>右上角「新建巡检记录」按钮</li>
              <li>填写设备编号 → 测量值 → 上传现场照片</li>
              <li>有补充说明可在备注栏追加（自动标记后补）</li>
              <li>附件必须在巡检后 24h 内上传，否则标记「晚到」</li>
            </ol>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-alert-orange/10 to-white border border-alert-orange/20">
            <div className="text-xs font-bold text-[#b54a1e] uppercase tracking-wider mb-2">
              ▶ 异常出口
            </div>
            <ol className="space-y-1.5 text-industrial-600 text-xs leading-relaxed list-decimal pl-4">
              <li>表格行点击 → 打开「异常详情抽屉」</li>
              <li>按步骤追踪：原始数据 → 中间计算 → 阈值判定 → 等级</li>
              <li>设备重复先处理顶部黄色条，确认后数字自动刷新</li>
              <li>所有变动记入历史时间线，随时回溯原因</li>
            </ol>
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selected ? `异常详情 · ${selected.equipment_no}` : '异常详情'}
        subtitle={selected ? `${selected.pipeline_name} · ${selected.area}` : undefined}
        widthClass="max-w-xl w-full"
      >
        {selected && <WarningDetailContent record={selected} warnings={warnings} />}
      </Drawer>

      <ConfirmPanel />
    </PageContainer>
  );
}
