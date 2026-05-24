package com.hazardous.waste.repository;

import com.hazardous.waste.entity.WasteRecord;
import com.hazardous.waste.enums.WasteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface WasteRecordRepository extends JpaRepository<WasteRecord, Long> {

    Optional<WasteRecord> findByRecordNo(String recordNo);

    List<WasteRecord> findByStatus(WasteStatus status);

    List<WasteRecord> findByCategory(String category);

    List<WasteRecord> findByBucketId(Long bucketId);

    List<WasteRecord> findByTransferFormNo(String transferFormNo);

    @Query("SELECT w FROM WasteRecord w WHERE w.status IN :statuses")
    List<WasteRecord> findByStatusIn(@Param("statuses") List<WasteStatus> statuses);

    @Query("SELECT w FROM WasteRecord w WHERE w.status = :status AND w.inTime < :cutoffTime")
    List<WasteRecord> findOverdueRecords(@Param("status") WasteStatus status, @Param("cutoffTime") LocalDateTime cutoffTime);

    @Query("SELECT w FROM WasteRecord w WHERE w.isOverdue = true AND w.status = :status")
    List<WasteRecord> findOverdueAndStoring(@Param("status") WasteStatus status);

    boolean existsByRecordNo(String recordNo);

    boolean existsByTransferFormNo(String transferFormNo);

    @Query("SELECT COUNT(w) FROM WasteRecord w WHERE w.bucket.id = :bucketId AND w.status IN :statuses")
    long countByBucketIdAndStatusIn(@Param("bucketId") Long bucketId, @Param("statuses") List<WasteStatus> statuses);

    @Query("SELECT SUM(w.weight) FROM WasteRecord w WHERE w.bucket.id = :bucketId AND w.status IN :statuses")
    Double sumWeightByBucketIdAndStatusIn(@Param("bucketId") Long bucketId, @Param("statuses") List<WasteStatus> statuses);
}
