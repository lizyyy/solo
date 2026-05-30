import { Link } from 'react-router-dom';
import { ReportPreview } from '../components/report/ReportPreview';
import { Home, ArrowLeft } from 'lucide-react';

export const ReportPage = () => {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              to="/game"
              className="p-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <Link
              to="/"
              className="p-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors"
            >
              <Home size={20} />
            </Link>
            <div>
              <h1 className="text-2xl text-[#D4A574] font-serif">修复报告</h1>
              <p className="text-white/50 text-sm">导出与当前视图一致的修复报告</p>
            </div>
          </div>
        </div>

        <ReportPreview />

        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
            <h3 className="text-[#D4A574] font-serif text-lg mb-4">导出格式</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-black/30 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <span className="text-red-400 text-xs font-bold">PDF</span>
                </div>
                <div>
                  <p className="text-white/80 text-sm">PDF 报告</p>
                  <p className="text-white/50 text-xs">
                    包含完整的修复流程、错误统计、评分详情，适合打印存档
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-black/30 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-400 text-xs font-bold">CSV</span>
                </div>
                <div>
                  <p className="text-white/80 text-sm">CSV 数据</p>
                  <p className="text-white/50 text-xs">
                    结构化数据导出，可导入Excel进行进一步分析
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
            <h3 className="text-[#D4A574] font-serif text-lg mb-4">报告内容</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4A574]/20 text-[#D4A574] flex items-center justify-center text-xs flex-shrink-0">1</span>
                <div>
                  <p className="text-white/80">基本信息</p>
                  <p className="text-white/50 text-xs">店员姓名、唱片信息、修复时间</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4A574]/20 text-[#D4A574] flex items-center justify-center text-xs flex-shrink-0">2</span>
                <div>
                  <p className="text-white/80">评分概览</p>
                  <p className="text-white/50 text-xs">音质评分、顾客耐心、库存消耗</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4A574]/20 text-[#D4A574] flex items-center justify-center text-xs flex-shrink-0">3</span>
                <div>
                  <p className="text-white/80">错误统计</p>
                  <p className="text-white/50 text-xs">三类错误独立统计，不合并显示</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4A574]/20 text-[#D4A574] flex items-center justify-center text-xs flex-shrink-0">4</span>
                <div>
                  <p className="text-white/80">详细步骤</p>
                  <p className="text-white/50 text-xs">与当前筛选条件一致的操作记录</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4A574]/20 text-[#D4A574] flex items-center justify-center text-xs flex-shrink-0">5</span>
                <div>
                  <p className="text-white/80">数据来源标记</p>
                  <p className="text-white/50 text-xs">区分系统数据和人工备注</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-sm flex items-start gap-2">
            <span className="flex-shrink-0 mt-0.5">ℹ️</span>
            <span>
              <strong>导出一致性保证：</strong>报告导出内容严格遵循当前页面的筛选条件。
              如果您在时间轴或错因分析页面设置了筛选条件，回到报告页面时导出的内容
              会自动与筛选结果保持一致。数据来源标签（系统/人工）会在导出文件中保留。
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
