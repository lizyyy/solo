package com.ortho.rework.repository;

import com.ortho.rework.entity.ReworkOrder;
import com.ortho.rework.enums.ReworkStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReworkOrderRepository extends JpaRepository<ReworkOrder, Long> {
    Optional<ReworkOrder> findByReworkNo(String reworkNo);
    
    List<ReworkOrder> findByBatchId(Long batchId);
    
    List<ReworkOrder> findByPatientId(Long patientId);
    
    List<ReworkOrder> findByStatus(ReworkStatus status);
    
    @Query("SELECT r FROM ReworkOrder r WHERE r.batch.batchNo = ?1 AND r.status NOT IN (com.ortho.rework.enums.ReworkStatus.CLOSED, com.ortho.rework.enums.ReworkStatus.CANCELLED) AND r.isDuplicate = false")
    List<ReworkOrder> findActiveReworkByBatchNo(String batchNo);
    
    @Query("SELECT COUNT(r) FROM ReworkOrder r WHERE r.batch.originalBatchNo = ?1 AND r.isDuplicate = false")
    Long countReworkByOriginalBatchNo(String originalBatchNo);
    
    List<ReworkOrder> findByStatusIn(List<ReworkStatus> statuses);
}
