package com.cache.orchestrator.service;

import com.cache.orchestrator.domain.dto.BatchResponse;
import com.cache.orchestrator.domain.dto.ConfirmationRequest;
import com.cache.orchestrator.domain.dto.CreateBatchRequest;
import com.cache.orchestrator.domain.entity.*;
import com.cache.orchestrator.domain.enums.BatchStatus;
import com.cache.orchestrator.domain.enums.ConfirmationStatus;
import com.cache.orchestrator.exception.BusinessException;
import com.cache.orchestrator.repository.InvalidationBatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvalidationOrchestratorService {

    private final InvalidationBatchRepository batchRepository;
    private final KeyResolverService keyResolverService;
    private final ConfirmationService confirmationService;

    @Transactional
    public BatchResponse createBatch(CreateBatchRequest request) {
        log.info("创建失效批次, requestId: {}", request.getRequestId());

        if (batchRepository.existsByRequestId(request.getRequestId())) {
            log.info("请求已存在, 返回幂等结果, requestId: {}", request.getRequestId());
            InvalidationBatch existingBatch = batchRepository.findByRequestId(request.getRequestId())
                    .orElseThrow(() -> new BusinessException("批次不存在"));
            return buildBatchResponse(existingBatch);
        }

        if (!keyResolverService.validateKeyPattern(request.getKeyPattern())) {
            throw new BusinessException(400, "无效的键模式: " + request.getKeyPattern());
        }

        List<String> resolvedKeys = keyResolverService.resolveKeyPattern(request.getKeyPattern());

        InvalidationBatch batch = InvalidationBatch.builder()
                .requestId(request.getRequestId())
                .keyPattern(request.getKeyPattern())
                .totalKeys(resolvedKeys.size())
                .totalNodes(request.getServiceNodes().size())
                .status(BatchStatus.CREATED)
                .build();

        List<CacheKey> cacheKeys = resolvedKeys.stream()
                .map(key -> CacheKey.builder()
                        .cacheKey(key)
                        .batch(batch)
                        .build())
                .collect(Collectors.toList());
        batch.setCacheKeys(cacheKeys);

        List<ServiceNode> serviceNodes = request.getServiceNodes().stream()
                .map(nodeInfo -> ServiceNode.builder()
                        .nodeId(nodeInfo.getNodeId())
                        .nodeAddress(nodeInfo.getNodeAddress())
                        .priority(nodeInfo.getPriority())
                        .batch(batch)
                        .build())
                .collect(Collectors.toList());
        batch.setServiceNodes(serviceNodes);

        if (request.getRetryConfig() != null) {
            List<RetryPlan> retryPlans = serviceNodes.stream()
                    .map(node -> RetryPlan.builder()
                            .nodeId(node.getNodeId())
                            .retryNumber(0)
                            .maxRetries(request.getRetryConfig().getMaxRetries())
                            .delaySeconds(request.getRetryConfig().getDelaySeconds())
                            .scheduledAt(LocalDateTime.now())
                            .batch(batch)
                            .build())
                    .collect(Collectors.toList());
            batch.setRetryPlans(retryPlans);
        }

        InvalidationBatch savedBatch = batchRepository.save(batch);
        log.info("失效批次创建成功, batchId: {}, requestId: {}", savedBatch.getId(), savedBatch.getRequestId());

        return buildBatchResponse(savedBatch);
    }

    @Transactional
    public BatchResponse validateBatch(Long batchId) {
        log.info("校验批次, batchId: {}", batchId);

        InvalidationBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException(404, "批次不存在: " + batchId));

        if (batch.getStatus() != BatchStatus.CREATED) {
            throw new BusinessException(400, "批次状态不正确, 当前状态: " + batch.getStatus());
        }

        if (batch.getTotalKeys() == 0) {
            throw new BusinessException(400, "批次没有解析到任何缓存键");
        }

        if (batch.getServiceNodes().isEmpty()) {
            throw new BusinessException(400, "批次没有配置任何服务节点");
        }

        batch.setStatus(BatchStatus.VALIDATED);
        InvalidationBatch savedBatch = batchRepository.save(batch);
        log.info("批次校验通过, batchId: {}", batchId);

        return buildBatchResponse(savedBatch);
    }

    @Transactional
    public BatchResponse startProcessing(Long batchId) {
        log.info("开始处理批次, batchId: {}", batchId);

        InvalidationBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException(404, "批次不存在: " + batchId));

        if (batch.getStatus() != BatchStatus.VALIDATED) {
            throw new BusinessException(400, "批次未通过校验, 当前状态: " + batch.getStatus());
        }

        batch.setStatus(BatchStatus.PROCESSING);
        InvalidationBatch savedBatch = batchRepository.save(batch);
        log.info("批次开始处理, batchId: {}", batchId);

        return buildBatchResponse(savedBatch);
    }

    @Transactional
    public BatchResponse confirm(ConfirmationRequest request, Long batchId) {
        log.info("接收确认回执, batchId: {}, nodeId: {}, receiptId: {}", batchId, request.getNodeId(), request.getReceiptId());

        InvalidationBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException(404, "批次不存在: " + batchId));

        if (batch.getStatus() != BatchStatus.PROCESSING && batch.getStatus() != BatchStatus.RETRYING) {
            throw new BusinessException(400, "批次不在处理状态, 当前状态: " + batch.getStatus());
        }

        boolean nodeExists = batch.getServiceNodes().stream()
                .anyMatch(node -> node.getNodeId().equals(request.getNodeId()));
        if (!nodeExists) {
            throw new BusinessException(400, "节点不属于当前批次: " + request.getNodeId());
        }

        confirmationService.processConfirmation(batch, request);

        reconcileBatchStatus(batch);

        InvalidationBatch savedBatch = batchRepository.save(batch);
        return buildBatchResponse(savedBatch);
    }

    private void reconcileBatchStatus(InvalidationBatch batch) {
        long confirmedCount = batch.getReceipts().stream()
                .filter(r -> r.getStatus() == ConfirmationStatus.CONFIRMED)
                .count();
        long failedCount = batch.getReceipts().stream()
                .filter(r -> r.getStatus() == ConfirmationStatus.FAILED)
                .count();
        long timeoutCount = batch.getReceipts().stream()
                .filter(r -> r.getStatus() == ConfirmationStatus.TIMEOUT)
                .count();

        int totalNodes = batch.getTotalNodes();
        int processedCount = (int) (confirmedCount + failedCount + timeoutCount);

        if (processedCount == totalNodes) {
            boolean hasRetryInProgress = batch.getRetryPlans().stream()
                    .anyMatch(plan -> "RETRYING".equals(plan.getRetryResult()));
            
            if (hasRetryInProgress) {
                batch.setStatus(BatchStatus.RETRYING);
                log.info("批次有重试正在进行中, 保持 RETRYING 状态, batchId: {}", batch.getId());
            } else if (failedCount == 0 && timeoutCount == 0) {
                batch.setStatus(BatchStatus.SUCCESS);
                batch.setCompletedAt(LocalDateTime.now());
            } else if (confirmedCount > 0) {
                batch.setStatus(BatchStatus.PARTIAL_SUCCESS);
                batch.setCompletedAt(LocalDateTime.now());
            } else {
                batch.setStatus(BatchStatus.FAILED);
                batch.setCompletedAt(LocalDateTime.now());
            }
            log.info("批次对账完成, batchId: {}, 最终状态: {}", batch.getId(), batch.getStatus());
        }
    }

    public BatchResponse getBatchStatus(Long batchId) {
        InvalidationBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException(404, "批次不存在: " + batchId));
        return buildBatchResponse(batch);
    }

    public BatchResponse getBatchByRequestId(String requestId) {
        InvalidationBatch batch = batchRepository.findByRequestId(requestId)
                .orElseThrow(() -> new BusinessException(404, "批次不存在, requestId: " + requestId));
        return buildBatchResponse(batch);
    }

    public List<BatchResponse> getBatchHistory(LocalDateTime startTime, LocalDateTime endTime) {
        List<InvalidationBatch> batches = batchRepository.findByTimeRange(startTime, endTime);
        return batches.stream()
                .map(this::buildBatchResponse)
                .collect(Collectors.toList());
    }

    public List<BatchResponse> getBatchesByStatus(List<BatchStatus> statuses) {
        List<InvalidationBatch> batches = batchRepository.findByStatusIn(statuses);
        return batches.stream()
                .map(this::buildBatchResponse)
                .collect(Collectors.toList());
    }

    private BatchResponse buildBatchResponse(InvalidationBatch batch) {
        List<BatchResponse.KeyInfo> keyInfos = batch.getCacheKeys().stream()
                .map(key -> BatchResponse.KeyInfo.builder()
                        .cacheKey(key.getCacheKey())
                        .build())
                .collect(Collectors.toList());

        List<BatchResponse.NodeInfo> nodeInfos = batch.getServiceNodes().stream()
                .map(node -> BatchResponse.NodeInfo.builder()
                        .nodeId(node.getNodeId())
                        .nodeAddress(node.getNodeAddress())
                        .priority(node.getPriority())
                        .build())
                .collect(Collectors.toList());

        List<BatchResponse.ReceiptInfo> receiptInfos = batch.getReceipts().stream()
                .map(receipt -> BatchResponse.ReceiptInfo.builder()
                        .receiptId(receipt.getReceiptId())
                        .nodeId(receipt.getNodeId())
                        .status(receipt.getStatus().name())
                        .failureReason(receipt.getFailureReason())
                        .keysProcessed(receipt.getKeysProcessed())
                        .confirmedAt(receipt.getConfirmedAt())
                        .build())
                .collect(Collectors.toList());

        List<BatchResponse.FailedNodeInfo> failedNodeInfos = batch.getFailedNodes().stream()
                .map(failed -> BatchResponse.FailedNodeInfo.builder()
                        .nodeId(failed.getNodeId())
                        .failureReason(failed.getFailureReason())
                        .retryCount(failed.getRetryCount())
                        .failedAt(failed.getFailedAt())
                        .build())
                .collect(Collectors.toList());

        List<BatchResponse.RetryInfo> retryInfos = batch.getRetryPlans().stream()
                .map(retry -> BatchResponse.RetryInfo.builder()
                        .nodeId(retry.getNodeId())
                        .retryNumber(retry.getRetryNumber())
                        .maxRetries(retry.getMaxRetries())
                        .delaySeconds(retry.getDelaySeconds())
                        .scheduledAt(retry.getScheduledAt())
                        .result(retry.getRetryResult())
                        .build())
                .collect(Collectors.toList());

        int confirmedCount = (int) batch.getReceipts().stream()
                .filter(r -> r.getStatus() == ConfirmationStatus.CONFIRMED)
                .count();
        int failedCount = (int) batch.getReceipts().stream()
                .filter(r -> r.getStatus() == ConfirmationStatus.FAILED)
                .count();
        int pendingCount = batch.getTotalNodes() - confirmedCount - failedCount;
        double completionRate = batch.getTotalNodes() > 0 
                ? (double) confirmedCount / batch.getTotalNodes() * 100 
                : 0;

        BatchResponse.Progress progress = BatchResponse.Progress.builder()
                .confirmedCount(confirmedCount)
                .failedCount(failedCount)
                .pendingCount(pendingCount)
                .completionRate(Math.round(completionRate * 100.0) / 100.0)
                .build();

        return BatchResponse.builder()
                .batchId(batch.getId())
                .requestId(batch.getRequestId())
                .keyPattern(batch.getKeyPattern())
                .totalKeys(batch.getTotalKeys())
                .totalNodes(batch.getTotalNodes())
                .status(batch.getStatus())
                .errorMessage(batch.getErrorMessage())
                .createdAt(batch.getCreatedAt())
                .updatedAt(batch.getUpdatedAt())
                .completedAt(batch.getCompletedAt())
                .resolvedKeys(keyInfos)
                .nodes(nodeInfos)
                .receipts(receiptInfos)
                .failedNodes(failedNodeInfos)
                .retryPlans(retryInfos)
                .progress(progress)
                .build();
    }
}
