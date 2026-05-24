package com.dormitory.maintenance.service;

import com.dormitory.maintenance.component.StatusMachine;
import com.dormitory.maintenance.dto.ApprovalRequest;
import com.dormitory.maintenance.entity.ApprovalRecord;
import com.dormitory.maintenance.entity.MaintenanceOrder;
import com.dormitory.maintenance.enums.ApprovalResult;
import com.dormitory.maintenance.enums.MaintenanceStatus;
import com.dormitory.maintenance.repository.ApprovalRecordRepository;
import com.dormitory.maintenance.repository.MaintenanceOrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ApprovalService {

    @Autowired
    private ApprovalRecordRepository approvalRepository;

    @Autowired
    private MaintenanceOrderRepository orderRepository;

    @Autowired
    private StatusMachine statusMachine;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional
    public ApprovalRecord approve(Long orderId, ApprovalRequest request) {
        MaintenanceOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在"));

        if (!statusMachine.canApprove(order.getStatus())) {
            throw new IllegalStateException("当前状态不允许审批");
        }

        ApprovalRecord record = new ApprovalRecord();
        record.setOrder(order);
        record.setOrderNo(order.getOrderNo());
        record.setApprovalLevel(request.getApprovalLevel());
        record.setResult(request.getResult());
        record.setApprover(request.getApprover());
        record.setApprovalTime(LocalDateTime.now());
        record.setApprovalRemark(request.getApprovalRemark());
        record.setHandlingInstruction(request.getHandlingInstruction());
        record.setOriginalStartTime(order.getScheduledStartTime());
        record.setOriginalEndTime(order.getScheduledEndTime());

        if (request.getAdjustedStartTime() != null) {
            order.setScheduledStartTime(request.getAdjustedStartTime());
            record.setAdjustedStartTime(request.getAdjustedStartTime());
        }
        if (request.getAdjustedEndTime() != null) {
            order.setScheduledEndTime(request.getAdjustedEndTime());
            record.setAdjustedEndTime(request.getAdjustedEndTime());
        }

        MaintenanceStatus oldStatus = order.getStatus();
        MaintenanceStatus newStatus = switch (request.getResult()) {
            case APPROVED, EMERGENCY_APPROVED, MODIFIED -> MaintenanceStatus.APPROVED;
            case REJECTED -> MaintenanceStatus.REJECTED;
            default -> order.getStatus();
        };

        if (newStatus != oldStatus) {
            order.setStatus(newStatus);
            order.setAuditor(request.getApprover());
            order.setAuditTime(LocalDateTime.now());
            order.setAuditRemark(request.getApprovalRemark());
        }

        orderRepository.save(order);
        ApprovalRecord saved = approvalRepository.save(record);

        auditLogService.logOrderChange(
                orderId, order.getOrderNo(),
                "APPROVE",
                oldStatus.getDescription() + " - " + order.getScheduledStartTime(),
                newStatus.getDescription() + " - " + order.getScheduledStartTime(),
                request.getResult().getDescription() + ": " + request.getApprovalRemark(),
                request.getApprover()
        );

        return saved;
    }

    public List<ApprovalRecord> getOrderApprovals(Long orderId) {
        return approvalRepository.findByOrderId(orderId);
    }

    public List<ApprovalRecord> getOrderApprovalsByNo(String orderNo) {
        return approvalRepository.findByOrderNoOrderByCreatedAtDesc(orderNo);
    }

    public ApprovalRecord getApproval(Long approvalId) {
        return approvalRepository.findById(approvalId)
                .orElseThrow(() -> new IllegalArgumentException("审批记录不存在"));
    }

    public List<ApprovalRecord> getAllApprovals() {
        return approvalRepository.findAll();
    }
}
