package com.floodrelief.controller;

import com.floodrelief.dto.ApiResponse;
import com.floodrelief.dto.ManualCorrectionRequest;
import com.floodrelief.dto.TransferRecordRequest;
import com.floodrelief.entity.TransferRecord;
import com.floodrelief.service.TransferRecordService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/transfer-records")
public class TransferRecordController {
    private final TransferRecordService transferRecordService;

    public TransferRecordController(TransferRecordService transferRecordService) {
        this.transferRecordService = transferRecordService;
    }

    @GetMapping("/shelter/{shelterId}")
    public ApiResponse<List<TransferRecord>> getTransferRecords(@PathVariable Long shelterId) {
        return transferRecordService.getTransferRecords(shelterId);
    }

    @GetMapping("/shelter/{shelterId}/latest")
    public ApiResponse<TransferRecord> getLatestTransferRecord(@PathVariable Long shelterId) {
        return transferRecordService.getLatestTransferRecord(shelterId);
    }

    @PostMapping
    public ApiResponse<TransferRecord> createTransferRecord(@Valid @RequestBody TransferRecordRequest request) {
        return transferRecordService.createTransferRecord(request);
    }

    @PostMapping("/{id}/correct")
    public ApiResponse<TransferRecord> manualCorrectTransfer(
            @PathVariable Long id,
            @RequestBody ManualCorrectionRequest request) {
        return transferRecordService.manualCorrectTransfer(id, request);
    }
}
