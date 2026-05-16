package com.audit.logretention.service;

import com.alibaba.fastjson.JSON;
import com.audit.logretention.dto.*;
import com.audit.logretention.entity.FreezeOperationHistory;
import com.audit.logretention.entity.LogRetentionFreeze;
import com.audit.logretention.enums.FreezeReason;
import com.audit.logretention.enums.FreezeStatus;
import com.audit.logretention.exception.BusinessException;
import com.audit.logretention.repository.FreezeOperationHistoryRepository;
import com.audit.logretention.repository.LogRetentionFreezeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogRetentionFreezeService {

    private final LogRetentionFreezeRepository freezeRepository;
    private final FreezeOperationHistoryRepository historyRepository;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Transactional
    public ApiResponse<LogRetentionFreeze> createFreeze(FreezeCreateRequest request) {
        String originalInput = JSON.toJSONString(request);
        log.info("创建日志留存冻结申请，请求ID: {}, 原始输入: {}", request.getRequestId(), originalInput);

        if (freezeRepository.existsByRequestId(request.getRequestId())) {
            LogRetentionFreeze existing = freezeRepository.findByRequestId(request.getRequestId()).orElseThrow();
            return handleIdempotentRequest(existing, originalInput);
        }

        if (request.getEndTime().isBefore(request.getStartTime())) {
            return createBlockedResponse(null, originalInput, "结束时间不能早于开始时间");
        }

        if (Duration.between(request.getStartTime(), request.getEndTime()).toDays() > 365 * 10) {
            return createBlockedResponse(null, originalInput, "冻结时间范围不能超过10年");
        }

        List<LogRetentionFreeze> overlappingFreezes = freezeRepository.findOverlappingFreezes(
                request.getLogTopic(), request.getStartTime(), request.getEndTime()
        );

        if (!overlappingFreezes.isEmpty()) {
            String overlapInfo = overlappingFreezes.stream()
                    .map(f -> String.format("[%s: %s ~ %s]", f.getRequestId(),
                            f.getStartTime().format(FORMATTER), f.getEndTime().format(FORMATTER)))
                    .collect(Collectors.joining(", "));
            return createPendingReviewResponse(request, originalInput,
                    "存在时间重叠的冻结记录，需人工复核: " + overlapInfo);
        }

        if (request.getFreezeReason() == FreezeReason.COMPLAINT_INVOLVEMENT) {
            return createPendingReviewResponse(request, originalInput,
                    "涉及投诉的冻结申请需人工复核后生效");
        }

        return createActiveFreeze(request, originalInput);
    }

    private ApiResponse<LogRetentionFreeze> handleIdempotentRequest(LogRetentionFreeze existing, String originalInput) {
        switch (existing.getStatus()) {
            case ACTIVE:
                return ApiResponse.success("幂等返回-申请已生效", existing);
            case PENDING_REVIEW:
                return ApiResponse.pendingReview(existing, "幂等返回-申请待复核");
            case BLOCKED:
                return ApiResponse.blocked(existing, "幂等返回-申请已被拦截");
            case COMPENSATED:
                return ApiResponse.compensated(existing, "幂等返回-申请已补偿");
            default:
                return ApiResponse.success("幂等返回", existing);
        }
    }

    private ApiResponse<LogRetentionFreeze> createPendingReviewResponse(
            FreezeCreateRequest request, String originalInput, String message) {
        LogRetentionFreeze freeze = buildFreezeEntity(request, originalInput, FreezeStatus.PENDING_REVIEW, message);
        freezeRepository.save(freeze);
        saveOperationHistory(freeze, null, FreezeStatus.PENDING_REVIEW,
                request.getApplicant(), message, originalInput);
        return ApiResponse.pendingReview(freeze, message);
    }

    private ApiResponse<LogRetentionFreeze> createBlockedResponse(
            FreezeCreateRequest request, String originalInput, String message) {
        LogRetentionFreeze freeze = new LogRetentionFreeze();
        if (request != null) {
            freeze = buildFreezeEntity(request, originalInput, FreezeStatus.BLOCKED, message);
        } else {
            freeze.setRequestId("INVALID-" + System.currentTimeMillis());
            freeze.setLogTopic("UNKNOWN");
            freeze.setStartTime(LocalDateTime.now());
            freeze.setEndTime(LocalDateTime.now());
            freeze.setFreezeReason(FreezeReason.OTHER);
            freeze.setApplicant("SYSTEM");
            freeze.setStatus(FreezeStatus.BLOCKED);
            freeze.setOriginalInput(originalInput);
            freeze.setProcessingConclusion(message);
        }
        freezeRepository.save(freeze);
        saveOperationHistory(freeze, null, FreezeStatus.BLOCKED,
                "SYSTEM", message, originalInput);
        return ApiResponse.blocked(freeze, message);
    }

    private ApiResponse<LogRetentionFreeze> createActiveFreeze(
            FreezeCreateRequest request, String originalInput) {
        LogRetentionFreeze freeze = buildFreezeEntity(request, originalInput, FreezeStatus.ACTIVE, "自动审核通过");
        freeze.setReviewedAt(LocalDateTime.now());
        freeze.setReviewer("SYSTEM_AUTO");
        freezeRepository.save(freeze);
        saveOperationHistory(freeze, null, FreezeStatus.ACTIVE,
                "SYSTEM_AUTO", "自动审核通过", originalInput);
        return ApiResponse.success("冻结申请已生效", freeze);
    }

    private LogRetentionFreeze buildFreezeEntity(FreezeCreateRequest request, String originalInput,
                                                  FreezeStatus status, String conclusion) {
        LogRetentionFreeze freeze = new LogRetentionFreeze();
        freeze.setRequestId(request.getRequestId());
        freeze.setLogTopic(request.getLogTopic());
        freeze.setStartTime(request.getStartTime());
        freeze.setEndTime(request.getEndTime());
        freeze.setFreezeReason(request.getFreezeReason());
        freeze.setFreezeReasonDetail(request.getFreezeReasonDetail());
        freeze.setApplicant(request.getApplicant());
        freeze.setReleaseCondition(request.getReleaseCondition());
        freeze.setStatus(status);
        freeze.setOriginalInput(originalInput);
        freeze.setProcessingConclusion(conclusion);
        return freeze;
    }

    @Transactional
    public ApiResponse<LogRetentionFreeze> updateStatus(Long id, FreezeStatusUpdateRequest request) {
        LogRetentionFreeze freeze = freezeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("FREEZE_NOT_FOUND", "冻结记录不存在"));

        FreezeStatus previousStatus = freeze.getStatus();
        FreezeStatus targetStatus = request.getTargetStatus();

        if (!isValidStatusTransition(previousStatus, targetStatus)) {
            throw new BusinessException("INVALID_STATUS_TRANSITION",
                    String.format("不支持从 %s 变更为 %s", previousStatus.getDescription(), targetStatus.getDescription()));
        }

        freeze.setStatus(targetStatus);
        freeze.setReviewComment(request.getReviewComment());

        if (targetStatus == FreezeStatus.ACTIVE || targetStatus == FreezeStatus.BLOCKED) {
            freeze.setReviewer(request.getOperator());
            freeze.setReviewedAt(LocalDateTime.now());
        }

        if (targetStatus == FreezeStatus.RELEASED) {
            freeze.setReleasedAt(LocalDateTime.now());
            if (request.getRetentionReport() != null) {
                freeze.setRetentionReport(request.getRetentionReport());
            }
        }

        freeze.setProcessingConclusion(request.getOperationRemark());
        freezeRepository.save(freeze);

        saveOperationHistory(freeze, previousStatus, targetStatus,
                request.getOperator(), request.getOperationRemark(), JSON.toJSONString(request));

        return ApiResponse.success("状态更新成功", freeze);
    }

    private boolean isValidStatusTransition(FreezeStatus current, FreezeStatus target) {
        switch (current) {
            case PENDING_REVIEW:
                return target == FreezeStatus.ACTIVE || target == FreezeStatus.BLOCKED
                        || target == FreezeStatus.CANCELLED;
            case ACTIVE:
                return target == FreezeStatus.RELEASED || target == FreezeStatus.COMPENSATED;
            case BLOCKED:
                return target == FreezeStatus.COMPENSATED || target == FreezeStatus.PENDING_REVIEW;
            default:
                return false;
        }
    }

    public ApiResponse<LogRetentionFreeze> getById(Long id) {
        LogRetentionFreeze freeze = freezeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("FREEZE_NOT_FOUND", "冻结记录不存在"));
        return ApiResponse.success(freeze);
    }

    public ApiResponse<LogRetentionFreeze> getByRequestId(String requestId) {
        LogRetentionFreeze freeze = freezeRepository.findByRequestId(requestId)
                .orElseThrow(() -> new BusinessException("FREEZE_NOT_FOUND", "冻结记录不存在"));
        return ApiResponse.success(freeze);
    }

    public ApiResponse<Page<LogRetentionFreeze>> query(FreezeQueryRequest request) {
        Pageable pageable = PageRequest.of(
                request.getPageNum(),
                request.getPageSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<LogRetentionFreeze> page = freezeRepository.findByConditions(
                request.getRequestId(),
                request.getLogTopic(),
                request.getStatus(),
                request.getFreezeReason(),
                request.getApplicant(),
                request.getStartTimeFrom(),
                request.getStartTimeTo(),
                pageable
        );

        return ApiResponse.success(page);
    }

    public ApiResponse<List<FreezeOperationHistory>> getHistory(Long freezeId) {
        List<FreezeOperationHistory> history = historyRepository.findByFreezeIdOrderByOperatedAtDesc(freezeId);
        return ApiResponse.success(history);
    }

    @Transactional
    public ApiResponse<LogRetentionFreeze> manualCorrect(Long id, FreezeManualCorrectionRequest request) {
        LogRetentionFreeze freeze = freezeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("FREEZE_NOT_FOUND", "冻结记录不存在"));

        FreezeStatus previousStatus = freeze.getStatus();

        if (request.getLogTopic() != null) {
            freeze.setLogTopic(request.getLogTopic());
        }
        if (request.getStartTime() != null) {
            freeze.setStartTime(request.getStartTime());
        }
        if (request.getEndTime() != null) {
            freeze.setEndTime(request.getEndTime());
        }
        if (request.getFreezeReason() != null) {
            freeze.setFreezeReason(request.getFreezeReason());
        }
        if (request.getFreezeReasonDetail() != null) {
            freeze.setFreezeReasonDetail(request.getFreezeReasonDetail());
        }
        if (request.getReleaseCondition() != null) {
            freeze.setReleaseCondition(request.getReleaseCondition());
        }
        if (request.getStatus() != null) {
            freeze.setStatus(request.getStatus());
        }
        if (request.getRetentionReport() != null) {
            freeze.setRetentionReport(request.getRetentionReport());
        }
        if (request.getProcessingConclusion() != null) {
            freeze.setProcessingConclusion(request.getProcessingConclusion());
        }

        freezeRepository.save(freeze);

        String detail = String.format("人工修正: %s, 变更内容: %s",
                request.getCorrectionReason(), JSON.toJSONString(request));
        saveOperationHistory(freeze, previousStatus, freeze.getStatus(),
                request.getOperator(), request.getCorrectionReason(), detail);

        return ApiResponse.success("人工修正成功", freeze);
    }

    public ApiResponse<List<Map<String, Object>>> exportData(FreezeQueryRequest request) {
        request.setPageSize(10000);
        Page<LogRetentionFreeze> page = query(request).getData();

        List<Map<String, Object>> exportData = page.getContent().stream()
                .map(this::convertToExportMap)
                .collect(Collectors.toList());

        return ApiResponse.success(exportData);
    }

    private Map<String, Object> convertToExportMap(LogRetentionFreeze freeze) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("请求ID", freeze.getRequestId());
        map.put("日志主题", freeze.getLogTopic());
        map.put("开始时间", freeze.getStartTime().format(FORMATTER));
        map.put("结束时间", freeze.getEndTime().format(FORMATTER));
        map.put("冻结原因", freeze.getFreezeReason().getDescription());
        map.put("冻结原因详情", freeze.getFreezeReasonDetail());
        map.put("申请人", freeze.getApplicant());
        map.put("释放条件", freeze.getReleaseCondition());
        map.put("状态", freeze.getStatus().getDescription());
        map.put("审核人", freeze.getReviewer());
        map.put("审核时间", freeze.getReviewedAt() != null ? freeze.getReviewedAt().format(FORMATTER) : "");
        map.put("释放时间", freeze.getReleasedAt() != null ? freeze.getReleasedAt().format(FORMATTER) : "");
        map.put("创建时间", freeze.getCreatedAt().format(FORMATTER));
        map.put("留存报告", freeze.getRetentionReport());
        map.put("处理结论", freeze.getProcessingConclusion());
        return map;
    }

    @Transactional
    public ApiResponse<String> generateRetentionReport(Long id) {
        LogRetentionFreeze freeze = freezeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("FREEZE_NOT_FOUND", "冻结记录不存在"));

        List<FreezeOperationHistory> historyList = historyRepository.findByFreezeIdOrderByOperatedAtDesc(id);

        StringBuilder report = new StringBuilder();
        report.append("=== 日志留存冻结报告 ===\n\n");
        report.append(String.format("请求ID: %s\n", freeze.getRequestId()));
        report.append(String.format("日志主题: %s\n", freeze.getLogTopic()));
        report.append(String.format("冻结时间: %s ~ %s\n",
                freeze.getStartTime().format(FORMATTER), freeze.getEndTime().format(FORMATTER)));
        report.append(String.format("冻结原因: %s\n", freeze.getFreezeReason().getDescription()));
        report.append(String.format("申请人: %s\n", freeze.getApplicant()));
        report.append(String.format("当前状态: %s\n\n", freeze.getStatus().getDescription()));

        report.append("=== 操作历史记录 ===\n");
        for (int i = 0; i < historyList.size(); i++) {
            FreezeOperationHistory history = historyList.get(i);
            report.append(String.format("\n[%d] %s\n", i + 1, history.getOperatedAt().format(FORMATTER)));
            report.append(String.format("  操作人: %s\n", history.getOperator()));
            report.append(String.format("  状态变更: %s -> %s\n",
                    history.getPreviousStatus() != null ? history.getPreviousStatus().getDescription() : "新建",
                    history.getCurrentStatus().getDescription()));
            report.append(String.format("  备注: %s\n", history.getOperationRemark() != null ? history.getOperationRemark() : "-"));
        }

        report.append("\n=== 报告生成时间 ===\n");
        report.append(LocalDateTime.now().format(FORMATTER));

        String reportContent = report.toString();
        freeze.setRetentionReport(reportContent);
        freezeRepository.save(freeze);

        return ApiResponse.success("留存报告生成成功", reportContent);
    }

    public ApiResponse<Map<String, Object>> getMergedTimeRange(String logTopic) {
        List<LogRetentionFreeze> activeFreezes = freezeRepository.findByLogTopicAndStatusIn(
                logTopic, Arrays.asList(FreezeStatus.ACTIVE, FreezeStatus.PENDING_REVIEW)
        );

        if (activeFreezes.isEmpty()) {
            Map<String, Object> result = new HashMap<>();
            result.put("logTopic", logTopic);
            result.put("hasActiveFreeze", false);
            result.put("mergedRanges", Collections.emptyList());
            return ApiResponse.success(result);
        }

        List<LocalDateTime[]> ranges = activeFreezes.stream()
                .map(f -> new LocalDateTime[]{f.getStartTime(), f.getEndTime()})
                .sorted(Comparator.comparing(a -> a[0]))
                .collect(Collectors.toList());

        List<Map<String, String>> mergedRanges = new ArrayList<>();
        LocalDateTime[] current = ranges.get(0);

        for (int i = 1; i < ranges.size(); i++) {
            LocalDateTime[] next = ranges.get(i);
            if (next[0].isBefore(current[1]) || next[0].isEqual(current[1])) {
                current[1] = current[1].isAfter(next[1]) ? current[1] : next[1];
            } else {
                mergedRanges.add(createRangeMap(current));
                current = next;
            }
        }
        mergedRanges.add(createRangeMap(current));

        Map<String, Object> result = new HashMap<>();
        result.put("logTopic", logTopic);
        result.put("hasActiveFreeze", true);
        result.put("activeCount", activeFreezes.size());
        result.put("mergedRanges", mergedRanges);
        result.put("freezeRequestIds", activeFreezes.stream().map(LogRetentionFreeze::getRequestId).collect(Collectors.toList()));

        return ApiResponse.success(result);
    }

    private Map<String, String> createRangeMap(LocalDateTime[] range) {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("startTime", range[0].format(FORMATTER));
        map.put("endTime", range[1].format(FORMATTER));
        map.put("durationDays", Duration.between(range[0], range[1]).toDays() + "天");
        return map;
    }

    private void saveOperationHistory(LogRetentionFreeze freeze, FreezeStatus previousStatus,
                                       FreezeStatus currentStatus, String operator,
                                       String remark, String detail) {
        FreezeOperationHistory history = new FreezeOperationHistory();
        history.setFreezeId(freeze.getId());
        history.setRequestId(freeze.getRequestId());
        history.setPreviousStatus(previousStatus);
        history.setCurrentStatus(currentStatus);
        history.setOperator(operator);
        history.setOperationRemark(remark);
        history.setOperationDetail(detail);
        historyRepository.save(history);
    }
}