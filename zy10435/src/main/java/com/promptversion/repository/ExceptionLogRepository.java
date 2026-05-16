package com.promptversion.repository;

import com.promptversion.entity.ExceptionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ExceptionLogRepository extends JpaRepository<ExceptionLog, Long> {
    List<ExceptionLog> findByTemplateIdOrderByCreatedAtDesc(Long templateId);
    List<ExceptionLog> findByVersionIdOrderByCreatedAtDesc(Long versionId);
    List<ExceptionLog> findByCreatedAtBetweenOrderByCreatedAtDesc(LocalDateTime startTime, LocalDateTime endTime);
    List<ExceptionLog> findByOperationTypeOrderByCreatedAtDesc(String operationType);
}