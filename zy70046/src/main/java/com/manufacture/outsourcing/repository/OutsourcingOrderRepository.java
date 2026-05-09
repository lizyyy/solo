package com.manufacture.outsourcing.repository;

import com.manufacture.outsourcing.entity.OutsourcingOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface OutsourcingOrderRepository extends JpaRepository<OutsourcingOrder, Long>, JpaSpecificationExecutor<OutsourcingOrder> {

    Optional<OutsourcingOrder> findByOrderNo(String orderNo);

    boolean existsByOrderNo(String orderNo);

    List<OutsourcingOrder> findBySupplierId(Long supplierId);

    List<OutsourcingOrder> findByOrderStatusIn(List<String> statuses);
}
