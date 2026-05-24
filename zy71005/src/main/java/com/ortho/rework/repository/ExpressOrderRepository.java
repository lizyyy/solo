package com.ortho.rework.repository;

import com.ortho.rework.entity.ExpressOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExpressOrderRepository extends JpaRepository<ExpressOrder, Long> {
    Optional<ExpressOrder> findByTrackingNumber(String trackingNumber);
    List<ExpressOrder> findByReworkOrderId(Long reworkOrderId);
}
