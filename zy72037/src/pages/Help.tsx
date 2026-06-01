import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Import,
  Music,
  Layers,
  History,
  PenLine,
  GitMerge,
} from "lucide-react";

const sections = [
  {
    icon: Play,
    title: "如何启动一局游戏",
    content:
      "在首页选择一个关卡组卡片即可开始游戏。目前提供三个关卡组：「爵士和弦第一课」适合入门，「七和弦探秘」适合进阶练习，「和弦进行大冒险」则挑战完整和弦进行。点击「开始挑战」后计时即开始，在选项中找出与目标和弦构成音匹配的正确选项。",
  },
  {
    icon: Layers,
    title: "如何切换关卡组",
    content:
      "游戏进行中可以点击左侧控制栏的「重新开始」按钮来重新开始当前关卡组，或点击「结束」按钮结束当前对局返回首页，再选择其他关卡组。每局游戏只能选择一个关卡组，切换需要结束当前对局。",
  },
  {
    icon: History,
    title: "如何查看一局的历史与回放",
    content:
      "点击首页的「历史记录」按钮进入历史页面。左侧列表按时间倒序展示所有对局记录，点击任一对局可在右侧查看详细信息。点击「开始回放」可以逐步回放游戏过程，查看每一步的选择、正误和用时。回放支持播放/暂停、上一步/下一步以及 1x/1.5x/2x 变速。",
  },
  {
    icon: Import,
    title: "如何导入数据",
    content:
      "点击首页的「导入数据」按钮进入导入页面。页面提供三个导入区域：关卡参数、玩家选择记录、评分备注。每个区域支持粘贴 JSON 文本或上传 JSON 文件。输入数据后点击「检查导入」，系统会自动检测数据格式和冲突。确认无误后点击「确认导入」完成导入。",
  },
  {
    icon: PenLine,
    title: "如何补录备注及查看差异",
    content:
      "在对局结算页面点击「补录备注」进入备注页面。在文本框中输入备注内容后点击「保存备注」即可。页面下方会展示所有历史备注，并以不同颜色标记差异：绿色背景表示新增内容，黄色背景 + 删除线表示修改内容（旧值会被划掉），红色背景表示与教师备注存在冲突。",
  },
  {
    icon: GitMerge,
    title: "冲突处理操作指引",
    content:
      "导入数据时如果检测到与已有数据冲突，会显示冲突处理面板。面板采用双列对比布局，左侧为原始记录，右侧为导入数据。每个冲突项可以单独选择「保留原值」或「采用导入值」。处理完所有冲突后点击「确认导入」执行合并，也可以点击「取消」放弃本次导入。",
  },
];

export default function Help() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-jazz-bg">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-xl bg-jazz-card flex items-center justify-center hover:scale-105 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h1 className="text-xl font-bold text-white">使用说明</h1>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8 animate-fade-in">
          <Music className="w-14 h-14 text-jazz-gold mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-white mb-2">爵士和弦寻宝</h2>
          <p className="text-gray-400">快速了解游戏的所有功能</p>
        </div>

        <div className="space-y-4">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div
                key={index}
                className="bg-jazz-card rounded-2xl p-5 animate-slide-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-jazz-gold/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-jazz-gold" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">{section.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{section.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-jazz-gold text-jazz-bg font-bold rounded-xl hover:scale-105 transition-all"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
