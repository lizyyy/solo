module.exports = {
  meta: {
    name: "皮具护理进度分类规则",
    version: "1.0.0",
    lastUpdated: "2024-05-15",
    description: "皮具护理店护理进度数据分类处理的默认口径配置"
  },

  classificationPriority: ["rework", "colorChange", "reRunnable", "normal"],

  rework: {
    name: "返修待处理",
    description: "护理效果不达标，需要重新处理的订单",
    keywords: ["返修", "返工", "重新处理", "效果不满意", "不达标", "不合格", "重做"],
    outputFile: "返修待处理.json",
    notes: "此类订单需要优先安排技师重新处理，处理前需与客户确认返修方案"
  },

  colorChange: {
    name: "客户改色",
    description: "客户主动要求改色服务的订单",
    keywords: ["客户改色", "改色", "换色", "颜色更换"],
    outputFile: "客户改色.json",
    notes: "改色订单需要单独工艺流程，需记录改色前需先打样确认"
  },

  reRunnable: {
    name: "可复跑输出",
    description: "因外部原因暂停，可后续继续处理的订单",
    conditions: [
      { status: "待确认", reason: "需客户确认后继续" },
      { status: "待材料", reason: "材料缺货，待材料到货" },
      { status: "待客户回复", reason: "等待客户反馈" },
      { priority: "加急", reason: "加急单可优先复跑" }
    ],
    outputFile: "可复跑输出.json",
    notes: "此类订单需要定期检查状态变化，条件满足后自动或人工触发复跑"
  },

  normal: {
    name: "正常完成",
    description: "正常完成且无特殊情况的订单",
    outputFile: "正常完成.json",
    notes: "常规完成订单，可正常归档或通知客户取件"
  },

  input: {
    requiredFields: ["orderNo", "customerName", "itemName", "serviceType", "status", "price"],
    optionalFields: ["phone", "receiveDate", "expectDate", "priority", "notes"]
  },

  output: {
    encoding: "utf-8",
    indent: 2,
    addTimestamp: true
  },

  usageGuide: {
    quickStart: [
      "1. 先执行 npm install 安装依赖",
      "2. 执行 npm run preview --sample 预览样例数据处理效果",
      "3. 将真实数据放入 data/皮具护理进度原始数据.json",
      "4. 执行 npm run preview 预览真实数据处理结果",
      "5. 确认无误后执行 npm run run 正式写入结果文件"
    ],
    customRules: "如需修改分类规则，请编辑 config/rules.js 文件",
    customData: "如需使用自定义数据文件，使用 -i 参数指定文件路径"
  }
};
