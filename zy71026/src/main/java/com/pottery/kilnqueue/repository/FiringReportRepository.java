package com.pottery.kilnqueue.repository;

import com.pottery.kilnqueue.entity.FiringReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FiringReportRepository extends JpaRepository<FiringReport, Long> {
    Optional<FiringReport> findByReportNo(String reportNo);
    List<FiringReport> findByBatchId(Long batchId);
    List<FiringReport> findByWorkId(Long workId);
    List<FiringReport> findByStudentNo(String studentNo);
    List<FiringReport> findBySuccess(Boolean success);

    @Query("SELECT COUNT(f) FROM FiringReport f WHERE f.batch.id = :batchId")
    Long countByBatchId(@Param("batchId") Long batchId);

    @Query("SELECT COUNT(f) FROM FiringReport f WHERE f.batch.id = :batchId AND f.success = true")
    Long countSuccessByBatchId(@Param("batchId") Long batchId);

    boolean existsByReportNo(String reportNo);
}
