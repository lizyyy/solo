package com.business.recalculate.service;

import com.business.recalculate.dto.*;
import com.business.recalculate.model.*;
import com.business.recalculate.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecalculateBatchService {

    private final RecalculateBatchRepository batchRepository;
    private final StatusHistoryRepository statusHistoryRepository;
    private final ComparisonResultRepository comparisonResultRepository;
    private final ProcessingRuleRepository processingRuleRepository;
    private final RevokeRecordRepository revokeRecordRepository;

    @Transactional
    public ApiResponse<BatchDetailResponse> createBatch(CreateBatchRequest request) {
        log.info("创建重算批次，幂等键: {}", request.getIdempotencyKey());

        Optional<RecalculateBatch> existingBatch = batchRepository.findByIdempotencyKey(request.getIdempotencyKey());
        if (existingBatch.isPresent()) {
            log.info("检测到重复请求，返回已存在的批次: {}", existingBatch.get().getBatchNo());
            return ApiResponse.success("重复请求，返回已存在批次", getBatchDetail(existingBatch.get().getBatchNo()).getData());
        }

        RecalculateBatch batch = new RecalculateBatch();
        batch.setBatchNo(generateBatchNo());
        batch.setBatchName(request.getBatchName());
        batch.setDescription(request.getDescription());
        batch.setIdempotencyKey(request.getIdempotencyKey());
        batch.setCreatedBy(request.getOperator());
        batch.setUpdatedBy(request.getOperator());
        batch.setStatus(RecalculateStatus.CREATED);

        EventScope eventScope = new EventScope();
        eventScope.setScopeType(request.getEventScope().getScopeType());
        eventScope.setStartTime(request.getEventScope().getStartTime());
        eventScope.setEndTime(request.getEventScope().getEndTime());
        eventScope.setEventTypes(request.getEventScope().getEventTypes());
        eventScope.setBusinessIds(request.getEventScope().getBusinessIds());
        eventScope.setFilterExpression(request.getEventScope().getFilterExpression());
        eventScope.setEstimatedEventCount(estimateEventCount(request.getEventScope()));
        batch.setEventScope(eventScope);

        if (request.getRuleIds() != null && !request.getRuleIds().isEmpty()) {
            List<ProcessingRule> rules = processingRuleRepository.findAllById(request.getRuleIds());
            batch.setProcessingRules(rules);
        }

        batch = batchRepository.save(batch);
        saveStatusHistory(batch, null, RecalculateStatus.CREATED, "批次创建", request.getOperator());

        log.info("重算批次创建成功: {}", batch.getBatchNo());
        return ApiResponse.success("批次创建成功", getBatchDetail(batch.getBatchNo()).getData());
    }

    @Transactional
    public ApiResponse<BatchDetailResponse> validateBatch(String batchNo, String operator) {
        log.info("开始校验批次: {}", batchNo);

        RecalculateBatch batch = getBatchOrThrow(batchNo);

        try {
            batch.updateStatus(RecalculateStatus.VALIDATING);
            saveStatusHistory(batch, RecalculateStatus.CREATED, RecalculateStatus.VALIDATING, "开始校验", operator);
            batchRepository.save(batch);

            boolean validationPassed = performValidation(batch);

            if (validationPassed) {
                batch.updateStatus(RecalculateStatus.VALIDATED);
                batch.clearError();
                saveStatusHistory(batch, RecalculateStatus.VALIDATING, RecalculateStatus.VALIDATED, "校验通过", operator);
                log.info("批次校验通过: {}", batchNo);
            } else {
                batch.updateStatus(RecalculateStatus.VALIDATION_FAILED);
                batch.setError("VALIDATION_ERROR", "事件范围校验失败", "检测到范围内存在异常事件");
                saveStatusHistory(batch, RecalculateStatus.VALIDATING, RecalculateStatus.VALIDATION_FAILED, "校验失败", operator);
                log.warn("批次校验失败: {}", batchNo);
            }

            batchRepository.save(batch);
            return ApiResponse.success(validationPassed ? "校验通过" : "校验失败", getBatchDetail(batchNo).getData());

        } catch (Exception e) {
            log.error("批次校验异常: {}", batchNo, e);
            batch.updateStatus(RecalculateStatus.VALIDATION_FAILED);
            batch.setError("VALIDATION_EXCEPTION", "校验过程异常", e.getMessage());
            batchRepository.save(batch);
            return ApiResponse.error("校验异常: " + e.getMessage());
        }
    }

    @Transactional
    public ApiResponse<BatchDetailResponse> startRecalculate(String batchNo, String operator) {
        log.info("开始执行沙箱重算: {}", batchNo);

        RecalculateBatch batch = getBatchOrThrow(batchNo);

        if (batch.getStatus() != RecalculateStatus.VALIDATED) {
            return ApiResponse.error("INVALID_STATUS", "只有已校验状态的批次才能开始重算");
        }

        try {
            batch.updateStatus(RecalculateStatus.RECALCULATING);
            saveStatusHistory(batch, RecalculateStatus.VALIDATED, RecalculateStatus.RECALCULATING, "开始沙箱重算", operator);
            batchRepository.save(batch);

            simulateRecalculateProcess(batch);

            batch.updateStatus(RecalculateStatus.RECALCULATED);
            batch.clearError();
            saveStatusHistory(batch, RecalculateStatus.RECALCULATING, RecalculateStatus.RECALCULATED, "沙箱重算完成", operator);
            batchRepository.save(batch);

            log.info("沙箱重算完成: {}", batchNo);
            return ApiResponse.success("沙箱重算完成", getBatchDetail(batchNo).getData());

        } catch (Exception e) {
            log.error("沙箱重算异常: {}", batchNo, e);
            batch.updateStatus(RecalculateStatus.RECALCULATE_FAILED);
            batch.setError("RECALCULATE_EXCEPTION", "重算过程异常", e.getMessage());
            batchRepository.save(batch);
            return ApiResponse.error("重算异常: " + e.getMessage());
        }
    }

    @Transactional
    public ApiResponse<BatchDetailResponse> compareResults(String batchNo, String operator) {
        log.info("开始对比重算结果: {}", batchNo);

        RecalculateBatch batch = getBatchOrThrow(batchNo);

        if (batch.getStatus() != RecalculateStatus.RECALCULATED) {
            return ApiResponse.error("INVALID_STATUS", "只有重算完成的批次才能进行结果对比");
        }

        try {
            batch.updateStatus(RecalculateStatus.COMPARING);
            saveStatusHistory(batch, RecalculateStatus.RECALCULATED, RecalculateStatus.COMPARING, "开始结果对比", operator);
            batchRepository.save(batch);

            ComparisonResult result = performComparison(batch);
            comparisonResultRepository.save(result);

            batch.updateStatus(RecalculateStatus.COMPARED);
            batch.clearError();
            saveStatusHistory(batch, RecalculateStatus.COMPARING, RecalculateStatus.COMPARED, "结果对比完成", operator);
            batchRepository.save(batch);

            log.info("结果对比完成: {}, 通过率: {}", batchNo, result.getPassed());
            return ApiResponse.success("结果对比完成", getBatchDetail(batchNo).getData());

        } catch (Exception e) {
            log.error("结果对比异常: {}", batchNo, e);
            batch.updateStatus(RecalculateStatus.COMPARE_FAILED);
            batch.setError("COMPARE_EXCEPTION", "对比过程异常", e.getMessage());
            batchRepository.save(batch);
            return ApiResponse.error("对比异常: " + e.getMessage());
        }
    }

    @Transactional
    public ApiResponse<BatchDetailResponse> publish(String batchNo, boolean approved, String reason, String operator) {
        log.info("发布重算结果: {}, 批准: {}", batchNo, approved);

        RecalculateBatch batch = getBatchOrThrow(batchNo);

        if (batch.getStatus() != RecalculateStatus.COMPARED) {
            return ApiResponse.error("INVALID_STATUS", "只有对比完成的批次才能进行发布");
        }

        if (!approved) {
            batch.updateStatus(RecalculateStatus.CANCELLED);
            saveStatusHistory(batch, RecalculateStatus.COMPARED, RecalculateStatus.CANCELLED, "发布被拒绝: " + reason, operator);
            batchRepository.save(batch);
            return ApiResponse.success("发布已拒绝", getBatchDetail(batchNo).getData());
        }

        try {
            batch.updateStatus(RecalculateStatus.PUBLISHING);
            saveStatusHistory(batch, RecalculateStatus.COMPARED, RecalculateStatus.PUBLISHING, "开始发布到生产环境", operator);
            batchRepository.save(batch);

            simulatePublishProcess(batch);

            batch.updateStatus(RecalculateStatus.PUBLISHED);
            batch.clearError();
            saveStatusHistory(batch, RecalculateStatus.PUBLISHING, RecalculateStatus.PUBLISHED, "发布完成", operator);
            batchRepository.save(batch);

            log.info("发布完成: {}", batchNo);
            return ApiResponse.success("发布完成", getBatchDetail(batchNo).getData());

        } catch (Exception e) {
            log.error("发布异常: {}", batchNo, e);
            batch.updateStatus(RecalculateStatus.PUBLISH_FAILED);
            batch.setError("PUBLISH_EXCEPTION", "发布过程异常", e.getMessage());
            batchRepository.save(batch);
            return ApiResponse.error("发布异常: " + e.getMessage());
        }
    }

    @Transactional
    public ApiResponse<BatchDetailResponse> revoke(String batchNo, String reason, String operator) {
        log.info("撤销已发布批次: {}", batchNo);

        RecalculateBatch batch = getBatchOrThrow(batchNo);

        if (batch.getStatus() != RecalculateStatus.PUBLISHED) {
            return ApiResponse.error("INVALID_STATUS", "只有已发布的批次才能撤销");
        }

        try {
            batch.updateStatus(RecalculateStatus.REVOKING);
            saveStatusHistory(batch, RecalculateStatus.PUBLISHED, RecalculateStatus.REVOKING, "开始撤销", operator);
            batchRepository.save(batch);

            simulateRevokeProcess(batch, reason, operator);

            batch.updateStatus(RecalculateStatus.REVOKED);
            batch.clearError();
            saveStatusHistory(batch, RecalculateStatus.REVOKING, RecalculateStatus.REVOKED, "撤销完成", operator);
            batchRepository.save(batch);

            log.info("撤销完成: {}", batchNo);
            return ApiResponse.success("撤销完成", getBatchDetail(batchNo).getData());

        } catch (Exception e) {
            log.error("撤销异常: {}", batchNo, e);
            batch.updateStatus(RecalculateStatus.REVOKE_FAILED);
            batch.setError("REVOKE_EXCEPTION", "撤销过程异常", e.getMessage());
            batchRepository.save(batch);
            return ApiResponse.error("撤销异常: " + e.getMessage());
        }
    }

    public ApiResponse<BatchDetailResponse> getBatchDetail(String batchNo) {
        RecalculateBatch batch = getBatchOrThrow(batchNo);
        BatchDetailResponse response = BatchDetailResponse.fromBatch(batch);

        if (batch.getEventScope() != null) {
            BatchDetailResponse.EventScopeDto scopeDto = new BatchDetailResponse.EventScopeDto();
            scopeDto.setScopeType(batch.getEventScope().getScopeType());
            scopeDto.setStartTime(batch.getEventScope().getStartTime());
            scopeDto.setEndTime(batch.getEventScope().getEndTime());
            scopeDto.setEventTypes(batch.getEventScope().getEventTypes());
            scopeDto.setBusinessIds(batch.getEventScope().getBusinessIds());
            scopeDto.setFilterExpression(batch.getEventScope().getFilterExpression());
            scopeDto.setEstimatedEventCount(batch.getEventScope().getEstimatedEventCount());
            response.setEventScope(scopeDto);
        }

        if (batch.getProcessingRules() != null) {
            List<BatchDetailResponse.ProcessingRuleResponse> ruleDtos = batch.getProcessingRules().stream()
                .map(rule -> {
                    BatchDetailResponse.ProcessingRuleResponse dto = new BatchDetailResponse.ProcessingRuleResponse();
                    dto.setId(rule.getId());
                    dto.setRuleCode(rule.getRuleCode());
                    dto.setRuleName(rule.getRuleName());
                    dto.setRuleVersion(rule.getRuleVersion());
                    dto.setRuleDescription(rule.getRuleDescription());
                    return dto;
                })
                .collect(Collectors.toList());
            response.setProcessingRules(ruleDtos);
        }

        comparisonResultRepository.findByBatchId(batch.getId()).ifPresent(result -> {
            BatchDetailResponse.ComparisonResultResponse dto = new BatchDetailResponse.ComparisonResultResponse();
            dto.setTotalComparedCount(result.getTotalComparedCount());
            dto.setIdenticalCount(result.getIdenticalCount());
            dto.setDifferentCount(result.getDifferentCount());
            dto.setNewCount(result.getNewCount());
            dto.setMissingCount(result.getMissingCount());
            dto.setDifferenceSummary(result.getDifferenceSummary());
            dto.setPassed(result.getPassed());
            response.setComparisonResult(dto);
        });

        List<StatusHistory> historyList = statusHistoryRepository.findByBatchIdOrderByCreatedAtDesc(batch.getId());
        List<BatchDetailResponse.StatusHistoryResponse> historyDtos = historyList.stream()
            .map(history -> {
                BatchDetailResponse.StatusHistoryResponse dto = new BatchDetailResponse.StatusHistoryResponse();
                dto.setPreviousStatus(history.getPreviousStatus());
                dto.setPreviousStatusName(history.getPreviousStatus() != null ? history.getPreviousStatus().getDisplayName() : "无");
                dto.setCurrentStatus(history.getCurrentStatus());
                dto.setCurrentStatusName(history.getCurrentStatus().getDisplayName());
                dto.setRemark(history.getRemark());
                dto.setOperator(history.getOperator());
                dto.setCreatedAt(history.getCreatedAt());
                return dto;
            })
            .collect(Collectors.toList());
        response.setStatusHistory(historyDtos);

        return ApiResponse.success(response);
    }

    public ApiResponse<List<BatchDetailResponse>> listBatches() {
        List<RecalculateBatch> batches = batchRepository.findAllByOrderByCreatedAtDesc();
        List<BatchDetailResponse> responses = batches.stream()
            .map(batch -> {
                BatchDetailResponse response = BatchDetailResponse.fromBatch(batch);
                if (batch.getEventScope() != null) {
                    BatchDetailResponse.EventScopeDto scopeDto = new BatchDetailResponse.EventScopeDto();
                    scopeDto.setScopeType(batch.getEventScope().getScopeType());
                    scopeDto.setStartTime(batch.getEventScope().getStartTime());
                    scopeDto.setEndTime(batch.getEventScope().getEndTime());
                    response.setEventScope(scopeDto);
                }
                return response;
            })
            .collect(Collectors.toList());
        return ApiResponse.success(responses);
    }

    public ApiResponse<List<BatchDetailResponse.StatusHistoryResponse>> getStatusHistory(String batchNo) {
        RecalculateBatch batch = getBatchOrThrow(batchNo);
        List<StatusHistory> historyList = statusHistoryRepository.findByBatchIdOrderByCreatedAtDesc(batch.getId());
        List<BatchDetailResponse.StatusHistoryResponse> responses = historyList.stream()
            .map(history -> {
                BatchDetailResponse.StatusHistoryResponse dto = new BatchDetailResponse.StatusHistoryResponse();
                dto.setPreviousStatus(history.getPreviousStatus());
                dto.setPreviousStatusName(history.getPreviousStatus() != null ? history.getPreviousStatus().getDisplayName() : "无");
                dto.setCurrentStatus(history.getCurrentStatus());
                dto.setCurrentStatusName(history.getCurrentStatus().getDisplayName());
                dto.setRemark(history.getRemark());
                dto.setOperator(history.getOperator());
                dto.setCreatedAt(history.getCreatedAt());
                return dto;
            })
            .collect(Collectors.toList());
        return ApiResponse.success(responses);
    }

    public ApiResponse<String> exportResults(String batchNo) {
        RecalculateBatch batch = getBatchOrThrow(batchNo);

        StringBuilder sb = new StringBuilder();
        sb.append("批次号: ").append(batch.getBatchNo()).append("\n");
        sb.append("批次名称: ").append(batch.getBatchName()).append("\n");
        sb.append("当前状态: ").append(batch.getStatus().getDisplayName()).append("\n");
        sb.append("创建时间: ").append(batch.getCreatedAt()).append("\n\n");

        if (batch.getEventScope() != null) {
            sb.append("=== 事件范围 ===\n");
            sb.append("范围类型: ").append(batch.getEventScope().getScopeType()).append("\n");
            sb.append("时间范围: ").append(batch.getEventScope().getStartTime()).append(" 至 ").append(batch.getEventScope().getEndTime()).append("\n");
            sb.append("预估事件数: ").append(batch.getEventScope().getEstimatedEventCount()).append("\n\n");
        }

        sb.append("=== 处理统计 ===\n");
        sb.append("总事件数: ").append(batch.getTotalEventCount()).append("\n");
        sb.append("已处理: ").append(batch.getProcessedEventCount()).append("\n");
        sb.append("成功: ").append(batch.getSuccessEventCount()).append("\n");
        sb.append("失败: ").append(batch.getFailedEventCount()).append("\n\n");

        comparisonResultRepository.findByBatchId(batch.getId()).ifPresent(result -> {
            sb.append("=== 对比结果 ===\n");
            sb.append("对比总数: ").append(result.getTotalComparedCount()).append("\n");
            sb.append("完全一致: ").append(result.getIdenticalCount()).append("\n");
            sb.append("存在差异: ").append(result.getDifferentCount()).append("\n");
            sb.append("新增记录: ").append(result.getNewCount()).append("\n");
            sb.append("缺失记录: ").append(result.getMissingCount()).append("\n");
            sb.append("差异摘要: ").append(result.getDifferenceSummary()).append("\n");
            sb.append("是否通过: ").append(result.getPassed() ? "是" : "否").append("\n\n");
        });

        if (StringUtils.isNotBlank(batch.getErrorMessage())) {
            sb.append("=== 错误信息 ===\n");
            sb.append("错误码: ").append(batch.getErrorCode()).append("\n");
            sb.append("错误信息: ").append(batch.getErrorMessage()).append("\n");
            sb.append("详细信息: ").append(batch.getErrorDetail()).append("\n\n");
        }

        return ApiResponse.success("导出成功", sb.toString());
    }

    private RecalculateBatch getBatchOrThrow(String batchNo) {
        return batchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> new IllegalArgumentException("批次不存在: " + batchNo));
    }

    private String generateBatchNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String uuid = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "REC-" + date + "-" + uuid;
    }

    private Integer estimateEventCount(CreateBatchRequest.EventScopeDto scope) {
        return (int) (Math.random() * 1000) + 100;
    }

    private boolean performValidation(RecalculateBatch batch) {
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return Math.random() > 0.1;
    }

    private void simulateRecalculateProcess(RecalculateBatch batch) {
        try {
            batch.setTotalEventCount(batch.getEventScope().getEstimatedEventCount());
            for (int i = 0; i <= 100; i += 20) {
                Thread.sleep(500);
                batch.setProcessedEventCount((int) (batch.getTotalEventCount() * i / 100.0));
                batchRepository.save(batch);
            }
            batch.setProcessedEventCount(batch.getTotalEventCount());
            batch.setSuccessEventCount((int) (batch.getTotalEventCount() * 0.95));
            batch.setFailedEventCount(batch.getTotalEventCount() - batch.getSuccessEventCount());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("重算过程被中断");
        }
    }

    private ComparisonResult performComparison(RecalculateBatch batch) {
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        ComparisonResult result = new ComparisonResult();
        result.setBatchId(batch.getId());
        result.setBatchNo(batch.getBatchNo());
        result.setTotalComparedCount(batch.getTotalEventCount());
        result.setIdenticalCount((int) (batch.getTotalEventCount() * 0.8));
        result.setDifferentCount((int) (batch.getTotalEventCount() * 0.15));
        result.setNewCount((int) (batch.getTotalEventCount() * 0.03));
        result.setMissingCount((int) (batch.getTotalEventCount() * 0.02));
        result.setDifferenceSummary("主要差异为部分事件的计算规则变更，预期结果");
        result.setPassed(result.getDifferentCount() < batch.getTotalEventCount() * 0.2);
        result.setCompletedAt(LocalDateTime.now());
        return result;
    }

    private void simulatePublishProcess(RecalculateBatch batch) {
        try {
            Thread.sleep(1500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("发布过程被中断");
        }
    }

    private void simulateRevokeProcess(RecalculateBatch batch, String reason, String operator) {
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("撤销过程被中断");
        }

        RevokeRecord record = new RevokeRecord();
        record.setBatchId(batch.getId());
        record.setBatchNo(batch.getBatchNo());
        record.setRevokeReason(reason);
        record.setRevokedBy(operator);
        record.setRevokedAt(LocalDateTime.now());
        record.setRecoveredEventCount(batch.getSuccessEventCount());
        record.setRecoveryDetail("所有事件已恢复到重算前状态");
        revokeRecordRepository.save(record);
    }

    private void saveStatusHistory(RecalculateBatch batch, RecalculateStatus previous, RecalculateStatus current, String remark, String operator) {
        StatusHistory history = new StatusHistory();
        history.setBatchId(batch.getId());
        history.setBatchNo(batch.getBatchNo());
        history.setPreviousStatus(previous);
        history.setCurrentStatus(current);
        history.setRemark(remark);
        history.setOperator(operator);
        statusHistoryRepository.save(history);
    }
}
