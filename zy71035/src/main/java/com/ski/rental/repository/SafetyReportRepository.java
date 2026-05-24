package com.ski.rental.repository;

import com.ski.rental.model.SafetyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface SafetyReportRepository extends JpaRepository<SafetyReport, Long> {
    Optional<SafetyReport> findByReportNo(String reportNo);
    Optional<SafetyReport> findByRentalOrderOrderNo(String orderNo);
}
