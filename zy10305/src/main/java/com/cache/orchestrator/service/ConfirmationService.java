package com.cache.orchestrator.service;

import com.cache.orchestrator.domain.dto.ConfirmationRequest;
import com.cache.orchestrator.domain.entity.ConfirmationReceipt;
import com.cache.orchestrator.domain.entity.FailedNode;
import com.cache.orchestrator.domain.entity.InvalidationBatch;
import com.cache.orchestrator.domain.enums.ConfirmationStatus;
import com.cache.orchestrator.exception.BusinessException;
import com.cache.orchestrator.repository.ConfirmationReceiptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConfirmationService {

    private final ConfirmationReceiptRepository receiptRepository;

    public void processConfirmation(InvalidationBatch batch, ConfirmationRequest request) {
        // 检查1: receiptId 幂等 - 同一回执 ID 重复提交直接返回
        boolean receiptExists = batch.getReceipts().stream()
                .anyMatch(r -> r.getReceiptId().equals(request.getReceiptId()));
        
        if (receiptExists) {
            log.info("回执已存在, 幂等处理, receiptId: {}", request.getReceiptId());
            return;
        }

        // 检查2: nodeId 去重 - 同一节点不允许重复提交不同回执
        // 这是为了防止同一个节点通过提交多个不同 receiptId 来绕过对账逻辑
        boolean nodeAlreadyConfirmed = batch.getReceipts().stream()
                .anyMatch(r -> r.getNodeId().equals(request.getNodeId()));
        
        if (nodeAlreadyConfirmed) {
            log.warn("节点已提交回执, 拒绝重复提交, nodeId: {}, batchId: {}", 
                    request.getNodeId(), batch.getId());
            throw new BusinessException(400, 
                    "节点 [" + request.getNodeId() + "] 已在批次 [" + batch.getId() + "] 中提交回执，不允许重复提交");
        }

        ConfirmationReceipt receipt = ConfirmationReceipt.builder()
                .receiptId(request.getReceiptId())
                .nodeId(request.getNodeId())
                .status(request.getStatus())
                .failureReason(request.getFailureReason())
                .keysProcessed(request.getKeysProcessed())
                .confirmedAt(LocalDateTime.now())
                .batch(batch)
                .build();

        batch.getReceipts().add(receipt);

        if (request.getStatus() == ConfirmationStatus.FAILED) {
            handleFailedConfirmation(batch, request);
        } else if (request.getStatus() == ConfirmationStatus.CONFIRMED) {
            updateRetryPlanOnSuccess(batch, request.getNodeId());
        }

        log.info("回执处理完成, nodeId: {}, status: {}", request.getNodeId(), request.getStatus());
    }

    private void updateRetryPlanOnSuccess(InvalidationBatch batch, String nodeId) {
        batch.getRetryPlans().stream()
                .filter(plan -> plan.getNodeId().equals(nodeId))
                .findFirst()
                .ifPresent(plan -> {
                    plan.setRetryResult("SUCCESS");
                    log.info("节点重试成功, nodeId: {}, retryNumber: {}", nodeId, plan.getRetryNumber());
                });
        
        batch.getFailedNodes().removeIf(f -> f.getNodeId().equals(nodeId));
    }

    private void handleFailedConfirmation(InvalidationBatch batch, ConfirmationRequest request) {
        FailedNode failedNode = FailedNode.builder()
                .nodeId(request.getNodeId())
                .failureReason(request.getFailureReason())
                .retryCount(0)
                .failedAt(LocalDateTime.now())
                .batch(batch)
                .build();
        
        batch.getFailedNodes().add(failedNode);

        batch.getRetryPlans().stream()
                .filter(plan -> plan.getNodeId().equals(request.getNodeId()))
                .findFirst()
                .ifPresent(plan -> {
                    if (plan.getRetryNumber() < plan.getMaxRetries()) {
                        plan.setRetryNumber(plan.getRetryNumber() + 1);
                        plan.setScheduledAt(LocalDateTime.now().plusSeconds(plan.getDelaySeconds()));
                        log.info("已安排重试, nodeId: {}, retryNumber: {}", request.getNodeId(), plan.getRetryNumber());
                    }
                });
    }
}
