package com.manufacture.outsourcing.repository;

import com.manufacture.outsourcing.entity.DeliveryBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface DeliveryBatchRepository extends JpaRepository<DeliveryBatch, Long>, JpaSpecificationExecutor<DeliveryBatch> {

    Optional<DeliveryBatch> findByBatchNo(String batchNo);

    List<DeliveryBatch> findByOrderId(Long orderId);

    List<DeliveryBatch> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    boolean existsByBatchNo(String batchNo);
}
