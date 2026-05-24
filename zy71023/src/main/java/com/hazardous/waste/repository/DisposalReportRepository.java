package com.hazardous.waste.repository;

import com.hazardous.waste.entity.DisposalReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DisposalReportRepository extends JpaRepository<DisposalReport, Long> {

    Optional<DisposalReport> findByReportNo(String reportNo);

    Optional<DisposalReport> findByTransferFormNo(String transferFormNo);

    List<DisposalReport> findByCategory(String category);

    List<DisposalReport> findByIsApproved(Boolean isApproved);

    List<DisposalReport> findByCreatedAtBetween(LocalDateTime startTime, LocalDateTime endTime);

    boolean existsByReportNo(String reportNo);
}
