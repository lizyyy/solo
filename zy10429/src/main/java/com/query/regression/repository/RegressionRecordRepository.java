package com.query.regression.repository;

import com.query.regression.entity.RegressionRecord;
import com.query.regression.enums.RegressionStatus;
import com.query.regression.enums.RiskLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RegressionRecordRepository extends JpaRepository<RegressionRecord, Long> {
    List<RegressionRecord> findByStatus(RegressionStatus status);
    List<RegressionRecord> findByRiskLevel(RiskLevel riskLevel);
    List<RegressionRecord> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    List<RegressionRecord> findByTemplateId(Long templateId);
    
    @Query("SELECT r FROM RegressionRecord r WHERE r.status IN ?1 ORDER BY r.createdAt DESC")
    List<RegressionRecord> findByStatusIn(List<RegressionStatus> statuses);
}
