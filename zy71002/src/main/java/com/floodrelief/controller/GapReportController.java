package com.floodrelief.controller;

import com.floodrelief.dto.ApiResponse;
import com.floodrelief.dto.GapCalculationRequest;
import com.floodrelief.dto.GapReportDTO;
import com.floodrelief.dto.ShelterAllocationSummary;
import com.floodrelief.service.GapCalculationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/gap-reports")
@RequiredArgsConstructor
public class GapReportController {
    private final GapCalculationService gapCalculationService;

    @PostMapping("/calculate")
    public ApiResponse<List<GapReportDTO>> calculateGap(@RequestBody GapCalculationRequest request) {
        return gapCalculationService.calculateGap(request);
    }

    @GetMapping
    public ApiResponse<List<GapReportDTO>> getAllGapReports() {
        return gapCalculationService.getAllGapReports();
    }

    @GetMapping("/shelter/{shelterId}/summary")
    public ApiResponse<ShelterAllocationSummary> getShelterSummary(@PathVariable Long shelterId) {
        return gapCalculationService.getShelterSummary(shelterId);
    }

    @PostMapping
    public ApiResponse<GapReportDTO> saveGapReport(@RequestBody GapReportDTO dto) {
        return gapCalculationService.saveGapReport(dto);
    }
}
