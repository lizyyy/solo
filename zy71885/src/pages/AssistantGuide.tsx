import {
  BookOpen,
  Upload,
  SearchCheck,
  FileDown,
  PenTool,
  History,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AssistantGuide() {
  const navigate = useNavigate();

  const steps = [
    {
      icon: Upload,
      title: "第一步：导入传感器日志",
      content: (
        <ul className="space-y-2 text-sm text-lab-textMuted">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              进入 <button onClick={() => navigate("/import")} className="text-lab-accent hover:underline">导入页</button>，点击「下载样例」获取传感器日志样例模板
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              将传感器导出的 CSV 或 JSON 文件拖拽到虚线框内，或点击选择文件
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              确认导入预览无误后，点击「确认导入」—— 所有导入记录自动标记为「待处理」
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              实验记录晚到半天时，使用「手动补录」Tab 逐条录入
            </span>
          </li>
        </ul>
      ),
    },
    {
      icon: SearchCheck,
      title: "第二步：查看零点漂移并复核",
      content: (
        <ul className="space-y-2 text-sm text-lab-textMuted">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              进入 <button onClick={() => navigate("/review")} className="text-lab-accent hover:underline">复核页</button>，顶部折线图展示所有记录的零点漂移趋势
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              <span className="text-lab-danger">红色虚线</span> 为阈值 ±0.02mm，
              <span className="text-lab-danger">红色圆点</span> 表示超限点，
              <span className="text-lab-success">绿色圆点</span> 表示正常
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              点击图上数据点或左侧列表中的记录，查看详情后选择「通过」或「驳回」
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              驳回必须填写原因，原因会保留在历史记录中供后续追溯
            </span>
          </li>
        </ul>
      ),
    },
    {
      icon: PenTool,
      title: "第三步（可选）：修正标定表",
      content: (
        <ul className="space-y-2 text-sm text-lab-textMuted">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              进入 <button onClick={() => navigate("/correction")} className="text-lab-accent hover:underline">修正页</button>，选择一条已复核的记录
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              直接在表格中修改标定值，<span className="text-lab-accent">琥珀色背景</span> 标记已修改的单元格，悬浮可查看原值
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              必须填写修正原因，保存后 <span className="font-medium">修改前后的完整快照</span> 会自动写入历史记录
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              系统自动确保标定表误差合计与记录总误差保持一致，不一致会标红提示
            </span>
          </li>
        </ul>
      ),
    },
    {
      icon: History,
      title: "第四步：追溯历史",
      content: (
        <ul className="space-y-2 text-sm text-lab-textMuted">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              进入 <button onClick={() => navigate("/history")} className="text-lab-accent hover:underline">历史页</button>，可查看所有操作的完整时间线
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              使用筛选器按记录、操作人、操作类型、时间范围快速定位
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              点击「查看前后对比」可以看到修改前后每个字段的差异
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              每条记录都能看到：来源、当前状态、谁改过、为什么进了待处理
            </span>
          </li>
        </ul>
      ),
    },
    {
      icon: FileDown,
      title: "第五步：导出实验批改表",
      content: (
        <ul className="space-y-2 text-sm text-lab-textMuted">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              进入 <button onClick={() => navigate("/export")} className="text-lab-accent hover:underline">导出页</button>，系统会自动进行一致性校验
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              <span className="text-lab-danger">错误项</span> 必须修正后才能导出，包括：标定表与总误差不一致、已驳回记录、缺少复核人
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              <span className="text-lab-accent">警告项</span> 不阻止导出但建议检查，如：记录尚未复核
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              选择 CSV（Excel 打开）或 JSON（程序处理）格式，点击导出
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-3 h-3 text-lab-accent mt-1 flex-shrink-0" />
            <span>
              导出文件包含主表（实验批改表）和明细表（标定项），前后一致不会各说各话
            </span>
          </li>
        </ul>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-lab-bg text-lab-text p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-lab-accent flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8" />
            实验室助教使用指南
          </h1>
          <p className="text-lab-textMuted">
            透镜成像误差管理工具 —— 完整工作流指引
          </p>
        </div>

        <div className="space-y-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="card">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-lab-accent/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-lab-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-lab-accent text-lab-bg text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      {step.title}
                    </h3>
                    {step.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card border-lab-success/30 bg-lab-success/5">
            <h3 className="font-medium mb-2 text-lab-success flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              关键保障
            </h3>
            <ul className="text-sm text-lab-textMuted space-y-1">
              <li>✓ 每条记录都记录来源、操作人、状态变更历史</li>
              <li>✓ 标定表手动修改前后完整快照保留在历史中</li>
              <li>✓ 导出前自动校验批改表与明细一致性</li>
              <li>✓ 驳回必须说明原因，全程可追溯</li>
              <li>✓ 所有数据本地存储，无需联网</li>
            </ul>
          </div>

          <div className="card border-lab-danger/30 bg-lab-danger/5">
            <h3 className="font-medium mb-2 text-lab-danger flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              注意事项
            </h3>
            <ul className="text-sm text-lab-textMuted space-y-1">
              <li>⚠ 数据存储在浏览器 localStorage 中，清除浏览器数据会丢失</li>
              <li>⚠ 定期导出 JSON 格式作为数据备份</li>
              <li>⚠ 首次使用请先在左下角设置操作人姓名</li>
              <li>⚠ 已驳回的记录不会被导出到批改表</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 card">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-lab-accent" />
            数据说明
          </h3>
          <div className="text-sm text-lab-textMuted space-y-1">
            <p>
              <span className="text-lab-accent">零点漂移阈值：</span>
              ±0.02mm，超过此值的记录在复核页会被标记为超限
            </p>
            <p>
              <span className="text-lab-accent">一致性容差：</span>
              标定表误差合计与记录总误差允许 ±0.001mm 的舍入误差
            </p>
            <p>
              <span className="text-lab-accent">存储位置：</span>
              浏览器 localStorage，键名：lens-imaging-error-store
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-lab-textMuted">
          <p>任何问题请联系系统管理员 · 版本 v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
