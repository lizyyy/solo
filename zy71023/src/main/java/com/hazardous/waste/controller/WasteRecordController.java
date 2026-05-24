package com.hazardous.waste.controller;

import com.hazardous.waste.dto.ApiResponse;
import com.hazardous.waste.dto.ReviewDTO;
import com.hazardous.waste.dto.WasteRecordDTO;
import com.hazardous.waste.entity.WasteRecord;
import com.hazardous.waste.enums.WasteStatus;
import com.hazardous.waste.service.WasteRecordService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/waste-records")
public class WasteRecordController {

    private final WasteRecordService wasteRecordService;

    public WasteRecordController(WasteRecordService wasteRecordService) {
        this.wasteRecordService = wasteRecordService;
    }

    @PostMapping("/submit")
    public ApiResponse<WasteRecord> submitRecord(@Valid @RequestBody WasteRecordDTO dto) {
        return ApiResponse.success(wasteRecordService.submitRecord(dto));
    }

    @PostMapping("/review")
    public ApiResponse<WasteRecord> reviewRecord(@Valid @RequestBody ReviewDTO dto) {
        return ApiResponse.success(wasteRecordService.reviewRecord(dto));
    }

    @PostMapping("/resubmit")
    public ApiResponse<WasteRecord> resubmitRecord(@Valid @RequestBody WasteRecordDTO dto) {
        return ApiResponse.success(wasteRecordService.resubmitRecord(dto));
    }

    @PostMapping("/assign-bucket")
    public ApiResponse<WasteRecord> assignBucket(
            @RequestParam String recordNo,
            @RequestParam String bucketCode,
            @RequestParam(defaultValue = "SYSTEM") String operator) {
        return ApiResponse.success(wasteRecordService.assignBucket(recordNo, bucketCode, operator));
    }

    @PostMapping("/mark-transfer")
    public ApiResponse<WasteRecord> markForTransfer(
            @RequestParam String recordNo,
            @RequestParam String transferFormNo,
            @RequestParam(defaultValue = "SYSTEM") String operator) {
        return ApiResponse.success(wasteRecordService.markForTransfer(recordNo, transferFormNo, operator));
    }

    @PostMapping("/confirm-transfer")
    public ApiResponse<WasteRecord> confirmTransfer(
            @RequestParam String recordNo,
            @RequestParam String receiver,
            @RequestParam(defaultValue = "SYSTEM") String operator) {
        return ApiResponse.success(wasteRecordService.confirmTransfer(recordNo, receiver, operator));
    }

    @PostMapping("/confirm-disposal")
    public ApiResponse<WasteRecord> confirmDisposal(
            @RequestParam String recordNo,
            @RequestParam String disposalResult,
            @RequestParam(defaultValue = "SYSTEM") String operator) {
        return ApiResponse.success(wasteRecordService.confirmDisposal(recordNo, disposalResult, operator));
    }

    @PostMapping("/return")
    public ApiResponse<WasteRecord> returnRecord(
            @RequestParam String recordNo,
            @RequestParam String returnReason,
            @RequestParam(defaultValue = "SYSTEM") String operator) {
        return ApiResponse.success(wasteRecordService.returnRecord(recordNo, returnReason, operator));
    }

    @PostMapping("/recalculate")
    public ApiResponse<WasteRecord> recalculateStatus(
            @RequestParam String recordNo,
            @RequestParam(defaultValue = "SYSTEM") String operator) {
        return ApiResponse.success(wasteRecordService.recalculateStatus(recordNo, operator));
    }

    @GetMapping("/{recordNo}")
    public ApiResponse<WasteRecord> getRecord(@PathVariable String recordNo) {
        return ApiResponse.success(wasteRecordService.getRecord(recordNo));
    }

    @GetMapping
    public ApiResponse<List<WasteRecord>> getAllRecords() {
        return ApiResponse.success(wasteRecordService.getAllRecords());
    }

    @GetMapping("/status/{status}")
    public ApiResponse<List<WasteRecord>> getRecordsByStatus(@PathVariable WasteStatus status) {
        return ApiResponse.success(wasteRecordService.getRecordsByStatus(status));
    }

    @GetMapping("/check/{recordNo}")
    public ApiResponse<Map<String, Object>> checkRecord(@PathVariable String recordNo) {
        WasteRecord record = wasteRecordService.getRecord(recordNo);
        return ApiResponse.success(Map.of(
                "recordNo", record.getRecordNo(),
                "status", record.getStatus(),
                "isOverdue", record.getIsOverdue(),
                "storageDays", record.getStorageDays(),
                "disposalReason", record.getDisposalReason(),
                "checkResult", record.getCheckResult()
        ));
    }
}
