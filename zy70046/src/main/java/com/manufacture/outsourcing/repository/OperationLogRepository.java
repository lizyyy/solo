package com.manufacture.outsourcing.repository;

import com.manufacture.outsourcing.entity.OperationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface OperationLogRepository extends JpaRepository<OperationLog, Long>, JpaSpecificationExecutor<OperationLog> {

    List<OperationLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Long entityId);

    List<OperationLog> findByEntityNoOrderByCreatedAtDesc(String entityNo);

    List<OperationLog> findByOperatorOrderByCreatedAtDesc(String operator);

    List<OperationLog> findByActionOrderByCreatedAtDesc(String action);
}
