package com.dormitory.maintenance.repository;

import com.dormitory.maintenance.entity.ApprovalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApprovalRecordRepository extends JpaRepository<ApprovalRecord, Long> {
    List<ApprovalRecord> findByOrderId(Long orderId);
    List<ApprovalRecord> findByOrderNo(String orderNo);
    List<ApprovalRecord> findByOrderNoOrderByCreatedAtDesc(String orderNo);
}
