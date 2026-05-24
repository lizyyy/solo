package com.floodrelief.repository;

import com.floodrelief.entity.AllocationRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AllocationRecordRepository extends JpaRepository<AllocationRecord, Long> {
    Optional<AllocationRecord> findByAllocationNo(String allocationNo);
    List<AllocationRecord> findByShelterIdOrderByCreatedAtDesc(Long shelterId);
    List<AllocationRecord> findByShelterIdAndMaterialBatchIdAndStatusNot(Long shelterId, Long materialBatchId, AllocationRecord.AllocationStatus status);
    
    @Query("SELECT a FROM AllocationRecord a WHERE a.shelterId = ?1 AND a.materialBatchId = ?2 " +
           "AND a.status IN ('PENDING', 'APPROVED', 'DISPATCHED')")
    List<AllocationRecord> findActiveAllocations(Long shelterId, Long materialBatchId);
    
    List<AllocationRecord> findByStatus(AllocationRecord.AllocationStatus status);
    
    List<AllocationRecord> findByShelterIdAndStatus(Long shelterId, AllocationRecord.AllocationStatus status);
}
