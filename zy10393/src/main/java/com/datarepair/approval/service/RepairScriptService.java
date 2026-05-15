package com.datarepair.approval.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.datarepair.approval.dto.*;
import com.datarepair.approval.entity.*;
import com.datarepair.approval.enums.ApprovalAction;
import com.datarepair.approval.enums.ErrorCode;
import com.datarepair.approval.enums.ScriptStatus;
import com.datarepair.approval.exception.BusinessException;
import com.datarepair.approval.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RepairScriptService {

    private final RepairScriptMapper repairScriptMapper;
    private final TargetScopeMapper targetScopeMapper;
    private final DryRunResultMapper dryRunResultMapper;
    private final ApprovalOpinionMapper approvalOpinionMapper;
    private final ExecutionBatchMapper executionBatchMapper;
    private final RollbackRecordMapper rollbackRecordMapper;
    private final TimelineService timelineService;
    private final IdempotencyService idempotencyService;

    @Transactional(rollbackFor = Exception.class)
    public RepairScript create(RepairScriptCreateDTO dto) {
        String requestId = dto.getRequestId();
        if (idempotencyService.isProcessed(requestId)) {
            log.info("幂等校验：重复提交，直接返回已有记录: requestId={}", requestId);
            return (RepairScript) idempotencyService.getResult(requestId);
        }

        RepairScript existing = repairScriptMapper.selectByRequestId(dto.getRequestId());
        if (existing != null) {
            log.info("重复提交，直接返回已有记录: requestId={}", dto.getRequestId());
            idempotencyService.markAsProcessed(requestId, existing);
            return existing;
        }

        if (CollectionUtils.isEmpty(dto.getTargetScopes())) {
            throw new BusinessException(ErrorCode.TARGET_SCOPE_EMPTY);
        }

        RepairScript script = new RepairScript();
        script.setScriptNo(generateScriptNo());
        script.setScriptName(dto.getScriptName());
        script.setScriptType(dto.getScriptType());
        script.setScriptContent(dto.getScriptContent());
        script.setRollbackScript(dto.getRollbackScript());
        script.setDescription(dto.getDescription());
        script.setBusinessSystem(dto.getBusinessSystem());
        script.setDatabaseName(dto.getDatabaseName());
        script.setEstimatedImpact(dto.getEstimatedImpact());
        script.setApplicant(dto.getApplicant());
        script.setApplicantDept(dto.getApplicantDept());
        script.setRemark(dto.getRemark());
        script.setStatus(ScriptStatus.DRAFT);
        script.setRequestId(dto.getRequestId());
        repairScriptMapper.insert(script);

        for (TargetScopeDTO scopeDTO : dto.getTargetScopes()) {
            TargetScope scope = new TargetScope();
            scope.setScriptId(script.getId());
            scope.setScopeType(scopeDTO.getScopeType());
            scope.setTableName(scopeDTO.getTableName());
            scope.setPrimaryKey(scopeDTO.getPrimaryKey());
            scope.setWhereCondition(scopeDTO.getWhereCondition());
            scope.setEstimatedRows(scopeDTO.getEstimatedRows());
            scope.setColumnsAffected(scopeDTO.getColumnsAffected());
            scope.setRemark(scopeDTO.getRemark());
            targetScopeMapper.insert(scope);
        }

        timelineService.record(script.getId(), null, ApprovalAction.SUBMIT,
                null, ScriptStatus.DRAFT, dto.getApplicant(), dto.getApplicantDept(),
                "创建修复脚本", "脚本名称: " + dto.getScriptName());

        idempotencyService.markAsProcessed(requestId, script);
        return script;
    }

    @Transactional(rollbackFor = Exception.class)
    public void submit(Long scriptId, String operator) {
        RepairScript script = getById(scriptId);
        validateStatus(script, ScriptStatus.DRAFT, ScriptStatus.REJECTED);

        List<TargetScope> scopes = targetScopeMapper.selectByScriptId(scriptId);
        if (CollectionUtils.isEmpty(scopes)) {
            throw new BusinessException(ErrorCode.TARGET_SCOPE_EMPTY);
        }

        ScriptStatus fromStatus = script.getStatus();
        script.setStatus(ScriptStatus.SUBMITTED);
        script.setSubmitTime(LocalDateTime.now());
        script.setCurrentHandler(operator);
        repairScriptMapper.updateById(script);

        timelineService.record(scriptId, null, ApprovalAction.SUBMIT,
                fromStatus, ScriptStatus.SUBMITTED, operator, null,
                "提交审批", "脚本已提交等待校验");
    }

    @Transactional(rollbackFor = Exception.class)
    public DryRunResult dryRun(DryRunDTO dto) {
        String requestId = dto.getRequestId();
        if (idempotencyService.isProcessed(requestId)) {
            log.info("幂等校验：重复试跑，直接返回已有结果: requestId={}", requestId);
            return (DryRunResult) idempotencyService.getResult(requestId);
        }

        RepairScript script = getById(dto.getScriptId());
        validateStatus(script, ScriptStatus.SUBMITTED, ScriptStatus.VALIDATED);

        ScriptStatus fromStatus = script.getStatus();
        script.setStatus(ScriptStatus.DRY_RUNNING);
        repairScriptMapper.updateById(script);

        String batchNo = generateBatchNo("DRY");
        DryRunResult result = new DryRunResult();
        result.setScriptId(dto.getScriptId());
        result.setBatchNo(batchNo);
        result.setStartTime(LocalDateTime.now());
        result.setOperator(dto.getOperator());

        try {
            Thread.sleep(1000);
            result.setEndTime(LocalDateTime.now());
            result.setAffectedRows(100L);
            result.setPreviewData("{\"sample\": \"预览数据示例\"}");
            result.setExecutionLog("试跑执行完成，无语法错误");
            result.setSuccess(true);

            script.setStatus(ScriptStatus.DRY_RUN_SUCCESS);
        } catch (Exception e) {
            result.setEndTime(LocalDateTime.now());
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
            script.setStatus(ScriptStatus.VALIDATED);
        }

        dryRunResultMapper.insert(result);
        repairScriptMapper.updateById(script);

        timelineService.record(dto.getScriptId(), null, ApprovalAction.SUBMIT,
                fromStatus, script.getStatus(), dto.getOperator(), null,
                "试跑执行", result.getSuccess() ? "试跑成功" : "试跑失败: " + result.getErrorMessage());

        idempotencyService.markAsProcessed(requestId, result);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public void approve(ApprovalDTO dto) {
        String requestId = dto.getRequestId();
        if (idempotencyService.isProcessed(requestId)) {
            log.info("幂等校验：重复审批，直接返回: requestId={}", requestId);
            return;
        }

        RepairScript script = getById(dto.getScriptId());

        if (dto.getAction() == ApprovalAction.APPROVE) {
            validateStatus(script, ScriptStatus.DRY_RUN_SUCCESS);
        } else if (dto.getAction() == ApprovalAction.REJECT) {
            validateStatus(script, ScriptStatus.DRY_RUN_SUCCESS, ScriptStatus.PENDING_APPROVAL);
        }

        ScriptStatus fromStatus = script.getStatus();
        ScriptStatus toStatus = dto.getPassed() ? ScriptStatus.APPROVED : ScriptStatus.REJECTED;

        ApprovalOpinion opinion = new ApprovalOpinion();
        opinion.setScriptId(dto.getScriptId());
        opinion.setAction(dto.getAction());
        opinion.setApprover(dto.getApprover());
        opinion.setApproverDept(dto.getApproverDept());
        opinion.setOpinion(dto.getOpinion());
        opinion.setApprovalLevel(dto.getApprovalLevel());
        opinion.setPassed(dto.getPassed());
        opinion.setRemark(dto.getRemark());
        approvalOpinionMapper.insert(opinion);

        if (dto.getPassed()) {
            script.setStatus(ScriptStatus.APPROVED);
            script.setApprovalTime(LocalDateTime.now());
        } else {
            script.setStatus(ScriptStatus.REJECTED);
        }
        repairScriptMapper.updateById(script);

        timelineService.record(dto.getScriptId(), null, dto.getAction(),
                fromStatus, toStatus, dto.getApprover(), dto.getApproverDept(),
                dto.getPassed() ? "审批通过" : "审批拒绝", dto.getOpinion());

        idempotencyService.markAsProcessed(requestId, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public ExecutionBatch execute(ExecuteDTO dto) {
        String requestId = dto.getRequestId();
        if (idempotencyService.isProcessed(requestId)) {
            log.info("幂等校验：重复执行，直接返回已有结果: requestId={}", requestId);
            return (ExecutionBatch) idempotencyService.getResult(requestId);
        }

        RepairScript script = getById(dto.getScriptId());
        validateStatus(script, ScriptStatus.APPROVED);

        ScriptStatus fromStatus = script.getStatus();
        script.setStatus(ScriptStatus.EXECUTING);
        script.setExecuteTime(LocalDateTime.now());
        repairScriptMapper.updateById(script);

        String batchNo = generateBatchNo("EXE");
        ExecutionBatch batch = new ExecutionBatch();
        batch.setScriptId(dto.getScriptId());
        batch.setBatchNo(batchNo);
        batch.setBatchType(ScriptStatus.EXECUTING);
        batch.setStartTime(LocalDateTime.now());
        batch.setOperator(dto.getOperator());

        try {
            Thread.sleep(2000);
            batch.setEndTime(LocalDateTime.now());
            batch.setAffectedRows(500L);
            batch.setExecutionLog("执行成功，影响500条记录");
            batch.setStatus(ScriptStatus.EXECUTE_SUCCESS);
            batch.setSuccess(true);

            script.setStatus(ScriptStatus.EXECUTE_SUCCESS);
            script.setCompleteTime(LocalDateTime.now());
        } catch (Exception e) {
            batch.setEndTime(LocalDateTime.now());
            batch.setStatus(ScriptStatus.EXECUTE_FAILED);
            batch.setSuccess(false);
            batch.setErrorMessage(e.getMessage());
            script.setStatus(ScriptStatus.EXECUTE_FAILED);
        }

        executionBatchMapper.insert(batch);
        repairScriptMapper.updateById(script);

        timelineService.record(dto.getScriptId(), batch.getId(), ApprovalAction.EXECUTE,
                fromStatus, script.getStatus(), dto.getOperator(), null,
                batch.getSuccess() ? "执行成功" : "执行失败", batch.getExecutionLog());

        idempotencyService.markAsProcessed(requestId, batch);
        return batch;
    }

    @Transactional(rollbackFor = Exception.class)
    public RollbackRecord rollback(RollbackDTO dto) {
        String requestId = dto.getRequestId();
        if (idempotencyService.isProcessed(requestId)) {
            log.info("幂等校验：重复回滚，直接返回已有结果: requestId={}", requestId);
            return (RollbackRecord) idempotencyService.getResult(requestId);
        }
        RepairScript script = getById(dto.getScriptId());
        validateStatus(script, ScriptStatus.EXECUTE_SUCCESS, ScriptStatus.EXECUTE_FAILED);

        ExecutionBatch batch = executionBatchMapper.selectById(dto.getExecutionBatchId());
        if (batch == null) {
            throw new BusinessException(ErrorCode.BATCH_NOT_EXIST);
        }

        if (!StringUtils.hasText(dto.getRollbackProof())) {
            throw new BusinessException(ErrorCode.ROLLBACK_PROOF_MISSING);
        }

        ScriptStatus fromStatus = script.getStatus();
        script.setStatus(ScriptStatus.ROLLING_BACK);
        repairScriptMapper.updateById(script);

        RollbackRecord record = new RollbackRecord();
        record.setScriptId(dto.getScriptId());
        record.setExecutionBatchId(dto.getExecutionBatchId());
        record.setBatchNo(batch.getBatchNo());
        record.setRollbackProof(dto.getRollbackProof());
        record.setRollbackScript(StringUtils.hasText(dto.getRollbackScript()) ? dto.getRollbackScript() : script.getRollbackScript());
        record.setRollbackTime(LocalDateTime.now());
        record.setOperator(dto.getOperator());

        try {
            Thread.sleep(1500);
            record.setRollbackRows(batch.getAffectedRows());
            record.setRollbackLog("回滚成功");
            record.setSuccess(true);
            script.setStatus(ScriptStatus.ROLLBACK_SUCCESS);
        } catch (Exception e) {
            record.setRollbackLog("回滚失败: " + e.getMessage());
            record.setSuccess(false);
            script.setStatus(ScriptStatus.ROLLBACK_FAILED);
        }

        rollbackRecordMapper.insert(record);
        repairScriptMapper.updateById(script);

        timelineService.record(dto.getScriptId(), batch.getId(), ApprovalAction.ROLLBACK,
                fromStatus, script.getStatus(), dto.getOperator(), null,
                record.getSuccess() ? "回滚成功" : "回滚失败", record.getRollbackLog());

        idempotencyService.markAsProcessed(requestId, record);
        return record;
    }

    public RepairScript getById(Long id) {
        RepairScript script = repairScriptMapper.selectById(id);
        if (script == null) {
            throw new BusinessException(ErrorCode.SCRIPT_NOT_EXIST);
        }
        return script;
    }

    public Map<String, Object> getDetailById(Long id) {
        RepairScript script = getById(id);
        List<TargetScope> scopes = targetScopeMapper.selectByScriptId(id);
        List<DryRunResult> dryRunResults = dryRunResultMapper.selectByScriptId(id);
        List<ApprovalOpinion> opinions = approvalOpinionMapper.selectByScriptId(id);
        List<ExecutionBatch> batches = executionBatchMapper.selectByScriptId(id);
        List<RollbackRecord> rollbacks = rollbackRecordMapper.selectByScriptId(id);
        List<TimelineRecord> timeline = timelineService.getTimelineByScriptId(id);

        Map<String, Object> result = new HashMap<>();
        result.put("script", script);
        result.put("targetScopes", scopes);
        result.put("dryRunResults", dryRunResults);
        result.put("approvalOpinions", opinions);
        result.put("executionBatches", batches);
        result.put("rollbackRecords", rollbacks);
        result.put("timeline", timeline);
        return result;
    }

    public IPage<RepairScript> queryPage(ScriptQueryDTO dto) {
        Page<RepairScript> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        return repairScriptMapper.queryPage(page, dto);
    }

    private void validateStatus(RepairScript script, ScriptStatus... allowedStatuses) {
        for (ScriptStatus allowed : allowedStatuses) {
            if (script.getStatus() == allowed) {
                return;
            }
        }
        String allowed = Arrays.stream(allowedStatuses)
                .map(ScriptStatus::getDesc)
                .collect(Collectors.joining(", "));
        throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION,
                String.format("当前状态[%s]不允许此操作，允许状态: %s", script.getStatus().getDesc(), allowed));
    }

    private String generateScriptNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String seq = IdUtil.getSnowflakeNextIdStr().substring(10);
        return "RS" + date + seq;
    }

    private String generateBatchNo(String prefix) {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String seq = IdUtil.getSnowflakeNextIdStr().substring(12);
        return prefix + date + seq;
    }
}
