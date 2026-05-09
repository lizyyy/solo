package com.manufacture.outsourcing.repository;

import com.manufacture.outsourcing.entity.DeductionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface DeductionRecordRepository extends JpaRepository<DeductionRecord, Long>, JpaSpecificationExecutor<DeductionRecord> {

    Optional<DeductionRecord> findByRecordNo(String recordNo);

    List<DeductionRecord> findByInspectionResultId(Long inspectionResultId);

    List<DeductionRecord> findByBatchId(Long batchId);

    List<DeductionRecord> findByOrderId(Long orderId);

    List<DeductionRecord> findBySupplierId(Long supplierId);

    List<DeductionRecord> findByRecordStatusIn(List<String> statuses);

    @Query("SELECT COALESCE(SUM(d.deductionAmount), 0) FROM DeductionRecord d WHERE d.order.id = :orderId AND d.recordStatus IN :statuses")
    BigDecimal sumDeductionAmountByOrderIdAndStatusIn(@Param("orderId") Long orderId, @Param("statuses") List<String> statuses);
}
