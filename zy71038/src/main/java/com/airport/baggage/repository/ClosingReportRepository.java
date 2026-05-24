package com.airport.baggage.repository;

import com.airport.baggage.entity.ClosingReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ClosingReportRepository extends JpaRepository<ClosingReport, Long> {
    Optional<ClosingReport> findByCompensationOrderId(Long compensationOrderId);
    Optional<ClosingReport> findByReportNo(String reportNo);
    List<ClosingReport> findByClosedAtBetween(LocalDateTime start, LocalDateTime end);
}
