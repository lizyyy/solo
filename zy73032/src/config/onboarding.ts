import {
  LayoutDashboard,
  Upload,
  CalendarCheck,
  AlertTriangle,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export interface OnboardingStep {
  id: string;
  order: number;
  title: string;
  description: string;
  actionLabel: string;
  to: string;
  tip: string;
  icon: LucideIcon;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "step-1",
    order: 1,
    title: "先看总览，心里有数",
    description:
      "打开系统先看4张汇总卡：总课时、已确认、待确认、异常数。红色脉动的是异常卡，优先处理。",
    actionLabel: "前往总览",
    to: "/",
    tip: "异常区的排程不会算入汇总，不用担心污染统计。",
    icon: LayoutDashboard,
  },
  {
    id: "step-2",
    order: 2,
    title: "导入训练课CSV",
    description:
      "表头需包含：宠物名、课程名称、上课日期、时长(分钟)、训导师。系统会提示缺失字段，重复记录会自动跳过。",
    actionLabel: "去导入CSV",
    to: "/import",
    tip: "可以点「下载样例CSV」先试一下。",
    icon: Upload,
  },
  {
    id: "step-3",
    order: 3,
    title: "录入手写病历单",
    description:
      "把小乔手里的病历逐条录入。默认勾选「附带一条正常训练课记录」，方便立刻查看确认逻辑是怎么走的。",
    actionLabel: "录入手写单",
    to: "/import",
    tip: "正常记录会直接出现在排程明细的「待确认」里。",
    icon: ScrollText,
  },
  {
    id: "step-4",
    order: 4,
    title: "在排程明细里逐条确认",
    description:
      "「待确认」行右侧有确认按钮。如果发现宠物名是别名，可以在弹层里绑定到规范宠物。确认过的记录随时可以撤回。",
    actionLabel: "去排程明细",
    to: "/schedules",
    tip: "点击任意行可以展开查看原始来源和操作历史。",
    icon: CalendarCheck,
  },
  {
    id: "step-5",
    order: 5,
    title: "异常追踪：别名冲突别揉进汇总",
    description:
      "同一个名字出现在多个规范宠物，或名字根本没绑定过，都会进异常区。每张异常卡会告诉你：来源是哪里、影响了哪些排程。",
    actionLabel: "查看异常",
    to: "/anomalies",
    tip: "从异常卡点「处理」会把别名绑到规范宠物，冲突就自动解除。",
    icon: AlertTriangle,
  },
  {
    id: "step-6",
    order: 6,
    title: "公示复盘：看确认前后改了什么",
    description:
      "社区公示前打开操作日志，时间线记录了每次确认、撤回、别名绑定。每条都有「变动前/变动后」的并排对比。",
    actionLabel: "打开操作日志",
    to: "/logs",
    tip: "把这条链接发给接手同事，他就能一路从汇总追到原始记录。",
    icon: ScrollText,
  },
  {
    id: "step-7",
    order: 7,
    title: "交接给下一位同事",
    description:
      "按步骤1→6走一遍。系统里所有数据存在浏览器本地，同一台电脑任何志愿者打开都能看到。换电脑时使用浏览器的导出功能带过去。",
    actionLabel: "回到总览",
    to: "/",
    tip: "右上角可以切换当前操作人，方便记录每次变动是谁做的。",
    icon: LayoutDashboard,
  },
];
