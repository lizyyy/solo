package com.approval.coordinator.repository;

import com.approval.coordinator.model.entity.ProcessingReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProcessingReceiptRepository extends JpaRepository<ProcessingReceipt, Long> {

    Optional<ProcessingReceipt> findByReceiptId(String receiptId);

    List<ProcessingReceipt> findByBatch_BatchIdOrderByCreatedAtDesc(String batchId);

    List<ProcessingReceipt> findByBatch_BatchIdAndChunkNumber(String batchId, Integer chunkNumber);
}
