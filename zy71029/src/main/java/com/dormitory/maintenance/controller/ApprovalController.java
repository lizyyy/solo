package com.dormitory.maintenance.controller;

import com.dormitory.maintenance.dto.ApprovalRequest;
import com.dormitory.maintenance.entity.ApprovalRecord;
import com.dormitory.maintenance.service.ApprovalService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/approvals")
public class ApprovalController {

    @Autowired
    private ApprovalService approvalService;

    @PostMapping("/order/{orderId}")
    public ResponseEntity<ApprovalRecord> approveOrder(
            @PathVariable Long orderId,
            @Valid @RequestBody ApprovalRequest request) {
        return ResponseEntity.ok(approvalService.approve(orderId, request));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<ApprovalRecord>> getOrderApprovals(@PathVariable Long orderId) {
        return ResponseEntity.ok(approvalService.getOrderApprovals(orderId));
    }

    @GetMapping("/order-no/{orderNo}")
    public ResponseEntity<List<ApprovalRecord>> getOrderApprovalsByNo(@PathVariable String orderNo) {
        return ResponseEntity.ok(approvalService.getOrderApprovalsByNo(orderNo));
    }

    @GetMapping("/{approvalId}")
    public ResponseEntity<ApprovalRecord> getApproval(@PathVariable Long approvalId) {
        return ResponseEntity.ok(approvalService.getApproval(approvalId));
    }

    @GetMapping
    public ResponseEntity<List<ApprovalRecord>> getAllApprovals() {
        return ResponseEntity.ok(approvalService.getAllApprovals());
    }
}
