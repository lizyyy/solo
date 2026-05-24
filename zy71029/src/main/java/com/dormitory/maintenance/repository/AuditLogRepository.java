package com.dormitory.maintenance.repository;

import com.dormitory.maintenance.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByEntityTypeAndEntityIdOrderByOperatedAtDesc(String entityType, Long entityId);
    List<AuditLog> findByEntityTypeAndEntityNoOrderByOperatedAtDesc(String entityType, String entityNo);
    List<AuditLog> findByOperatorOrderByOperatedAtDesc(String operator);
}
