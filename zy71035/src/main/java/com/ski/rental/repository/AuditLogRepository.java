package com.ski.rental.repository;

import com.ski.rental.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByOrderNoOrderByCreatedAtDesc(String orderNo);
    List<AuditLog> findByBatchNoOrderByCreatedAtDesc(String batchNo);
}
