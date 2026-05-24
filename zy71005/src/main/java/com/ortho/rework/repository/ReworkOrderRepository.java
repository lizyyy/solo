package com.ortho.rework.repository;

import com.ortho.rework.entity.ReworkOrder;
import com.ortho.rework.enums.ReworkStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReworkOrderRepository extends JpaRepository<ReworkOrder, Long> {
    Optional<ReworkOrder> findByOrderNumber(String orderNumber);
    List<ReworkOrder> findByStatus(ReworkStatus status);
}
