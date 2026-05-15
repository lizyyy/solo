package com.crossborder.approval.repository;

import com.crossborder.approval.model.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByApplicationIdOrderByTimestampDesc(Long applicationId);

    List<AuditLog> findByAccessTokenIdOrderByTimestampDesc(Long tokenId);

    List<AuditLog> findByOperatorId(String operatorId);

    List<AuditLog> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime startTime, LocalDateTime endTime);
}
