package com.aerialsurvey.controller;

import com.aerialsurvey.dto.*;
import com.aerialsurvey.entity.*;
import com.aerialsurvey.service.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/parking-slope-inspection")
public class ParkingSlopeInspectionController {

    private final ParkingSlopeInspectionService inspectionService;
    private final UnifiedInspectionResultService unifiedResultService;
    private final ConflictDetectionService conflictDetectionService;
    private final SelfCheckService selfCheckService;
    private final ExportService exportService;

    public ParkingSlopeInspectionController(ParkingSlopeInspectionService inspectionService,
                                            UnifiedInspectionResultService unifiedResultService,
                                            ConflictDetectionService conflictDetectionService,
                                            SelfCheckService selfCheckService,
                                            ExportService exportService) {
        this.inspectionService = inspectionService;
        this.unifiedResultService = unifiedResultService;
        this.conflictDetectionService = conflictDetectionService;
        this.selfCheckService = selfCheckService;
        this.exportService = exportService;
    }

    @PostMapping("/step1/import-safety-radius")
    public ResponseEntity<SafetyRadiusTable> importSafetyRadius(
            @Valid @RequestBody SafetyRadiusImportDTO dto) {
        return ResponseEntity.ok(inspectionService.importSafetyRadiusTable(dto));
    }

    @PostMapping("/step2/review-coordinate-origin")
    public ResponseEntity<CoordinateOriginSpec> reviewCoordinateOrigin(
            @Valid @RequestBody CoordinateOriginReviewDTO dto) {
        return ResponseEntity.ok(inspectionService.reviewCoordinateOrigin(dto));
    }

    @PostMapping("/step3/update-safety-report")
    public ResponseEntity<Map<String, String>> updateSafetyReport(
            @RequestParam String parkingLotCode,
            @RequestParam String operator) {
        String result = inspectionService.updateSafetyReport(parkingLotCode, operator);
        return ResponseEntity.ok(Map.of("message", result));
    }

    @PostMapping("/inspection")
    public ResponseEntity<ParkingSlopeInspection> createInspection(
            @Valid @RequestBody SlopeInspectionDTO dto) {
        return ResponseEntity.ok(inspectionService.createSlopeInspection(dto));
    }

    @PutMapping("/inspection/supplement")
    public ResponseEntity<ParkingSlopeInspection> supplementInspection(
            @Valid @RequestBody SupplementInspectionDTO dto) {
        return ResponseEntity.ok(inspectionService.supplementInspection(dto));
    }

    @PostMapping("/manager-review")
    public ResponseEntity<InspectionAlert> handleManagerReview(
            @Valid @RequestBody ManagerReviewDTO dto) {
        return ResponseEntity.ok(inspectionService.handleManagerReview(dto));
    }

    @GetMapping("/results/{parkingLotCode}")
    public ResponseEntity<List<InspectionResultDTO>> getUnifiedResults(
            @PathVariable String parkingLotCode) {
        return ResponseEntity.ok(unifiedResultService.getUnifiedResults(parkingLotCode));
    }

    @GetMapping("/results/{parkingLotCode}/pending-review")
    public ResponseEntity<List<InspectionResultDTO>> getResultsRequiringReview(
            @PathVariable String parkingLotCode) {
        return ResponseEntity.ok(unifiedResultService.getResultsRequiringManagerReview(parkingLotCode));
    }

    @GetMapping("/results/detail/{id}")
    public ResponseEntity<InspectionResultDTO> getResultById(@PathVariable Long id) {
        return ResponseEntity.ok(unifiedResultService.getUnifiedResultById(id));
    }

    @GetMapping("/conflicts/{parkingLotCode}")
    public ResponseEntity<List<ConflictDetectionDTO>> getConflicts(
            @PathVariable String parkingLotCode) {
        return ResponseEntity.ok(conflictDetectionService.getConflictsByParkingLotCode(parkingLotCode));
    }

    @GetMapping("/conflicts/{parkingLotCode}/pending")
    public ResponseEntity<List<ConflictDetectionDTO>> getPendingConflicts(
            @PathVariable String parkingLotCode) {
        return ResponseEntity.ok(conflictDetectionService.getPendingConflicts(parkingLotCode));
    }

    @PostMapping("/conflicts/detect")
    public ResponseEntity<List<ConflictDetectionDTO>> detectConflicts(
            @RequestParam String parkingLotCode,
            @RequestParam String operator) {
        return ResponseEntity.ok(conflictDetectionService.detectConflicts(parkingLotCode, operator));
    }

    @PostMapping("/conflicts/handle")
    public ResponseEntity<ConflictDetectionDTO> handleConflict(
            @Valid @RequestBody ConflictHandleDTO dto) {
        return ResponseEntity.ok(conflictDetectionService.handleConflict(dto));
    }

    @PostMapping("/self-check/duplicate-import")
    public ResponseEntity<SelfCheckRecord> checkDuplicateImport(
            @RequestParam String parkingLotCode,
            @RequestParam Double safetyRadius,
            @RequestParam String coordinateReference,
            @RequestParam String operator) {
        return ResponseEntity.ok(selfCheckService.checkDuplicateImport(
                parkingLotCode, safetyRadius, coordinateReference, operator));
    }

    @PostMapping("/self-check/screenshot-blocked")
    public ResponseEntity<SelfCheckRecord> checkScreenshotBlocked(
            @RequestParam String parkingLotCode,
            @RequestParam String operator) {
        return ResponseEntity.ok(selfCheckService.checkScreenshotBlocked(parkingLotCode, operator));
    }

    @PostMapping("/self-check/recalculation")
    public ResponseEntity<SelfCheckRecord> checkRecalculation(
            @RequestParam Long inspectionId,
            @RequestParam String operator) {
        return ResponseEntity.ok(selfCheckService.checkRecalculationAfterSupplement(inspectionId, operator));
    }

    @PostMapping("/self-check/export-consistency")
    public ResponseEntity<SelfCheckRecord> checkExportConsistency(
            @RequestParam String parkingLotCode,
            @RequestParam String operator) {
        return ResponseEntity.ok(selfCheckService.checkExportConsistency(parkingLotCode, operator));
    }

    @PostMapping("/self-check/all")
    public ResponseEntity<List<SelfCheckRecord>> runAllSelfChecks(
            @RequestParam String parkingLotCode,
            @RequestParam String operator) {
        return ResponseEntity.ok(selfCheckService.runAllSelfChecks(parkingLotCode, operator));
    }

    @GetMapping("/self-check/history/{parkingLotCode}")
    public ResponseEntity<List<SelfCheckRecord>> getSelfCheckHistory(
            @PathVariable String parkingLotCode) {
        return ResponseEntity.ok(selfCheckService.getSelfCheckHistory(parkingLotCode));
    }

    @GetMapping("/export/excel/{parkingLotCode}")
    public ResponseEntity<byte[]> exportToExcel(@PathVariable String parkingLotCode)
            throws Exception {
        byte[] excelData = exportService.exportToExcel(parkingLotCode);
        return ResponseEntity.ok()
                .header("Content-Disposition",
                        "attachment; filename=parking-slope-inspection-" + parkingLotCode + ".xlsx")
                .header("Content-Type",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .body(excelData);
    }

    @GetMapping("/export/data/{parkingLotCode}")
    public ResponseEntity<List<InspectionResultDTO>> getExportData(
            @PathVariable String parkingLotCode) {
        return ResponseEntity.ok(exportService.getExportData(parkingLotCode));
    }

    @GetMapping("/process-trace/{parkingLotCode}")
    public ResponseEntity<List<ProcessTrace>> getProcessTrace(
            @PathVariable String parkingLotCode) {
        return ResponseEntity.ok(inspectionService.getProcessTrace(parkingLotCode));
    }

    @GetMapping("/pending-reviews/{parkingLotCode}")
    public ResponseEntity<List<InspectionAlert>> getPendingManagerReviews(
            @PathVariable String parkingLotCode) {
        return ResponseEntity.ok(inspectionService.getPendingManagerReviews(parkingLotCode));
    }

    @GetMapping("/safety-radius/latest/{parkingLotCode}")
    public ResponseEntity<SafetyRadiusTable> getLatestSafetyRadius(
            @PathVariable String parkingLotCode) {
        return inspectionService.getLatestSafetyRadius(parkingLotCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/coordinate-origin/latest/{parkingLotCode}")
    public ResponseEntity<CoordinateOriginSpec> getLatestCoordinateOrigin(
            @PathVariable String parkingLotCode) {
        return inspectionService.getLatestCoordinateOrigin(parkingLotCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
