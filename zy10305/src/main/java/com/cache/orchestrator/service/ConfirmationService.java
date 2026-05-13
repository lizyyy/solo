package com.cache.orchestrator.service;

import com.cache.orchestrator.domain.dto.ConfirmationRequest;
import com.cache.orchestrator.domain.entity.ConfirmationReceipt;
import com.cache.orchestrator.domain.entity.FailedNode;
import com.cache.orchestrator.domain.entity.InvalidationBatch;
import com.cache.orchestrator.domain.enums.ConfirmationStatus;
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
        boolean receiptExists = batch.getReceipts().stream()
                .anyMatch(r -> r.getReceiptId().equals(request.getReceiptId()));
        
        if (receiptExists) {
            log.info("回执已存在, 幂等处理, receiptId: {}", request.getReceiptId());
            return;
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
        }

        log.info("回执处理完成, nodeId: {}, status: {}", request.getNodeId(), request.getStatus());
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
