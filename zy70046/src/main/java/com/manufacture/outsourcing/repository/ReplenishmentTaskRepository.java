package com.manufacture.outsourcing.repository;

import com.manufacture.outsourcing.entity.ReplenishmentTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface ReplenishmentTaskRepository extends JpaRepository<ReplenishmentTask, Long>, JpaSpecificationExecutor<ReplenishmentTask> {

    Optional<ReplenishmentTask> findByTaskNo(String taskNo);

    List<ReplenishmentTask> findByOrderId(Long orderId);

    List<ReplenishmentTask> findByBatchId(Long batchId);

    List<ReplenishmentTask> findBySupplierId(Long supplierId);

    List<ReplenishmentTask> findByTaskStatusIn(List<String> statuses);

    List<ReplenishmentTask> findByInspectionResultId(Long inspectionResultId);

    @Query("SELECT COALESCE(SUM(r.requiredQuantity), 0) FROM ReplenishmentTask r WHERE r.order.id = :orderId AND r.taskStatus NOT IN :excludedStatuses")
    BigDecimal sumRequiredQuantityByOrderIdAndStatusNotIn(@Param("orderId") Long orderId, @Param("excludedStatuses") List<String> excludedStatuses);

    @Query("SELECT COALESCE(SUM(r.receivedQuantity), 0) FROM ReplenishmentTask r WHERE r.order.id = :orderId")
    BigDecimal sumReceivedQuantityByOrderId(@Param("orderId") Long orderId);
}
