package com.ortho.rework.controller;

import com.ortho.rework.dto.*;
import com.ortho.rework.entity.ReworkReport;
import com.ortho.rework.enums.ReworkStatus;
import com.ortho.rework.service.ReworkService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/rework")
@RequiredArgsConstructor
public class ReworkController {
    private final ReworkService reworkService;

    @PostMapping("/create")
    public ApiResponse<ReworkDetailDTO> create(@Valid @RequestBody CreateReworkRequest request) {
        return reworkService.createRework(request);
    }

    @PostMapping("/receive")
    public ApiResponse<ReworkDetailDTO> receive(@Valid @RequestBody ReceiveRequest request) {
        return reworkService.receive(request);
    }

    @PostMapping("/inspect")
    public ApiResponse<ReworkDetailDTO> inspect(@Valid @RequestBody InspectionRequest request) {
        return reworkService.inspect(request);
    }

    @PostMapping("/technician-note")
    public ApiResponse<ReworkDetailDTO> technicianNote(@Valid @RequestBody TechnicianNoteRequest request) {
        return reworkService.addTechnicianNote(request);
    }

    @PostMapping("/doctor-confirm")
    public ApiResponse<ReworkDetailDTO> doctorConfirm(@Valid @RequestBody DoctorConfirmRequest request) {
        return reworkService.doctorConfirm(request);
    }

    @PostMapping("/review")
    public ApiResponse<ReworkDetailDTO> review(@Valid @RequestBody ReviewRequest request) {
        return reworkService.review(request);
    }

    @PostMapping("/ship")
    public ApiResponse<ReworkDetailDTO> ship(@Valid @RequestBody ShipRequest request) {
        return reworkService.ship(request);
    }

    @PostMapping("/close")
    public ApiResponse<ReworkDetailDTO> close(@Valid @RequestBody CloseRequest request) {
        return reworkService.close(request);
    }

    @PostMapping("/mark-lost")
    public ApiResponse<ReworkDetailDTO> markLost(@Valid @RequestBody MarkLostRequest request) {
        return reworkService.markLost(request);
    }

    @GetMapping("/{reworkNo}")
    public ApiResponse<ReworkDetailDTO> getDetail(@PathVariable String reworkNo) {
        return reworkService.getReworkDetail(reworkNo);
    }

    @GetMapping("/list")
    public ApiResponse<List<ReworkDetailDTO>> list(@RequestParam(required = false) ReworkStatus status) {
        return reworkService.listReworks(status);
    }

    @PostMapping("/export/{reworkNo}")
    public ApiResponse<ReworkReport> export(@PathVariable String reworkNo) {
        return reworkService.exportReport(reworkNo);
    }
}
