package com.ortho.rework.repository;

import com.ortho.rework.entity.ReworkReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ReworkReportRepository extends JpaRepository<ReworkReport, Long> {
    Optional<ReworkReport> findByReportNo(String reportNo);
    Optional<ReworkReport> findByReworkOrderId(Long reworkOrderId);
}
