package com.package.repo.repository;

import com.package.repo.model.entity.OperationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {

    List<OperationLog> findByResourceKeyOrderByOperationTimeDesc(String resourceKey);

    List<OperationLog> findBySuccessFalse();

    List<OperationLog> findByOperationTimeBetweenOrderByOperationTimeDesc(LocalDateTime start, LocalDateTime end);

    List<OperationLog> findByOperationTypeOrderByOperationTimeDesc(String operationType);
}
