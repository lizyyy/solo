package com.port.reefer.repository;

import com.port.reefer.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Long entityId);

    List<AuditLog> findByInspectorIdOrderByCreatedAtDesc(Long inspectorId);

    List<AuditLog> findByOperationAndEntityTypeAndEntityId(String operation, String entityType, Long entityId);

    List<AuditLog> findByCreatedAtBetweenOrderByCreatedAtDesc(LocalDateTime start, LocalDateTime end);
}
