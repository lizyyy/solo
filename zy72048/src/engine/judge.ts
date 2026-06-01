import type {
  LevelConfig,
  StudentRecord,
  JudgementResult,
  CheckStep,
  RecordStatus,
} from "@/types";

function validateConfig(configs: LevelConfig[]): string[] {
  const errors: string[] = [];
  configs.forEach((cfg) => {
    if (cfg.resourceBounds.min > cfg.resourceBounds.max) {
      errors.push(
        `关卡「${cfg.name}」资源边界异常：最小值 ${cfg.resourceBounds.min} > 最大值 ${cfg.resourceBounds.max}，请检查配置`
      );
    }
    const seenIds = new Set<string>();
    cfg.events.forEach((evt) => {
      if (seenIds.has(evt.id)) {
        errors.push(
          `关卡「${cfg.name}」存在重复事件ID「${evt.id}」（类型：${evt.type}），建议区分`
        );
      }
      seenIds.add(evt.id);
    });
    if (cfg.events.length === 0) {
      errors.push(
        `关卡「${cfg.name}」没有配置任何事件，校验时将跳过事件匹配`
      );
    }
  });
  return errors;
}

function judgeRecord(
  record: StudentRecord,
  configs: LevelConfig[],
  roundNumber: number
): JudgementResult {
  const checkSteps: CheckStep[] = [];
  const level = configs.find((c) => c.id === record.levelId);
  const now = new Date().toISOString();

  if (!level) {
    checkSteps.push({
      label: "关卡匹配",
      passed: false,
      detail: `找不到关卡ID「${record.levelId}」，可能是旧口径或配置缺失`,
    });
    return {
      recordId: record.id,
      originalRecord: record,
      status: "旧口径补录",
      reason: `关卡「${record.levelId}」在当前配置中不存在`,
      suggestion:
        "这条记录的关卡已经不在当前配置里了，建议你找到阿蓝确认一下这条是不是历史遗留，如果是的话标个'旧口径补录'就行。",
      source: record.source,
      processedAt: now,
      roundNumber,
      checkSteps,
    };
  }

  checkSteps.push({
    label: "关卡匹配",
    passed: true,
    detail: `匹配到关卡「${level.name}」(ID: ${level.id})`,
  });

  const scoreOk = record.score !== null && record.score >= level.requiredScore;
  checkSteps.push({
    label: "分数检查",
    passed: scoreOk,
    detail:
      record.score !== null
        ? `得分 ${record.score}，要求 ≥${level.requiredScore} → ${scoreOk ? "通过" : "未达标"}`
        : "分数缺失，无法判断",
  });

  const boundsValid = level.resourceBounds.min <= level.resourceBounds.max;
  let resourceOk = false;
  if (!boundsValid) {
    checkSteps.push({
      label: "资源范围检查",
      passed: false,
      detail: `关卡「${level.name}」资源配置异常（min=${level.resourceBounds.min}, max=${level.resourceBounds.max}），无法判断资源值是否合规`,
    });
  } else if (record.resourceValue !== null) {
    resourceOk =
      record.resourceValue >= level.resourceBounds.min &&
      record.resourceValue <= level.resourceBounds.max;
    checkSteps.push({
      label: "资源范围检查",
      passed: resourceOk,
      detail: `资源值 ${record.resourceValue}，范围 [${level.resourceBounds.min}, ${level.resourceBounds.max}] → ${resourceOk ? "在范围内" : "超出范围"}`,
    });
  } else {
    checkSteps.push({
      label: "资源范围检查",
      passed: false,
      detail: "资源值缺失，无法判断",
    });
  }

  if (level.events.length === 0) {
    checkSteps.push({
      label: "事件匹配",
      passed: true,
      detail: `关卡「${level.name}」无事件配置，跳过事件匹配`,
    });
  } else {
    const hasDup = level.events.some(
      (e, i) => level.events.findIndex((x) => x.id === e.id) !== i
    );
    checkSteps.push({
      label: "事件匹配",
      passed: !hasDup,
      detail: hasDup
        ? `关卡「${level.name}」存在重复事件ID，匹配结果可能不可靠`
        : `关卡「${level.name}」事件配置正常`,
    });
  }

  const isOldCaliber = record.source === "学生练习记录";
  if (isOldCaliber) {
    return {
      recordId: record.id,
      originalRecord: record,
      status: "旧口径补录",
      reason: `来源为「${record.source}」，属于旧口径数据，分数${record.score ?? "缺失"}，资源值${record.resourceValue ?? "缺失"}`,
      suggestion:
        "这条是从学生练习记录里搬过来的旧数据，口径跟现在的'三角函数攀岩馆'不一样。建议你跟阿蓝核一下，确认没问题的话标个'旧口径补录'就行，不用改原始备注。",
      source: record.source,
      processedAt: now,
      roundNumber,
      checkSteps,
    };
  }

  const hasIssue = !scoreOk || !resourceOk || !boundsValid;
  if (hasIssue) {
    const issues: string[] = [];
    if (!scoreOk) issues.push("分数未达标");
    if (!resourceOk && boundsValid) issues.push("资源值超出范围");
    if (!boundsValid) issues.push("关卡资源配置本身有异常");
    return {
      recordId: record.id,
      originalRecord: record,
      status: "待人工确认",
      reason: issues.join("，"),
      suggestion: `这条需要你手动看一下：${issues.join("，")}。原始备注写的是「${record.rawNote}」，别洗掉，留着方便后续对账。确认完之后标个'待人工确认'就行。`,
      source: record.source,
      processedAt: now,
      roundNumber,
      checkSteps,
    };
  }

  return {
    recordId: record.id,
    originalRecord: record,
    status: "顺利",
    reason: `分数${record.score}达标，资源值${record.resourceValue}在范围内，事件匹配正常`,
    suggestion: "这条没问题，直接过就行。",
    source: record.source,
    processedAt: now,
    roundNumber,
    checkSteps,
  };
}

export { validateConfig, judgeRecord };
