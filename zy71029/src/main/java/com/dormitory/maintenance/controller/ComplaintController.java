package com.dormitory.maintenance.controller;

import com.dormitory.maintenance.entity.Complaint;
import com.dormitory.maintenance.enums.ComplaintStatus;
import com.dormitory.maintenance.service.ComplaintService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/complaints")
public class ComplaintController {

    @Autowired
    private ComplaintService complaintService;

    @PostMapping
    public ResponseEntity<Complaint> createComplaint(@RequestBody Complaint complaint) {
        return ResponseEntity.ok(complaintService.createComplaint(complaint));
    }

    @PutMapping("/{complaintId}/handle")
    public ResponseEntity<Complaint> handleComplaint(
            @PathVariable Long complaintId,
            @RequestParam String handler,
            @RequestParam String handleResult,
            @RequestParam ComplaintStatus status) {
        return ResponseEntity.ok(complaintService.handleComplaint(complaintId, handler, handleResult, status));
    }

    @PostMapping("/{complaintId}/link/{orderNo}")
    public ResponseEntity<Complaint> linkToOrder(
            @PathVariable Long complaintId,
            @PathVariable String orderNo) {
        return ResponseEntity.ok(complaintService.linkToOrder(complaintId, orderNo));
    }

    @GetMapping("/{complaintId}")
    public ResponseEntity<Complaint> getComplaint(@PathVariable Long complaintId) {
        return ResponseEntity.ok(complaintService.getComplaint(complaintId));
    }

    @GetMapping("/no/{complaintNo}")
    public ResponseEntity<Complaint> getComplaintByNo(@PathVariable String complaintNo) {
        return ResponseEntity.ok(complaintService.getComplaintByNo(complaintNo));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<Complaint>> getComplaintsByOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(complaintService.getComplaintsByOrder(orderId));
    }

    @GetMapping("/order-no/{orderNo}")
    public ResponseEntity<List<Complaint>> getComplaintsByOrderNo(@PathVariable String orderNo) {
        return ResponseEntity.ok(complaintService.getComplaintsByOrderNo(orderNo));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<Complaint>> getComplaintsByStatus(@PathVariable ComplaintStatus status) {
        return ResponseEntity.ok(complaintService.getComplaintsByStatus(status));
    }

    @GetMapping("/building/{buildingId}")
    public ResponseEntity<List<Complaint>> getComplaintsByBuilding(@PathVariable Long buildingId) {
        return ResponseEntity.ok(complaintService.getComplaintsByBuilding(buildingId));
    }

    @GetMapping
    public ResponseEntity<List<Complaint>> getAllComplaints() {
        return ResponseEntity.ok(complaintService.getAllComplaints());
    }
}
