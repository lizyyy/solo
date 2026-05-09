package com.mold.service.domain.repository;

import com.mold.service.domain.entity.StrokeRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface StrokeRecordRepository extends JpaRepository<StrokeRecord, Long> {
    
    Optional<StrokeRecord> findByBatchId(String batchId);
    
    List<StrokeRecord> findByMoldIdAndStatus(Long moldId, StrokeRecord.RecordStatus status);
    
    List<StrokeRecord> findByMoldIdAndRecordTimeBetweenOrderByRecordTimeAsc(
            Long moldId, LocalDateTime startTime, LocalDateTime endTime);
    
    @Query("SELECT MAX(s.accumulatedStrokes) FROM StrokeRecord s WHERE s.moldId = :moldId AND s.status = 'ACTIVE'")
    Optional<Long> findMaxAccumulatedStrokesByMoldId(Long moldId);
    
    @Query("SELECT s FROM StrokeRecord s WHERE s.moldId = :moldId AND s.status = 'ACTIVE' ORDER BY s.recordTime DESC, s.id DESC LIMIT 1")
    Optional<StrokeRecord> findLatestActiveRecordByMoldId(Long moldId);
    
    List<StrokeRecord> findByOriginalBatchId(String originalBatchId);
    
    List<StrokeRecord> findByStatusIn(List<StrokeRecord.RecordStatus> statuses);
}
