import React from "react";
import { Link } from "react-router-dom";
import { FolderUp, SearchCheck, ClipboardCheck, ArrowRight, Shield, Package, Layout } from "lucide-react";

const cards = [
  {
    step: 1,
    title: "如何放置授权文件样例",
    description:
      "在排期表中找到对应委托记录，点击「授权文件」按钮即可查看当前文件。将授权书 PDF 拖入项目文件夹后，在工具中点击关联即可完成放置。建议以「项目名_授权书_版本号」格式命名。",
    link: "/schedule",
    icon: FolderUp,
    color: "#4A6FA5",
  },
  {
    step: 2,
    title: "去哪检查导出规格漏改",
    description:
      "在统一时间线页面筛选「待补」状态记录，逐一确认素材包与版式稿是否已上传。未上传的文件节点显示为灰色虚线，点击可跳转至对应排期记录补充。",
    link: "/timeline",
    icon: SearchCheck,
    color: "#7BA37E",
  },
  {
    step: 3,
    title: "导出交付说明前怎么复核",
    description:
      "在交付说明页面检查三组记录的处理口径是否准确：已确认组确认无遗漏、待补组确认补交说明清晰、人工改过组确认修正原因完整。复核无误后点击「导出交付说明」即可。",
    link: "/delivery",
    icon: ClipboardCheck,
    color: "#D4A843",
  },
];

const Guide: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F5F3EF] px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-3xl font-bold text-gray-800">收尾指引</h1>
        <p className="mt-2 text-sm text-gray-500">品牌设计师操作速查</p>

        <div className="mt-10 flex flex-col gap-6">
          {cards.map(({ step, title, description, link, icon: Icon, color }) => (
            <div
              key={step}
              className="rounded-lg bg-white shadow-md"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <div className="flex items-start gap-4 p-6">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {step}
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-lg font-semibold text-gray-800">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
                  <Link
                    to={link}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    style={{ color }}
                  >
                    前往
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <Icon className="h-5 w-5 shrink-0 text-gray-300" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-lg bg-amber-50 p-4">
          <p className="text-xs leading-relaxed text-gray-600">
            提示：排期表中的「依据追溯」功能可从任意记录点回授权文件或素材包，接手人可通过侧面板快速了解依据来源。
          </p>
        </div>
      </div>
    </div>
  );
};

export default Guide;
