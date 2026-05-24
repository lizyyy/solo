package com.ortho.rework.controller;

import com.ortho.rework.dto.*;
import com.ortho.rework.service.ReworkService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rework")
public class ReworkController {

    @Autowired
    private ReworkService reworkService;

    @PostMapping
    public ApiResponse<ReworkDetailDTO> createReworkOrder(@Valid @RequestBody CreateReworkRequest request) {
        return ApiResponse.success(reworkService.createReworkOrder(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<ReworkDetailDTO> getReworkOrder(@PathVariable Long id) {
        return ApiResponse.success(reworkService.getReworkOrder(id));
    }

    @GetMapping
    public ApiResponse<List<ReworkDetailDTO>> getAllReworkOrders() {
        return ApiResponse.success(reworkService.getAllReworkOrders());
    }

    @PostMapping("/{id}/review")
    public ApiResponse<ReworkDetailDTO> startReview(@PathVariable Long id, @RequestBody ReviewRequest request) {
        return ApiResponse.success(reworkService.startReview(id, request));
    }

    @PostMapping("/{id}/technician-note")
    public ApiResponse<ReworkDetailDTO> addTechnicianNote(@PathVariable Long id, @RequestBody TechnicianNoteRequest request) {
        return ApiResponse.success(reworkService.addTechnicianNote(id, request));
    }

    @PostMapping("/{id}/doctor-confirm")
    public ApiResponse<ReworkDetailDTO> doctorConfirm(@PathVariable Long id, @RequestBody DoctorConfirmRequest request) {
        return ApiResponse.success(reworkService.doctorConfirm(id, request));
    }

    @PostMapping("/{id}/ship")
    public ApiResponse<ReworkDetailDTO> ship(@PathVariable Long id, @Valid @RequestBody ShipRequest request) {
        return ApiResponse.success(reworkService.ship(id, request));
    }

    @PostMapping("/{id}/receive")
    public ApiResponse<ReworkDetailDTO> receive(@PathVariable Long id, @RequestBody ReceiveRequest request) {
        return ApiResponse.success(reworkService.receive(id, request));
    }

    @PostMapping("/{id}/inspect")
    public ApiResponse<ReworkDetailDTO> inspect(@PathVariable Long id, @RequestBody InspectionRequest request) {
        return ApiResponse.success(reworkService.inspect(id, request));
    }

    @PostMapping("/{id}/close")
    public ApiResponse<ReworkDetailDTO> close(@PathVariable Long id, @RequestBody CloseRequest request) {
        return ApiResponse.success(reworkService.close(id, request));
    }

    @PostMapping("/{id}/mark-lost")
    public ApiResponse<ReworkDetailDTO> markLost(@PathVariable Long id, @RequestBody MarkLostRequest request) {
        return ApiResponse.success(reworkService.markLost(id, request));
    }
}
