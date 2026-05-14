package com.cache.orchestrator.service;

import com.cache.orchestrator.domain.dto.ApiResponse;
import com.cache.orchestrator.domain.entity.FailedNode;
import com.cache.orchestrator.domain.entity.InvalidationBatch;
import com.cache.orchestrator.domain.entity.RetryPlan;
import com.cache.orchestrator.domain.enums.BatchStatus;
import com.cache.orchestrator.exception.BusinessException;
import com.cache.orchestrator.repository.InvalidationBatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RetryService {

    private final InvalidationBatchRepository batchRepository;

    @Transactional
    public Map<String, Object> retryNode(Long batchId, String nodeId) {
        log.info("触发节点重试, batchId: {}, nodeId: {}", batchId, nodeId);

        InvalidationBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException(404, "批次不存在: " + batchId));

        if (batch.getStatus() != BatchStatus.PROCESSING &&
            batch.getStatus() != BatchStatus.RETRYING &&
            batch.getStatus() != BatchStatus.PARTIAL_SUCCESS &&
            batch.getStatus() != BatchStatus.FAILED) {
            throw new BusinessException(400, "批次状态不支持重试, 当前状态: " + batch.getStatus());
        }

        boolean nodeExists = batch.getServiceNodes().stream()
                .anyMatch(node -> node.getNodeId().equals(nodeId));
        if (!nodeExists) {
            throw new BusinessException(400, "节点不属于当前批次: " + nodeId);
        }

        FailedNode failedNode = batch.getFailedNodes().stream()
                .filter(f -> f.getNodeId().equals(nodeId))
                .findFirst()
                .orElse(null);

        if (failedNode == null) {
            throw new BusinessException(400, "节点没有失败记录, 无需重试: " + nodeId);
        }

        RetryPlan retryPlan = batch.getRetryPlans().stream()
                .filter(plan -> plan.getNodeId().equals(nodeId))
                .findFirst()
                .orElse(null);

        if (retryPlan == null) {
            retryPlan = RetryPlan.builder()
                    .nodeId(nodeId)
                    .retryNumber(0)
                    .maxRetries(3)
                    .delaySeconds(60L)
                    .scheduledAt(LocalDateTime.now())
                    .batch(batch)
                    .build();
            batch.getRetryPlans().add(retryPlan);
        }

        if (retryPlan.getRetryNumber() >= retryPlan.getMaxRetries()) {
            throw new BusinessException(400, "节点已达到最大重试次数: " + retryPlan.getMaxRetries());
        }

        retryPlan.setRetryNumber(retryPlan.getRetryNumber() + 1);
        retryPlan.setExecutedAt(LocalDateTime.now());
        retryPlan.setRetryResult("RETRYING");

        failedNode.setRetryCount(failedNode.getRetryCount() + 1);

        batch.getReceipts().removeIf(r -> r.getNodeId().equals(nodeId));

        if (batch.getStatus() != BatchStatus.PROCESSING && batch.getStatus() != BatchStatus.RETRYING) {
            batch.setStatus(BatchStatus.RETRYING);
        }

        InvalidationBatch savedBatch = batchRepository.save(batch);

        log.info("节点重试计划已启动, batchId: {}, nodeId: {}, retryNumber: {}",
                batchId, nodeId, retryPlan.getRetryNumber());

        Map<String, Object> result = new HashMap<>();
        result.put("nodeId", nodeId);
        result.put("retryNumber", retryPlan.getRetryNumber());
        result.put("maxRetries", retryPlan.getMaxRetries());
        result.put("status", "RETRYING");
        result.put("previousFailureReason", failedNode.getFailureReason());
        result.put("batchStatus", savedBatch.getStatus().name());

        return result;
    }

    @Transactional
    public Map<String, Object> retryAllNodes(Long batchId) {
        log.info("触发批次所有失败节点重试, batchId: {}", batchId);

        InvalidationBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException(404, "批次不存在: " + batchId));

        List<String> failedNodeIds = batch.getFailedNodes().stream()
                .map(FailedNode::getNodeId)
                .collect(Collectors.toList());

        if (failedNodeIds.isEmpty()) {
            throw new BusinessException(400, "批次没有失败节点需要重试");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("totalFailedNodes", failedNodeIds.size());

        int retriedCount = 0;
        int skippedCount = 0;

        for (String nodeId : failedNodeIds) {
            try {
                retryNode(batchId, nodeId);
                retriedCount++;
            } catch (BusinessException e) {
                log.warn("节点 {} 重试跳过: {}", nodeId, e.getMessage());
                skippedCount++;
            }
        }

        result.put("retriedCount", retriedCount);
        result.put("skippedCount", skippedCount);
        result.put("status", "RETRYING");

        log.info("批次重试完成, batchId: {}, 成功重试: {}, 跳过: {}", batchId, retriedCount, skippedCount);

        return result;
    }

    public List<Map<String, Object>> getRetryStatus(Long batchId) {
        InvalidationBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException(404, "批次不存在: " + batchId));

        return batch.getRetryPlans().stream()
                .map(plan -> {
                    Map<String, Object> info = new HashMap<>();
                    info.put("nodeId", plan.getNodeId());
                    info.put("retryNumber", plan.getRetryNumber());
                    info.put("maxRetries", plan.getMaxRetries());
                    info.put("delaySeconds", plan.getDelaySeconds());
                    info.put("scheduledAt", plan.getScheduledAt());
                    info.put("executedAt", plan.getExecutedAt());
                    info.put("retryResult", plan.getRetryResult());
                    return info;
                })
                .collect(Collectors.toList());
    }
}
