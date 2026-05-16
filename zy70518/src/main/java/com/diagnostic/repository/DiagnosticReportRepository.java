package com.diagnostic.repository;

import com.diagnostic.entity.DiagnosticReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DiagnosticReportRepository extends JpaRepository<DiagnosticReport, Long> {

    Optional<DiagnosticReport> findByReportNo(String reportNo);

    List<DiagnosticReport> findByInstanceIdAndPoolNameOrderByGeneratedAtDesc(
            String instanceId, String poolName);

    List<DiagnosticReport> findByGeneratedAtBetween(LocalDateTime startTime, LocalDateTime endTime);
}