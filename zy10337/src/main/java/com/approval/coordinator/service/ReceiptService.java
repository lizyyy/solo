package com.approval.coordinator.service;

import com.approval.coordinator.model.dto.ApiResponse;
import com.approval.coordinator.model.entity.ApprovalBatch;
import com.approval.coordinator.model.entity.ApprovalItem;
import com.approval.coordinator.model.entity.ProcessingReceipt;
import com.approval.coordinator.model.entity.TimelineEvent;
import com.approval.coordinator.repository.ApprovalBatchRepository;
import com.approval.coordinator.repository.ApprovalItemRepository;
import com.approval.coordinator.repository.ProcessingReceiptRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReceiptService {

    private final ProcessingReceiptRepository receiptRepository;
    private final ApprovalBatchRepository batchRepository;
    private final ApprovalItemRepository itemRepository;
    private final TimelineService timelineService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ApiResponse<ProcessingReceipt> generateReceipt(String batchId, String operator) {
        log.info("生成处理回执: batchId={}", batchId);
        return batchRepository.findByBatchId(batchId)
                .map(batch -> {
                    List<ApprovalItem> allItems = itemRepository.findByBatch_BatchId(batchId);
                    List<ApprovalItem> successItems = allItems.stream()
                            .filter(item -> "SUCCESS".equals(item.getStatus().name()))
                            .collect(Collectors.toList());
                    List<ApprovalItem> failedItems = allItems.stream()
                            .filter(item -> "FAILED".equals(item.getStatus().name()))
                            .collect(Collectors.toList());

                    Map<String, Object> detail = new LinkedHashMap<>();
                    detail.put("batchId", batchId);
                    detail.put("businessType", batch.getBusinessType());
                    detail.put("sourceSystem", batch.getSourceSystem());
                    detail.put("createdAt", batch.getCreatedAt());
                    detail.put("completedAt", batch.getCompletedAt());
                    detail.put("totalCount", batch.getTotalCount());
                    detail.put("successCount", successItems.size());
                    detail.put("failedCount", failedItems.size());
                    detail.put("status", batch.getStatus().name());

                    List<Map<String, Object>> itemDetails = new ArrayList<>();
                    for (ApprovalItem item : allItems) {
                        Map<String, Object> itemDetail = new LinkedHashMap<>();
                        itemDetail.put("itemId", item.getItemId());
                        itemDetail.put("status", item.getStatus().name());
                        itemDetail.put("chunkNumber", item.getChunkNumber());
                        itemDetail.put("retryCount", item.getRetryCount());
                        itemDetail.put("errorCode", item.getErrorCode());
                        itemDetail.put("errorMessage", item.getErrorMessage());
                        itemDetails.add(itemDetail);
                    }
                    detail.put("items", itemDetails);

                    String receiptId = "RCP-" + batchId + "-" + System.currentTimeMillis();

                    ProcessingReceipt receipt = ProcessingReceipt.builder()
                            .batch(batch)
                            .receiptId(receiptId)
                            .totalItems(batch.getTotalCount())
                            .successCount(successItems.size())
                            .failedCount(failedItems.size())
                            .summary(generateSummary(batch, successItems.size(), failedItems.size()))
                            .detailData(toJson(detail))
                            .exportedBy(operator)
                            .exportedAt(LocalDateTime.now())
                            .createdAt(LocalDateTime.now())
                            .build();

                    receipt = receiptRepository.save(receipt);
                    timelineService.addEvent(batch, "RECEIPT_GENERATED", "处理回执已生成，回执ID: " + receiptId, operator);

                    return ApiResponse.success("回执生成成功", receipt);
                })
                .orElse(ApiResponse.error("BATCH_NOT_FOUND", "批次不存在"));
    }

    private String generateSummary(ApprovalBatch batch, int successCount, int failedCount) {
        StringBuilder sb = new StringBuilder();
        sb.append("批量审批处理回执\n");
        sb.append("================\n");
        sb.append("批次ID: ").append(batch.getBatchId()).append("\n");
        sb.append("业务类型: ").append(batch.getBusinessType()).append("\n");
        sb.append("来源系统: ").append(batch.getSourceSystem()).append("\n");
        sb.append("创建时间: ").append(formatDateTime(batch.getCreatedAt())).append("\n");
        sb.append("完成时间: ").append(formatDateTime(batch.getCompletedAt())).append("\n");
        sb.append("单据总数: ").append(batch.getTotalCount()).append("\n");
        sb.append("成功数量: ").append(successCount).append("\n");
        sb.append("失败数量: ").append(failedCount).append("\n");
        sb.append("处理状态: ").append(batch.getStatus().name()).append("\n");
        if (failedCount > 0) {
            sb.append("\n【问题排查建议】\n");
            sb.append("1. 查看下方失败单据明细，定位具体错误\n");
            sb.append("2. 检查失败单据的业务数据是否符合规范\n");
            sb.append("3. 确认回调接口是否正常响应\n");
            sb.append("4. 如需重发，请使用重放接口指定单据或分片\n");
        }
        return sb.toString();
    }

    public ApiResponse<ProcessingReceipt> getReceipt(String receiptId) {
        return receiptRepository.findByReceiptId(receiptId)
                .map(receipt -> ApiResponse.success(receipt))
                .orElse(ApiResponse.error("RECEIPT_NOT_FOUND", "回执不存在"));
    }

    public ApiResponse<List<ProcessingReceipt>> getBatchReceipts(String batchId) {
        List<ProcessingReceipt> receipts = receiptRepository.findByBatch_BatchIdOrderByCreatedAtDesc(batchId);
        return ApiResponse.success(receipts);
    }

    public ApiResponse<String> exportDebugReport(String batchId) {
        log.info("导出问题排查报告: batchId={}", batchId);
        return batchRepository.findByBatchId(batchId)
                .map(batch -> {
                    StringBuilder report = new StringBuilder();
                    report.append("========================================\n");
                    report.append("批量审批回调协调器 - 问题排查报告\n");
                    report.append("========================================\n\n");

                    report.append("【1. 批次基本信息】\n");
                    report.append("批次ID: ").append(batch.getBatchId()).append("\n");
                    report.append("业务类型: ").append(batch.getBusinessType()).append("\n");
                    report.append("来源系统: ").append(batch.getSourceSystem()).append("\n");
                    report.append("当前状态: ").append(batch.getStatus().name()).append("\n");
                    report.append("创建时间: ").append(formatDateTime(batch.getCreatedAt())).append("\n");
                    report.append("更新时间: ").append(formatDateTime(batch.getUpdatedAt())).append("\n");
                    report.append("完成时间: ").append(formatDateTime(batch.getCompletedAt())).append("\n");
                    report.append("创建人: ").append(batch.getCreatedBy()).append("\n");
                    report.append("分片大小: ").append(batch.getChunkSize()).append("\n");
                    report.append("总分片数: ").append(batch.getTotalChunks()).append("\n");
                    report.append("当前分片: ").append(batch.getCurrentChunk()).append("\n");
                    report.append("单据总数: ").append(batch.getTotalCount()).append("\n");
                    report.append("成功数量: ").append(batch.getSuccessCount()).append("\n");
                    report.append("失败数量: ").append(batch.getFailedCount()).append("\n\n");

                    report.append("【2. 单据状态分布】\n");
                    List<ApprovalItem> allItems = itemRepository.findByBatch_BatchId(batchId);
                    Map<String, Long> statusCount = allItems.stream()
                            .collect(Collectors.groupingBy(item -> item.getStatus().name(), Collectors.counting()));
                    for (Map.Entry<String, Long> entry : statusCount.entrySet()) {
                        report.append("  ").append(entry.getKey()).append(": ").append(entry.getValue()).append(" 条\n");
                    }
                    report.append("\n");

                    report.append("【3. 失败单据明细】\n");
                    List<ApprovalItem> failedItems = allItems.stream()
                            .filter(item -> "FAILED".equals(item.getStatus().name()))
                            .collect(Collectors.toList());
                    if (failedItems.isEmpty()) {
                        report.append("  无失败单据\n");
                    } else {
                        for (int i = 0; i < failedItems.size(); i++) {
                            ApprovalItem item = failedItems.get(i);
                            report.append("  [").append(i + 1).append("] 单据ID: ").append(item.getItemId()).append("\n");
                            report.append("      分片号: ").append(item.getChunkNumber()).append("\n");
                            report.append("      错误码: ").append(item.getErrorCode()).append("\n");
                            report.append("      错误信息: ").append(item.getErrorMessage()).append("\n");
                            report.append("      重试次数: ").append(item.getRetryCount()).append("\n");
                            report.append("      完成时间: ").append(formatDateTime(item.getCompletedAt())).append("\n");
                        }
                    }
                    report.append("\n");

                    report.append("【4. 时间线追踪】\n");
                    List<TimelineEvent> events = timelineService.getBatchTimeline(batchId);
                    for (TimelineEvent event : events) {
                        report.append("  [").append(formatDateTime(event.getEventTime())).append("] ");
                        report.append(event.getEventType());
                        if (event.getItemId() != null) {
                            report.append(" (单据: ").append(event.getItemId()).append(")");
                        }
                        report.append(" - ").append(event.getDescription());
                        if (event.getOperator() != null) {
                            report.append(" [操作人: ").append(event.getOperator()).append("]");
                        }
                        report.append("\n");
                    }
                    report.append("\n");

                    report.append("【5. 问题排查建议】\n");
                    if (batch.getFailedCount() > 0) {
                        report.append("  1. 检查上述失败单据的错误码和错误信息\n");
                        report.append("  2. 确认业务系统是否能处理这些失败单据\n");
                        report.append("  3. 使用重放接口重试失败单据（支持按单据ID或分片号）\n");
                        report.append("  4. 检查回调接口的可用性和响应格式\n");
                    } else if (batch.getStatus().name().equals("PROCESSING")) {
                        report.append("  1. 当前批次正在处理中，请稍后再查\n");
                        report.append("  2. 检查回调是否按分片正确返回\n");
                    } else {
                        report.append("  批次处理正常，无特别排查建议\n");
                    }

                    report.append("\n========================================\n");
                    report.append("报告生成时间: ").append(formatDateTime(LocalDateTime.now())).append("\n");
                    report.append("========================================\n");

                    return ApiResponse.success("排查报告导出成功", report.toString());
                })
                .orElse(ApiResponse.error("BATCH_NOT_FOUND", "批次不存在"));
    }

    private String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "-";
        }
        return dateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("JSON序列化失败", e);
            return "{}";
        }
    }
}
