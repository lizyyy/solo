package com.tokenexchange.repository;

import com.tokenexchange.entity.UsageRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UsageRecordRepository extends JpaRepository<UsageRecord, Long> {
    List<UsageRecord> findByTokenValueOrderByTimestampDesc(String tokenValue);
    List<UsageRecord> findByUserIdOrderByTimestampDesc(String userId);
    List<UsageRecord> findByServiceIdOrderByTimestampDesc(String serviceId);
    List<UsageRecord> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime start, LocalDateTime end);
    
    @Query("SELECT u FROM UsageRecord u WHERE u.userId = ?1 AND u.timestamp BETWEEN ?2 AND ?3 ORDER BY u.timestamp DESC")
    List<UsageRecord> findByUserIdAndTimeRange(String userId, LocalDateTime start, LocalDateTime end);
}
