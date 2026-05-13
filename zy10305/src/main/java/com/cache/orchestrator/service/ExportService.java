package com.cache.orchestrator.service;

import com.cache.orchestrator.domain.dto.BatchResponse;
import com.cache.orchestrator.domain.entity.InvalidationBatch;
import com.cache.orchestrator.repository.InvalidationBatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final InvalidationBatchRepository batchRepository;
    private final InvalidationOrchestratorService orchestratorService;

    public byte[] exportBatchToCsv(Long batchId) {
        log.info("导出批次数据到 CSV, batchId: {}", batchId);
        
        InvalidationBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new RuntimeException("批次不存在: " + batchId));
        
        BatchResponse batchResponse = orchestratorService.getBatchStatus(batchId);
        
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {
            
            writer.println("分布式缓存失效编排 - 批次详情导出");
            writer.println("导出时间," + LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            writer.println();
            
            writer.println("批次基本信息");
            writer.println("批次ID," + batchResponse.getBatchId());
            writer.println("请求ID," + batchResponse.getRequestId());
            writer.println("键模式," + batchResponse.getKeyPattern());
            writer.println("总键数," + batchResponse.getTotalKeys());
            writer.println("总节点数," + batchResponse.getTotalNodes());
            writer.println("状态," + batchResponse.getStatus());
            writer.println("创建时间," + formatDateTime(batchResponse.getCreatedAt()));
            writer.println("完成时间," + formatDateTime(batchResponse.getCompletedAt()));
            writer.println();
            
            writer.println("处理进度");
            writer.println("已确认," + batchResponse.getProgress().getConfirmedCount());
            writer.println("失败," + batchResponse.getProgress().getFailedCount());
            writer.println("待处理," + batchResponse.getProgress().getPendingCount());
            writer.println("完成率(%)," + batchResponse.getProgress().getCompletionRate());
            writer.println();
            
            writer.println("解析的缓存键");
            writer.println("序号,缓存键");
            List<BatchResponse.KeyInfo> keys = batchResponse.getResolvedKeys();
            for (int i = 0; i < keys.size(); i++) {
                writer.println((i + 1) + "," + keys.get(i).getCacheKey());
            }
            writer.println();
            
            writer.println("服务节点");
            writer.println("节点ID,节点地址,优先级");
            for (BatchResponse.NodeInfo node : batchResponse.getNodes()) {
                writer.println(node.getNodeId() + "," + node.getNodeAddress() + "," + 
                        (node.getPriority() != null ? node.getPriority() : ""));
            }
            writer.println();
            
            writer.println("确认回执");
            writer.println("回执ID,节点ID,状态,失败原因,处理键数,确认时间");
            for (BatchResponse.ReceiptInfo receipt : batchResponse.getReceipts()) {
                writer.println(receipt.getReceiptId() + "," + 
                        receipt.getNodeId() + "," + 
                        receipt.getStatus() + "," + 
                        (receipt.getFailureReason() != null ? receipt.getFailureReason() : "") + "," +
                        (receipt.getKeysProcessed() != null ? receipt.getKeysProcessed() : "") + "," +
                        formatDateTime(receipt.getConfirmedAt()));
            }
            writer.println();
            
            writer.println("失败节点");
            writer.println("节点ID,失败原因,重试次数,失败时间");
            for (BatchResponse.FailedNodeInfo failed : batchResponse.getFailedNodes()) {
                writer.println(failed.getNodeId() + "," + 
                        failed.getFailureReason() + "," + 
                        failed.getRetryCount() + "," +
                        formatDateTime(failed.getFailedAt()));
            }
            
            writer.flush();
            log.info("批次 CSV 导出完成, batchId: {}", batchId);
            return baos.toByteArray();
            
        } catch (Exception e) {
            log.error("导出 CSV 失败", e);
            throw new RuntimeException("导出失败: " + e.getMessage());
        }
    }

    public byte[] exportBatchHistoryToCsv(LocalDateTime startTime, LocalDateTime endTime) {
        log.info("导出批次历史到 CSV, 时间范围: {} - {}", startTime, endTime);
        
        List<BatchResponse> batches = orchestratorService.getBatchHistory(startTime, endTime);
        
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {
            
            writer.println("分布式缓存失效编排 - 批次历史导出");
            writer.println("导出时间," + LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            writer.println("时间范围," + formatDateTime(startTime) + " - " + formatDateTime(endTime));
            writer.println();
            
            writer.println("批次ID,请求ID,键模式,总键数,总节点数,状态,已确认,失败,完成率(%),创建时间,完成时间");
            for (BatchResponse batch : batches) {
                writer.println(batch.getBatchId() + "," + 
                        batch.getRequestId() + "," + 
                        batch.getKeyPattern() + "," + 
                        batch.getTotalKeys() + "," + 
                        batch.getTotalNodes() + "," + 
                        batch.getStatus() + "," + 
                        batch.getProgress().getConfirmedCount() + "," + 
                        batch.getProgress().getFailedCount() + "," + 
                        batch.getProgress().getCompletionRate() + "," +
                        formatDateTime(batch.getCreatedAt()) + "," + 
                        formatDateTime(batch.getCompletedAt()));
            }
            
            writer.flush();
            log.info("批次历史 CSV 导出完成, 共 {} 条记录", batches.size());
            return baos.toByteArray();
            
        } catch (Exception e) {
            log.error("导出历史 CSV 失败", e);
            throw new RuntimeException("导出失败: " + e.getMessage());
        }
    }

    private String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }
}
