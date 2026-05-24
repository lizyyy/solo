package com.pottery.kilnqueue.controller;

import com.pottery.kilnqueue.dto.*;
import com.pottery.kilnqueue.enums.QueueStatus;
import com.pottery.kilnqueue.service.QueueService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/queue")
public class QueueController {

    private final QueueService queueService;

    public QueueController(QueueService queueService) {
        this.queueService = queueService;
    }

    @PostMapping("/submit")
    public ResponseEntity<QueueResponseDTO> submitToQueue(@Valid @RequestBody QueueRequestDTO request) {
        return ResponseEntity.ok(queueService.submitToQueue(request));
    }

    @GetMapping("/{requestId}")
    public ResponseEntity<QueueResponseDTO> getByRequestId(@PathVariable String requestId) {
        return ResponseEntity.ok(queueService.getByRequestId(requestId));
    }

    @GetMapping
    public ResponseEntity<List<QueueResponseDTO>> getQueueList(
            @RequestParam(required = false) QueueStatus status) {
        return ResponseEntity.ok(queueService.getQueueList(status));
    }

    @PostMapping("/reschedule")
    public ResponseEntity<QueueResponseDTO> reschedule(@Valid @RequestBody RescheduleRequestDTO request) {
        return ResponseEntity.ok(queueService.reschedule(request));
    }

    @PostMapping("/supplement")
    public ResponseEntity<QueueResponseDTO> supplement(@Valid @RequestBody SupplementRequestDTO request) {
        return ResponseEntity.ok(queueService.supplement(request));
    }

    @PostMapping("/decision")
    public ResponseEntity<QueueResponseDTO> makeDecision(@Valid @RequestBody DecisionRequestDTO request) {
        return ResponseEntity.ok(queueService.makeDecision(request));
    }
}
