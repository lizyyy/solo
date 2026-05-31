import { useRecordStore } from '@/store/useRecordStore';
import { ProcessingGuide } from '@/components/ExportReport/ProcessingGuide';
import { CategoryCard } from '@/components/ExportReport/CategoryCard';
import { ExportButton } from '@/components/ExportReport/ExportButton';

export function ExportPage() {
  const records = useRecordStore((state) => state.records);

  const confirmedRecords = records.filter((r) => r.status === 'confirmed');
  const supplementRecords = records.filter((r) => r.status === 'to_supplement');
  const modifiedRecords = records.filter(
    (r) => r.status === 'modified' || r.isManualModified
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">导出报告</h1>
        <p className="text-slate-500">
          教研负责人视图 - 按分类查看记录并导出完整报告
        </p>
      </div>

      <div className="space-y-6">
        <ExportButton records={records} />

        <ProcessingGuide />

        <div className="grid lg:grid-cols-3 gap-6">
          <CategoryCard
            title="已确认"
            description="数据复核无误"
            records={confirmedRecords}
            icon="confirmed"
            color="bg-gradient-to-r from-green-600 to-green-500"
          />
          <CategoryCard
            title="待补充"
            description="需要补充信息"
            records={supplementRecords}
            icon="supplement"
            color="bg-gradient-to-r from-amber-600 to-amber-500"
          />
          <CategoryCard
            title="人工改过"
            description="已进行人工修正"
            records={modifiedRecords}
            icon="modified"
            color="bg-gradient-to-r from-blue-600 to-blue-500"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">使用说明</h3>
          <div className="space-y-3 text-slate-600 text-sm">
            <p>
              <strong>1. 导出报告前复核：</strong>
              请先确认"待补充"记录都已处理完毕，确保所有需要确认的记录都已标记为"已确认"。
            </p>
            <p>
              <strong>2. 处理口径说明：</strong>
              导出的 Excel 文件中每个工作表首行都会显示对应的处理口径说明，方便教研负责人快速了解分类标准。
            </p>
            <p>
              <strong>3. 人工改过记录：</strong>
              对于标记为"人工改过"的记录，建议在课堂上重点讲解，说明常见错误类型和修正方法。
            </p>
            <p>
              <strong>4. 评分表放置：</strong>
              建议将导出的课堂记录作为评分依据，与学生提交的评分表放在同一文件夹，便于后续查阅和归档。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
