package com.tea.compensation.repository;

import com.tea.compensation.entity.AuditHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditHistoryRepository extends JpaRepository<AuditHistory, Long> {

    List<AuditHistory> findByTaskIdOrderByModifiedAtDesc(Long taskId);

    List<AuditHistory> findByBatchNoOrderByModifiedAtDesc(String batchNo);

    Page<AuditHistory> findByTaskId(Long taskId, Pageable pageable);

    Page<AuditHistory> findByBatchNo(String batchNo, Pageable pageable);

    Page<AuditHistory> findByModifiedBy(String modifiedBy, Pageable pageable);

    List<AuditHistory> findByTaskIdAndFieldNameOrderByModifiedAtDesc(Long taskId, String fieldName);

    List<AuditHistory> findByModifiedAtBetweenOrderByModifiedAtDesc(LocalDateTime start, LocalDateTime end);
}
