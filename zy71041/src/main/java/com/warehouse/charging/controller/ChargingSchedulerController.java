package com.warehouse.charging.controller;

import com.warehouse.charging.dto.ApiResponse;
import com.warehouse.charging.dto.ChargingRequestDTO;
import com.warehouse.charging.model.ChargingReservation;
import com.warehouse.charging.model.ChargingStation;
import com.warehouse.charging.model.Robot;
import com.warehouse.charging.model.ScheduleLog;
import com.warehouse.charging.repository.ChargingStationRepository;
import com.warehouse.charging.repository.RobotRepository;
import com.warehouse.charging.service.ChargingSchedulerService;
import com.warehouse.charging.service.ReportService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/charging")
public class ChargingSchedulerController {

    private final ChargingSchedulerService schedulerService;
    private final ReportService reportService;
    private final ChargingStationRepository stationRepository;
    private final RobotRepository robotRepository;

    public ChargingSchedulerController(ChargingSchedulerService schedulerService,
                                       ReportService reportService,
                                       ChargingStationRepository stationRepository,
                                       RobotRepository robotRepository) {
        this.schedulerService = schedulerService;
        this.reportService = reportService;
        this.stationRepository = stationRepository;
        this.robotRepository = robotRepository;
    }

    @PostMapping("/reserve")
    public ApiResponse<ChargingReservation> createReservation(@Valid @RequestBody ChargingRequestDTO request) {
        Optional<ChargingReservation> existing = schedulerService.findByRequestId(request.getRequestId());
        if (existing.isPresent()) {
            ChargingReservation reservation = existing.get();
            ApiResponse<ChargingReservation> response = ApiResponse.conflict(
                    "重复请求，返回已有记录",
                    reservation
            );
            response.setRequestId(request.getRequestId());
            return response;
        }

        ChargingReservation reservation = schedulerService.createReservation(request);
        ApiResponse<ChargingReservation> response = ApiResponse.success("预约创建成功", reservation);
        response.setRequestId(request.getRequestId());
        return response;
    }

    @GetMapping("/reservation/{requestId}")
    public ApiResponse<ChargingReservation> getReservation(@PathVariable String requestId) {
        return schedulerService.findByRequestId(requestId)
                .map(reservation -> {
                    ApiResponse<ChargingReservation> response = ApiResponse.success(reservation);
                    response.setRequestId(requestId);
                    return response;
                })
                .orElseGet(() -> {
                    ApiResponse<ChargingReservation> response = ApiResponse.error(404, "预约记录不存在");
                    response.setRequestId(requestId);
                    return response;
                });
    }

    @PostMapping("/reservation/{id}/start")
    public ApiResponse<ChargingReservation> startCharging(@PathVariable Long id) {
        ChargingReservation reservation = schedulerService.startCharging(id);
        return ApiResponse.success("开始充电", reservation);
    }

    @PostMapping("/reservation/{id}/complete")
    public ApiResponse<ChargingReservation> completeCharging(@PathVariable Long id) {
        ChargingReservation reservation = schedulerService.completeCharging(id);
        return ApiResponse.success("充电完成", reservation);
    }

    @PostMapping("/reservation/{id}/cancel")
    public ApiResponse<ChargingReservation> cancelReservation(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String reason = body.getOrDefault("reason", "用户取消");
        String operator = body.getOrDefault("operator", "SYSTEM");
        ChargingReservation reservation = schedulerService.cancelReservation(id, reason, operator);
        return ApiResponse.success("取消成功", reservation);
    }

    @GetMapping("/reservations/active")
    public ApiResponse<List<ChargingReservation>> getActiveReservations() {
        return ApiResponse.success(schedulerService.findActiveReservations());
    }

    @GetMapping("/logs/{requestId}")
    public ApiResponse<List<ScheduleLog>> getLogsByRequestId(@PathVariable String requestId) {
        return ApiResponse.success(reportService.getLogsByRequestId(requestId));
    }

    @GetMapping("/stations")
    public ApiResponse<List<ChargingStation>> getAllStations() {
        return ApiResponse.success(stationRepository.findAll());
    }

    @GetMapping("/robots")
    public ApiResponse<List<Robot>> getAllRobots() {
        return ApiResponse.success(robotRepository.findAll());
    }
}
