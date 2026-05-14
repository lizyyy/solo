package com.quota.arbitration.controller;

import com.quota.arbitration.dto.ApprovalRequest;
import com.quota.arbitration.dto.BorrowApplicationRequest;
import com.quota.arbitration.dto.ReturnRequest;
import com.quota.arbitration.entity.*;
import com.quota.arbitration.service.QuotaBorrowService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/quota")
@RequiredArgsConstructor
public class QuotaBorrowController {
    private final QuotaBorrowService quotaBorrowService;

    @PostMapping("/customer")
    public ResponseEntity<CustomerQuota> createCustomerQuota(@Valid @RequestBody CustomerQuota quota) {
        return ResponseEntity.ok(quotaBorrowService.createCustomerQuota(quota));
    }

    @GetMapping("/customer/{customerId}")
    public ResponseEntity<CustomerQuota> getCustomerQuota(@PathVariable String customerId) {
        return ResponseEntity.ok(quotaBorrowService.getCustomerQuota(customerId));
    }

    @PostMapping("/pool")
    public ResponseEntity<SharedPool> createSharedPool(@Valid @RequestBody SharedPool pool) {
        return ResponseEntity.ok(quotaBorrowService.createSharedPool(pool));
    }

    @GetMapping("/pool/{poolCode}")
    public ResponseEntity<SharedPool> getSharedPool(@PathVariable String poolCode) {
        return ResponseEntity.ok(quotaBorrowService.getSharedPool(poolCode));
    }

    @PostMapping("/application")
    public ResponseEntity<BorrowApplication> createApplication(@Valid @RequestBody BorrowApplicationRequest request) {
        return ResponseEntity.ok(quotaBorrowService.createApplication(request));
    }

    @PostMapping("/application/{id}/submit")
    public ResponseEntity<BorrowApplication> submitForApproval(@PathVariable Long id) {
        return ResponseEntity.ok(quotaBorrowService.submitForApproval(id));
    }

    @PostMapping("/application/approve")
    public ResponseEntity<BorrowApplication> approve(@Valid @RequestBody ApprovalRequest request) {
        return ResponseEntity.ok(quotaBorrowService.approve(request));
    }

    @PostMapping("/application/{id}/activate")
    public ResponseEntity<BorrowApplication> activateApplication(@PathVariable Long id) {
        return ResponseEntity.ok(quotaBorrowService.activateApplication(id));
    }

    @GetMapping("/application/{applicationNo}")
    public ResponseEntity<BorrowApplication> getApplication(@PathVariable String applicationNo) {
        return ResponseEntity.ok(quotaBorrowService.getApplication(applicationNo));
    }

    @GetMapping("/application/customer/{customerId}")
    public ResponseEntity<List<BorrowApplication>> getApplicationsByCustomer(@PathVariable String customerId) {
        return ResponseEntity.ok(quotaBorrowService.getApplicationsByCustomer(customerId));
    }

    @GetMapping("/application/{id}/approvals")
    public ResponseEntity<List<ApprovalOpinion>> getApprovalOpinions(@PathVariable Long id) {
        return ResponseEntity.ok(quotaBorrowService.getApprovalOpinions(id));
    }

    @GetMapping("/application/{id}/return-plans")
    public ResponseEntity<List<ReturnPlan>> getReturnPlans(@PathVariable Long id) {
        return ResponseEntity.ok(quotaBorrowService.getReturnPlans(id));
    }

    @PostMapping("/return")
    public ResponseEntity<ReturnPlan> processReturn(@Valid @RequestBody ReturnRequest request) {
        return ResponseEntity.ok(quotaBorrowService.processReturn(request));
    }

    @GetMapping("/application/{id}/deductions")
    public ResponseEntity<List<DeductionDetail>> getDeductionDetails(@PathVariable Long id) {
        return ResponseEntity.ok(quotaBorrowService.getDeductionDetails(id));
    }
}
