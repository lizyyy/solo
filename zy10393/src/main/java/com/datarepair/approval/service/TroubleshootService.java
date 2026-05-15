package com.datarepair.approval.service;

import com.datarepair.approval.entity.*;
import com.datarepair.approval.enums.ScriptStatus;
import com.datarepair.approval.mapper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TroubleshootService {

    private final RepairScriptMapper repairScriptMapper;
    private final TargetScopeMapper targetScopeMapper;
    private final DryRunResultMapper dryRunResultMapper;
    private final ExecutionBatchMapper executionBatchMapper;
    private final RollbackRecordMapper rollbackRecordMapper;
    private final TimelineRecordMapper timelineRecordMapper;

    public Map<String, Object> generateTroubleshootReport(Long scriptId) {
        RepairScript script = repairScriptMapper.selectById(scriptId);
        if (script == null) {
            return Collections.emptyMap();
        }

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("scriptBasicInfo", generateScriptBasicInfo(script));

        List<TargetScope> scopes = targetScopeMapper.selectByScriptId(scriptId);
        report.put("targetScopeSummary", generateTargetScopeSummary(scopes));

        List<DryRunResult> dryRuns = dryRunResultMapper.selectByScriptId(scriptId);
        report.put("dryRunSummary", generateDryRunSummary(dryRuns));

        List<ExecutionBatch> batches = executionBatchMapper.selectByScriptId(scriptId);
        report.put("executionSummary", generateExecutionSummary(batches));

        List<RollbackRecord> rollbacks = rollbackRecordMapper.selectByScriptId(scriptId);
        report.put("rollbackSummary", generateRollbackSummary(rollbacks));

        List<TimelineRecord> timeline = timelineRecordMapper.selectByScriptIdOrderByTime(scriptId);
        report.put("timelineAnalysis", generateTimelineAnalysis(timeline));

        report.put("riskIndicators", generateRiskIndicators(script, batches, rollbacks, dryRuns));

        report.put("generatedAt", LocalDateTime.now());

        return report;
    }

    private Map<String, Object> generateScriptBasicInfo(RepairScript script) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("scriptNo", script.getScriptNo());
        info.put("scriptName", script.getScriptName());
        info.put("scriptType", script.getScriptType());
        info.put("businessSystem", script.getBusinessSystem());
        info.put("databaseName", script.getDatabaseName());
        info.put("status", script.getStatus().getDesc());
        info.put("applicant", script.getApplicant());
        info.put("applicantDept", script.getApplicantDept());
        info.put("createTime", script.getCreateTime());
        info.put("submitTime", script.getSubmitTime());
        info.put("approvalTime", script.getApprovalTime());
        info.put("executeTime", script.getExecuteTime());
        info.put("completeTime", script.getCompleteTime());
        return info;
    }

    private Map<String, Object> generateTargetScopeSummary(List<TargetScope> scopes) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalScopeCount", scopes.size());

        Map<String, Integer> typeCount = new HashMap<>();
        long totalEstimatedRows = 0;
        Set<String> tables = new HashSet<>();

        for (TargetScope scope : scopes) {
            typeCount.merge(scope.getScopeType(), 1, Integer::sum);
            totalEstimatedRows += scope.getEstimatedRows() != null ? scope.getEstimatedRows() : 0;
            tables.add(scope.getTableName());
        }

        summary.put("scopeTypeDistribution", typeCount);
        summary.put("totalEstimatedRows", totalEstimatedRows);
        summary.put("affectedTables", new ArrayList<>(tables));
        summary.put("tableCount", tables.size());
        return summary;
    }

    private Map<String, Object> generateDryRunSummary(List<DryRunResult> dryRuns) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("dryRunCount", dryRuns.size());

        long successCount = dryRuns.stream().filter(d -> Boolean.TRUE.equals(d.getSuccess())).count();
        long failCount = dryRuns.size() - successCount;
        summary.put("successCount", successCount);
        summary.put("failCount", failCount);
        summary.put("successRate", dryRuns.isEmpty() ? 0 : (double) successCount / dryRuns.size());

        if (!dryRuns.isEmpty()) {
            DryRunResult last = dryRuns.get(dryRuns.size() - 1);
            summary.put("lastDryRunTime", last.getStartTime());
            summary.put("lastDryRunResult", last.getSuccess() ? "成功" : "失败");
            summary.put("lastDryRunAffectedRows", last.getAffectedRows());
        }

        return summary;
    }

    private Map<String, Object> generateExecutionSummary(List<ExecutionBatch> batches) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("executionCount", batches.size());

        long successCount = batches.stream().filter(b -> Boolean.TRUE.equals(b.getSuccess())).count();
        long failCount = batches.size() - successCount;
        summary.put("successCount", successCount);
        summary.put("failCount", failCount);
        summary.put("successRate", batches.isEmpty() ? 0 : (double) successCount / batches.size());

        long totalAffectedRows = batches.stream()
                .filter(b -> b.getAffectedRows() != null)
                .mapToLong(ExecutionBatch::getAffectedRows)
                .sum();
        summary.put("totalAffectedRows", totalAffectedRows);

        if (!batches.isEmpty()) {
            ExecutionBatch last = batches.get(batches.size() - 1);
            summary.put("lastExecutionTime", last.getStartTime());
            summary.put("lastExecutionResult", last.getSuccess() ? "成功" : "失败");
            summary.put("lastExecutionOperator", last.getOperator());

            if (last.getStartTime() != null && last.getEndTime() != null) {
                Duration duration = Duration.between(last.getStartTime(), last.getEndTime());
                summary.put("lastExecutionDurationMs", duration.toMillis());
            }
        }

        return summary;
    }

    private Map<String, Object> generateRollbackSummary(List<RollbackRecord> rollbacks) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("rollbackCount", rollbacks.size());

        long successCount = rollbacks.stream().filter(r -> Boolean.TRUE.equals(r.getSuccess())).count();
        summary.put("successCount", successCount);
        summary.put("failCount", rollbacks.size() - successCount);

        if (!rollbacks.isEmpty()) {
            RollbackRecord last = rollbacks.get(rollbacks.size() - 1);
            summary.put("lastRollbackTime", last.getRollbackTime());
            summary.put("lastRollbackResult", last.getSuccess() ? "成功" : "失败");
            summary.put("hasRollbackProof", last.getRollbackProof() != null);
        }

        return summary;
    }

    private Map<String, Object> generateTimelineAnalysis(List<TimelineRecord> timeline) {
        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("totalEvents", timeline.size());

        Map<String, Integer> actionDistribution = new HashMap<>();
        for (TimelineRecord record : timeline) {
            String action = record.getAction() != null ? record.getAction().getDesc() : "UNKNOWN";
            actionDistribution.merge(action, 1, Integer::sum);
        }
        analysis.put("actionDistribution", actionDistribution);

        if (timeline.size() >= 2) {
            TimelineRecord first = timeline.get(0);
            TimelineRecord last = timeline.get(timeline.size() - 1);
            if (first.getActionTime() != null && last.getActionTime() != null) {
                Duration totalDuration = Duration.between(first.getActionTime(), last.getActionTime());
                analysis.put("totalDurationMinutes", totalDuration.toMinutes());
            }
        }

        List<Map<String, Object>> keyEvents = new ArrayList<>();
        for (TimelineRecord record : timeline) {
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("time", record.getActionTime());
            event.put("action", record.getAction() != null ? record.getAction().getDesc() : null);
            event.put("fromStatus", record.getFromStatus() != null ? record.getFromStatus().getDesc() : null);
            event.put("toStatus", record.getToStatus() != null ? record.getToStatus().getDesc() : null);
            event.put("operator", record.getOperator());
            event.put("remark", record.getRemark());
            keyEvents.add(event);
        }
        analysis.put("keyEvents", keyEvents);

        return analysis;
    }

    private List<String> generateRiskIndicators(RepairScript script, List<ExecutionBatch> batches,
                                                List<RollbackRecord> rollbacks, List<DryRunResult> dryRuns) {
        List<String> risks = new ArrayList<>();

        ScriptStatus status = script.getStatus();
        if (status == ScriptStatus.EXECUTE_FAILED) {
            risks.add("高风险: 脚本执行失败，需要紧急排查");
        }
        if (status == ScriptStatus.ROLLBACK_FAILED) {
            risks.add("严重: 回滚失败，数据可能处于不一致状态");
        }

        long failBatches = batches.stream().filter(b -> !Boolean.TRUE.equals(b.getSuccess())).count();
        if (failBatches > 1) {
            risks.add(String.format("警告: 存在%d次失败的执行批次", failBatches));
        }

        if (!rollbacks.isEmpty()) {
            risks.add("注意: 脚本已执行过回滚操作，请确认数据一致性");
        }

        long failDryRuns = dryRuns.stream().filter(d -> !Boolean.TRUE.equals(d.getSuccess())).count();
        if (failDryRuns > 0) {
            risks.add(String.format("提示: 存在%d次失败的试跑记录", failDryRuns));
        }

        if (risks.isEmpty()) {
            risks.add("无明显风险指标");
        }

        return risks;
    }
}
