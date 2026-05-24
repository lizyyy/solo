package com.dormitory.maintenance.service;

import com.dormitory.maintenance.entity.Complaint;
import com.dormitory.maintenance.entity.MaintenanceOrder;
import com.dormitory.maintenance.enums.ComplaintStatus;
import com.dormitory.maintenance.repository.ComplaintRepository;
import com.dormitory.maintenance.repository.MaintenanceOrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class ComplaintService {

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private MaintenanceOrderRepository orderRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional
    public Complaint createComplaint(Complaint complaint) {
        complaint.setComplaintNo(generateComplaintNo());
        complaint.setStatus(ComplaintStatus.PENDING);

        if (complaint.getOrderNo() != null) {
            orderRepository.findByOrderNo(complaint.getOrderNo()).ifPresent(order -> {
                complaint.setOrder(order);
                complaint.setBuilding(order.getBuilding());
            });
        }

        Complaint saved = complaintRepository.save(complaint);

        auditLogService.log(
                "Complaint", saved.getId(), saved.getComplaintNo(),
                "CREATE", null, saved.getComplaintType(),
                "创建投诉记录", saved.getStudentName()
        );

        return saved;
    }

    @Transactional
    public Complaint handleComplaint(Long complaintId, String handler, String handleResult, ComplaintStatus newStatus) {
        Complaint complaint = getComplaint(complaintId);

        String oldStatus = complaint.getStatus().getDescription();
        complaint.setStatus(newStatus);
        complaint.setHandler(handler);
        complaint.setHandleTime(LocalDateTime.now());
        complaint.setHandleResult(handleResult);

        Complaint saved = complaintRepository.save(complaint);

        auditLogService.log(
                "Complaint", saved.getId(), saved.getComplaintNo(),
                "HANDLE", oldStatus, newStatus.getDescription(),
                handleResult, handler
        );

        return saved;
    }

    public Complaint linkToOrder(Long complaintId, String orderNo) {
        Complaint complaint = getComplaint(complaintId);
        MaintenanceOrder order = orderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在"));

        complaint.setOrder(order);
        complaint.setOrderNo(orderNo);

        return complaintRepository.save(complaint);
    }

    public Complaint getComplaint(Long complaintId) {
        return complaintRepository.findById(complaintId)
                .orElseThrow(() -> new IllegalArgumentException("投诉不存在"));
    }

    public Complaint getComplaintByNo(String complaintNo) {
        return complaintRepository.findByComplaintNo(complaintNo)
                .orElseThrow(() -> new IllegalArgumentException("投诉不存在"));
    }

    public List<Complaint> getComplaintsByOrder(Long orderId) {
        return complaintRepository.findByOrderId(orderId);
    }

    public List<Complaint> getComplaintsByOrderNo(String orderNo) {
        return complaintRepository.findByOrderNo(orderNo);
    }

    public List<Complaint> getComplaintsByStatus(ComplaintStatus status) {
        return complaintRepository.findByStatus(status);
    }

    public List<Complaint> getComplaintsByBuilding(Long buildingId) {
        return complaintRepository.findByBuildingId(buildingId);
    }

    public List<Complaint> getAllComplaints() {
        return complaintRepository.findAll();
    }

    private String generateComplaintNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "CP" + date + uuid;
    }
}
