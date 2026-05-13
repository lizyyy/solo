package com.example.readonlywindow.controller;

import com.example.readonlywindow.dto.ApproveRequest;
import com.example.readonlywindow.dto.CreateWriteRequest;
import com.example.readonlywindow.dto.RejectRequest;
import com.example.readonlywindow.entity.WriteRequest;
import com.example.readonlywindow.service.WriteRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/requests")
@RequiredArgsConstructor
public class WriteRequestController {
    private final WriteRequestService requestService;

    @PostMapping
    public ResponseEntity<WriteRequest> createRequest(@Valid @RequestBody CreateWriteRequest request) {
        return ResponseEntity.ok(requestService.createRequest(request));
    }

    @PostMapping("/approve")
    public ResponseEntity<WriteRequest> approveRequest(@Valid @RequestBody ApproveRequest request) {
        return ResponseEntity.ok(requestService.approveRequest(request));
    }

    @PostMapping("/reject")
    public ResponseEntity<WriteRequest> rejectRequest(@Valid @RequestBody RejectRequest request) {
        return ResponseEntity.ok(requestService.rejectRequest(request));
    }

    @GetMapping("/{requestCode}")
    public ResponseEntity<WriteRequest> getRequest(@PathVariable String requestCode) {
        return ResponseEntity.ok(requestService.getRequestByCode(requestCode));
    }

    @GetMapping("/window/{windowCode}")
    public ResponseEntity<List<WriteRequest>> getRequestsByWindow(@PathVariable String windowCode) {
        return ResponseEntity.ok(requestService.getRequestsByWindow(windowCode));
    }

    @GetMapping("/window/{windowCode}/pending")
    public ResponseEntity<List<WriteRequest>> getPendingRequestsByWindow(@PathVariable String windowCode) {
        return ResponseEntity.ok(requestService.getPendingRequestsByWindow(windowCode));
    }

    @GetMapping
    public ResponseEntity<List<WriteRequest>> getAllRequests() {
        return ResponseEntity.ok(requestService.getAllRequests());
    }
}
