package com.cache.orchestrator.repository;

import com.cache.orchestrator.domain.entity.ConfirmationReceipt;
import com.cache.orchestrator.domain.enums.ConfirmationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConfirmationReceiptRepository extends JpaRepository<ConfirmationReceipt, Long> {

    Optional<ConfirmationReceipt> findByBatchIdAndReceiptId(Long batchId, String receiptId);

    boolean existsByBatchIdAndReceiptId(Long batchId, String receiptId);

    List<ConfirmationReceipt> findByBatchId(Long batchId);

    List<ConfirmationReceipt> findByBatchIdAndStatus(Long batchId, ConfirmationStatus status);

    long countByBatchIdAndStatus(Long batchId, ConfirmationStatus status);
}
