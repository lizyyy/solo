package com.dormitory.maintenance.repository;

import com.dormitory.maintenance.entity.Complaint;
import com.dormitory.maintenance.enums.ComplaintStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    Optional<Complaint> findByComplaintNo(String complaintNo);
    List<Complaint> findByOrderId(Long orderId);
    List<Complaint> findByOrderNo(String orderNo);
    List<Complaint> findByStatus(ComplaintStatus status);
    List<Complaint> findByBuildingId(Long buildingId);
}
