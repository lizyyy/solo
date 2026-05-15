package com.business.recalculate.repository;

import com.business.recalculate.model.RevokeRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RevokeRecordRepository extends JpaRepository<RevokeRecord, Long> {
    
    Optional<RevokeRecord> findByBatchId(Long batchId);
    
    Optional<RevokeRecord> findByBatchNo(String batchNo);
    
    List<RevokeRecord> findByRevokedBy(String revokedBy);
}
