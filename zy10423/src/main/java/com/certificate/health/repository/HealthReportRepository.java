package com.certificate.health.repository;

import com.certificate.health.enums.HealthStatus;
import com.certificate.health.model.HealthReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HealthReportRepository extends JpaRepository<HealthReport, Long> {

    Optional<HealthReport> findByReportId(String reportId);

    List<HealthReport> findByOverallStatus(HealthStatus overallStatus);

    Optional<HealthReport> findByOriginalInputHash(String originalInputHash);
}
