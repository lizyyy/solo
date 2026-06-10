import { Layers } from 'lucide-react';

export default function UsageGuide() {
  return (
    <div className="space-y-3 p-3 text-[11px] leading-relaxed text-slate-600">
      <div className="flex items-center gap-2 rounded-md bg-[#1F3A5F]/5 px-2.5 py-2">
        <Layers size={14} className="shrink-0 text-[#1F3A5F]" />
        <span className="font-semibold text-[#1F3A5F]">追踪工作台使用说明</span>
      </div>

      <ol className="space-y-2.5 list-decimal list-inside">
        <li>
          <strong className="text-slate-700">切换版本：</strong>
          顶部时间轴点击节点，或使用「上一版 / 下一版」按钮，3D 场景与材料清单会联动切换。
        </li>
        <li>
          <strong className="text-slate-700">筛选联动：</strong>
          左上方筛选器按类型、状态、版本勾选，3D 标记点与材料列表同步高亮/灰显。
        </li>
        <li>
          <strong className="text-slate-700">3D 操作：</strong>
          鼠标左键旋转视角，右键平移，滚轮缩放，点击材料标记点可查看详情。
        </li>
        <li>
          <strong className="text-slate-700">字段归一化：</strong>
          右侧「字段归一化」查看原始→标准映射，绿色「锁定」标识不被重跑覆盖。
        </li>
        <li>
          <strong className="text-slate-700">异常/碰撞：</strong>
          点击左侧导航「碰撞中心」查看碰撞清单，追溯会议纪要原始段落。
        </li>
      </ol>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800">
        💡 小提示：锁定字段（来源 / 处理状态）在补备注重跑时自动保留原值，防止关键信息丢失。
      </div>
    </div>
  );
}
