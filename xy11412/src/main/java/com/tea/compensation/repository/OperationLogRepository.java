package com.tea.compensation.repository;

import com.tea.compensation.entity.OperationLog;
import com.tea.compensation.enums.OperationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {

    List<OperationLog> findByTaskIdOrderByOperationTimeDesc(Long taskId);

    List<OperationLog> findByBatchNoOrderByOperationTimeDesc(String batchNo);

    Page<OperationLog> findByTaskId(Long taskId, Pageable pageable);

    Page<OperationLog> findByBatchNo(String batchNo, Pageable pageable);

    Page<OperationLog> findByOperator(String operator, Pageable pageable);

    Page<OperationLog> findByOperationType(OperationType operationType, Pageable pageable);

    List<OperationLog> findByTaskIdAndOperationTypeOrderByOperationTimeDesc(Long taskId, OperationType operationType);

    List<OperationLog> findByOperationTimeBetweenOrderByOperationTimeDesc(LocalDateTime start, LocalDateTime end);
}
