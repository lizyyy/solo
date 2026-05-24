package com.hospital.oxygen.controller;

import com.hospital.oxygen.common.ApiResponse;
import com.hospital.oxygen.dto.OverrideRequest;
import com.hospital.oxygen.dto.TransferRequestDto;
import com.hospital.oxygen.entity.TransferRequest;
import com.hospital.oxygen.enums.TransferStatus;
import com.hospital.oxygen.service.TransferService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transfers")
public class TransferController {

    private final TransferService transferService;

    public TransferController(TransferService transferService) {
        this.transferService = transferService;
    }

    @PostMapping
    public ApiResponse<TransferRequest> createTransfer(@RequestBody TransferRequestDto request) {
        return ApiResponse.success("转科申请创建成功", transferService.createTransfer(request));
    }

    @GetMapping("/{transferNumber}")
    public ApiResponse<TransferRequest> getTransfer(@PathVariable String transferNumber) {
        return ApiResponse.success(transferService.getTransfer(transferNumber));
    }

    @GetMapping
    public ApiResponse<List<TransferRequest>> getAllTransfers() {
        return ApiResponse.success(transferService.getAllTransfers());
    }

    @GetMapping("/unreleased")
    public ApiResponse<List<TransferRequest>> getUnreleasedTransfers() {
        return ApiResponse.success(transferService.getUnreleasedTransfers());
    }

    @GetMapping("/patient/{patientId}")
    public ApiResponse<List<TransferRequest>> getTransfersByPatient(@PathVariable String patientId) {
        return ApiResponse.success(transferService.getTransfersByPatient(patientId));
    }

    @PostMapping("/{transferNumber}/approve")
    public ApiResponse<TransferRequest> approveTransfer(@PathVariable String transferNumber, @RequestParam(required = false) String operator) {
        return ApiResponse.success("审批通过", transferService.approveTransfer(transferNumber, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/{transferNumber}/start")
    public ApiResponse<TransferRequest> startTransfer(@PathVariable String transferNumber, @RequestParam(required = false) String operator) {
        return ApiResponse.success("开始转运", transferService.startTransfer(transferNumber, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/{transferNumber}/complete")
    public ApiResponse<TransferRequest> completeTransfer(
            @PathVariable String transferNumber,
            @RequestParam(defaultValue = "false") boolean releaseResources,
            @RequestParam(required = false) String operator) {
        return ApiResponse.success("转科完成", transferService.completeTransfer(transferNumber, releaseResources, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/{transferNumber}/release")
    public ApiResponse<TransferRequest> releaseResources(@PathVariable String transferNumber, @RequestParam(required = false) String operator) {
        return ApiResponse.success("资源已释放", transferService.releaseTransferResources(transferNumber, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/{transferNumber}/override")
    public ApiResponse<TransferRequest> overrideTransfer(@PathVariable String transferNumber, @RequestBody OverrideRequest request) {
        TransferStatus newStatus = request.getNewStatus() != null ? TransferStatus.valueOf(request.getNewStatus()) : TransferStatus.COMPLETED;
        return ApiResponse.success("人工改判完成", transferService.overrideTransfer(transferNumber, request.getReason(), request.getOperator(), newStatus));
    }
}
