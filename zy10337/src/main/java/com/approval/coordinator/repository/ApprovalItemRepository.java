package com.approval.coordinator.repository;

import com.approval.coordinator.model.entity.ApprovalItem;
import com.approval.coordinator.model.enums.ItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApprovalItemRepository extends JpaRepository<ApprovalItem, Long> {

    List<ApprovalItem> findByBatch_BatchId(String batchId);

    Optional<ApprovalItem> findByBatch_BatchIdAndItemId(String batchId, String itemId);

    Optional<ApprovalItem> findByIdempotentKey(String idempotentKey);

    boolean existsByIdempotentKey(String idempotentKey);

    List<ApprovalItem> findByBatch_BatchIdAndChunkNumber(String batchId, Integer chunkNumber);

    List<ApprovalItem> findByBatch_BatchIdAndStatus(String batchId, ItemStatus status);

    @Query("SELECT i FROM ApprovalItem i WHERE i.batch.batchId = :batchId AND i.status IN :statuses")
    List<ApprovalItem> findByBatch_BatchIdAndStatusIn(@Param("batchId") String batchId, @Param("statuses") List<ItemStatus> statuses);

    @Query("SELECT COUNT(i) FROM ApprovalItem i WHERE i.batch.batchId = :batchId AND i.status = :status")
    long countByBatch_BatchIdAndStatus(@Param("batchId") String batchId, @Param("status") ItemStatus status);

    List<ApprovalItem> findByBatch_BatchIdAndItemIdIn(String batchId, List<String> itemIds);
}
