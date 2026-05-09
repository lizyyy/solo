package com.manufacture.outsourcing.repository;

import com.manufacture.outsourcing.entity.InspectionResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface InspectionResultRepository extends JpaRepository<InspectionResult, Long>, JpaSpecificationExecutor<InspectionResult> {

    Optional<InspectionResult> findByResultNo(String resultNo);

    List<InspectionResult> findByBatchId(Long batchId);

    List<InspectionResult> findByBatchIdOrderByCreatedAtDesc(Long batchId);

    List<InspectionResult> findByResultStatusIn(List<String> statuses);

    boolean existsByBatchIdAndResultStatusNot(Long batchId, String status);
}
