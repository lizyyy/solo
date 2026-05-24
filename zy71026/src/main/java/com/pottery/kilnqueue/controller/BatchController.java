package com.pottery.kilnqueue.controller;

import com.pottery.kilnqueue.dto.BatchAssignDTO;
import com.pottery.kilnqueue.dto.BatchDTO;
import com.pottery.kilnqueue.enums.BatchStatus;
import com.pottery.kilnqueue.service.BatchService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/batches")
public class BatchController {

    private final BatchService batchService;

    public BatchController(BatchService batchService) {
        this.batchService = batchService;
    }

    @GetMapping
    public ResponseEntity<List<BatchDTO>> getAllBatches(
            @RequestParam(required = false) BatchStatus status) {
        return ResponseEntity.ok(batchService.getAllBatches(status));
    }

    @GetMapping("/{batchNo}")
    public ResponseEntity<BatchDTO> getByBatchNo(@PathVariable String batchNo) {
        return ResponseEntity.ok(batchService.getByBatchNo(batchNo));
    }

    @PostMapping
    public ResponseEntity<BatchDTO> createBatch(@Valid @RequestBody BatchDTO dto) {
        return ResponseEntity.ok(batchService.createBatch(dto));
    }

    @PostMapping("/{batchNo}/lock")
    public ResponseEntity<BatchDTO> lockBatch(
            @PathVariable String batchNo,
            @RequestBody(required = false) Map<String, String> body) {
        String operator = body != null ? body.get("operator") : null;
        return ResponseEntity.ok(batchService.lockBatch(batchNo, operator));
    }

    @PostMapping("/{batchNo}/unlock")
    public ResponseEntity<BatchDTO> unlockBatch(
            @PathVariable String batchNo,
            @RequestBody(required = false) Map<String, String> body) {
        String operator = body != null ? body.get("operator") : null;
        return ResponseEntity.ok(batchService.unlockBatch(batchNo, operator));
    }

    @PostMapping("/assign")
    public ResponseEntity<BatchDTO> assignWorks(@Valid @RequestBody BatchAssignDTO dto) {
        return ResponseEntity.ok(batchService.assignWorks(dto));
    }

    @DeleteMapping("/{batchNo}/works/{requestId}")
    public ResponseEntity<BatchDTO> removeWorkFromBatch(
            @PathVariable String batchNo,
            @PathVariable String requestId,
            @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(batchService.removeWorkFromBatch(batchNo, requestId, operator));
    }

    @PostMapping("/{batchNo}/start")
    public ResponseEntity<BatchDTO> startFiring(@PathVariable String batchNo) {
        return ResponseEntity.ok(batchService.startFiring(batchNo));
    }

    @PostMapping("/{batchNo}/complete")
    public ResponseEntity<BatchDTO> completeFiring(@PathVariable String batchNo) {
        return ResponseEntity.ok(batchService.completeFiring(batchNo));
    }
}
