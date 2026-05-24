package com.floodrelief.controller;

import com.floodrelief.dto.*;
import com.floodrelief.entity.AllocationEvidence;
import com.floodrelief.entity.AllocationRecord;
import com.floodrelief.service.AllocationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/allocations")
public class AllocationController {
    private final AllocationService allocationService;

    public AllocationController(AllocationService allocationService) {
        this.allocationService = allocationService;
    }

    @PostMapping
    public ApiResponse<AllocationRecord> createAllocation(@Valid @RequestBody AllocationRequest request) {
        return allocationService.createAllocation(request);
    }

    @GetMapping("/{id}")
    public ApiResponse<AllocationRecord> getAllocationById(@PathVariable Long id) {
        return allocationService.getAllocationById(id);
    }

    @GetMapping("/shelter/{shelterId}")
    public ApiResponse<List<AllocationRecord>> getAllocationsByShelter(@PathVariable Long shelterId) {
        return allocationService.getAllocationsByShelter(shelterId);
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<AllocationRecord> approveAllocation(
            @PathVariable Long id,
            @RequestBody AllocationApprovalRequest request) {
        return allocationService.approveAllocation(id, request);
    }

    @PostMapping("/{id}/dispatch")
    public ApiResponse<AllocationRecord> dispatchAllocation(
            @PathVariable Long id,
            @RequestBody AllocationDispatchRequest request) {
        return allocationService.dispatchAllocation(id, request);
    }

    @PostMapping("/{id}/receive")
    public ApiResponse<AllocationRecord> receiveAllocation(
            @PathVariable Long id,
            @Valid @RequestBody AllocationReceiveRequest request) {
        return allocationService.receiveAllocation(id, request);
    }

    @PostMapping("/{id}/withdraw")
    public ApiResponse<AllocationRecord> withdrawAllocation(
            @PathVariable Long id,
            @RequestBody AllocationWithdrawRequest request) {
        return allocationService.withdrawAllocation(id, request);
    }

    @PostMapping("/{id}/correct")
    public ApiResponse<AllocationRecord> manualCorrectAllocation(
            @PathVariable Long id,
            @RequestBody ManualCorrectionRequest request) {
        return allocationService.manualCorrectAllocation(id, request);
    }

    @PostMapping("/evidence")
    public ApiResponse<AllocationEvidence> addEvidence(@Valid @RequestBody EvidenceUploadRequest request) {
        return allocationService.addEvidence(request);
    }

    @GetMapping("/{id}/evidences")
    public ApiResponse<List<AllocationEvidence>> getEvidencesByAllocation(@PathVariable Long id) {
        return allocationService.getEvidencesByAllocation(id);
    }
}
