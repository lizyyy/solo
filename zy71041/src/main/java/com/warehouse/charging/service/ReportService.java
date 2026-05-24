package com.warehouse.charging.service;

import com.warehouse.charging.dto.ScheduleReportDTO;
import com.warehouse.charging.enums.ReservationStatus;
import com.warehouse.charging.model.ChargingReservation;
import com.warehouse.charging.model.ScheduleLog;
import com.warehouse.charging.repository.ChargingReservationRepository;
import com.warehouse.charging.repository.ScheduleLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    private final ChargingReservationRepository reservationRepository;
    private final ScheduleLogRepository logRepository;

    public ReportService(ChargingReservationRepository reservationRepository,
                         ScheduleLogRepository logRepository) {
        this.reservationRepository = reservationRepository;
        this.logRepository = logRepository;
    }

    public ScheduleReportDTO generateReport(LocalDateTime startTime, LocalDateTime endTime) {
        List<ChargingReservation> reservations = reservationRepository.findByTimeRange(startTime, endTime);

        ScheduleReportDTO report = new ScheduleReportDTO();
        report.setReportStartTime(startTime);
        report.setReportEndTime(endTime);
        report.setGeneratedAt(LocalDateTime.now());

        report.setTotalRequests(reservations.size());
        report.setConfirmedCount(countByStatus(reservations, ReservationStatus.CONFIRMED));
        report.setPendingCount(countByStatus(reservations, ReservationStatus.PENDING));
        report.setCompletedCount(countByStatus(reservations, ReservationStatus.COMPLETED));
        report.setCancelledCount(countByStatus(reservations, ReservationStatus.CANCELLED));
        report.setPreemptedCount(countByStatus(reservations, ReservationStatus.PREEMPTED));

        report.setStationUsage(reservations.stream()
                .collect(Collectors.groupingBy(ChargingReservation::getStationCode, Collectors.counting())));

        report.setRobotChargingCount(reservations.stream()
                .collect(Collectors.groupingBy(ChargingReservation::getRobotCode, Collectors.counting())));

        report.setPriorityDistribution(reservations.stream()
                .collect(Collectors.groupingBy(r -> r.getPriority().name(), Collectors.counting())));

        calculateAverages(report, reservations);

        report.setKeyInsights(generateInsights(report, reservations));

        report.setReservationSummaries(reservations.stream()
                .sorted(Comparator.comparing(ChargingReservation::getCreatedAt).reversed())
                .map(this::toSummary)
                .collect(Collectors.toList()));

        return report;
    }

    public byte[] exportReportAsCsv(LocalDateTime startTime, LocalDateTime endTime) {
        ScheduleReportDTO report = generateReport(startTime, endTime);

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {

            writer.println('\ufeff' + "请求ID,机器人编码,充电位编码,优先级,电量,状态,应用规则,创建时间,完成时间");

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            for (ScheduleReportDTO.ReservationSummary summary : report.getReservationSummaries()) {
                writer.println(String.join(",",
                        summary.getRequestId(),
                        summary.getRobotCode(),
                        summary.getStationCode(),
                        summary.getPriority(),
                        String.valueOf(summary.getBatteryLevel()),
                        summary.getStatus(),
                        summary.getRuleApplied() != null ? summary.getRuleApplied() : "",
                        summary.getCreatedAt() != null ? summary.getCreatedAt().format(formatter) : "",
                        summary.getCompletedAt() != null ? summary.getCompletedAt().format(formatter) : ""
                ));
            }

            writer.println();
            writer.println("统计汇总");
            writer.println("总请求数," + report.getTotalRequests());
            writer.println("已确认," + report.getConfirmedCount());
            writer.println("等待中," + report.getPendingCount());
            writer.println("已完成," + report.getCompletedCount());
            writer.println("已取消," + report.getCancelledCount());
            writer.println("被抢占," + report.getPreemptedCount());
            writer.println("平均等待时间(分钟)," + String.format("%.2f", report.getAvgWaitingTimeMinutes()));
            writer.println("平均充电时间(分钟)," + String.format("%.2f", report.getAvgChargingTimeMinutes()));
            writer.println("抢占率," + String.format("%.2f%%", report.getPreemptionRate() * 100));

            writer.flush();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("导出CSV失败", e);
            throw new RuntimeException("导出CSV失败", e);
        }
    }

    public List<ScheduleLog> getLogsByRequestId(String requestId) {
        return logRepository.findByRequestIdOrderByCreatedAtDesc(requestId);
    }

    public List<ScheduleLog> getLogsByReservationId(Long reservationId) {
        return logRepository.findByReservationIdOrderByCreatedAtDesc(reservationId);
    }

    private long countByStatus(List<ChargingReservation> reservations, ReservationStatus status) {
        return reservations.stream().filter(r -> r.getStatus() == status).count();
    }

    private void calculateAverages(ScheduleReportDTO report, List<ChargingReservation> reservations) {
        List<ChargingReservation> completed = reservations.stream()
                .filter(r -> r.getStatus() == ReservationStatus.COMPLETED)
                .collect(Collectors.toList());

        if (!completed.isEmpty()) {
            double totalChargingTime = completed.stream()
                    .filter(r -> r.getActualStartTime() != null && r.getActualEndTime() != null)
                    .mapToDouble(r -> Duration.between(r.getActualStartTime(), r.getActualEndTime()).toMinutes())
                    .average().orElse(0);
            report.setAvgChargingTimeMinutes(totalChargingTime);

            double totalWaitingTime = completed.stream()
                    .filter(r -> r.getEstimatedChargingStartTime() != null && r.getActualStartTime() != null)
                    .mapToDouble(r -> Duration.between(r.getEstimatedChargingStartTime(), r.getActualStartTime()).toMinutes())
                    .average().orElse(0);
            report.setAvgWaitingTimeMinutes(totalWaitingTime);
        }

        if (report.getTotalRequests() > 0) {
            report.setPreemptionRate((double) report.getPreemptedCount() / report.getTotalRequests());
        }
    }

    private List<String> generateInsights(ScheduleReportDTO report, List<ChargingReservation> reservations) {
        List<String> insights = new ArrayList<>();

        if (report.getPreemptionRate() > 0.3) {
            insights.add(String.format("高抢占风险: 当前抢占率为%.2f%%，建议增加充电位或优化调度策略", report.getPreemptionRate() * 100));
        }

        Optional<Map.Entry<String, Long>> mostUsedStation = report.getStationUsage().entrySet().stream()
                .max(Map.Entry.comparingByValue());
        mostUsedStation.ifPresent(entry -> insights.add("最繁忙充电位: " + entry.getKey() + " 共使用" + entry.getValue() + "次"));

        long lowBatteryCount = reservations.stream().filter(r -> r.getBatteryLevel() <= 20).count();
        if (lowBatteryCount > 0) {
            insights.add("低电量请求数: " + lowBatteryCount + " 次，占比 " + String.format("%.2f%%", (double) lowBatteryCount / reservations.size() * 100));
        }

        return insights;
    }

    private ScheduleReportDTO.ReservationSummary toSummary(ChargingReservation r) {
        ScheduleReportDTO.ReservationSummary s = new ScheduleReportDTO.ReservationSummary();
        s.setRequestId(r.getRequestId());
        s.setRobotCode(r.getRobotCode());
        s.setStationCode(r.getStationCode());
        s.setPriority(r.getPriority().name());
        s.setBatteryLevel(r.getBatteryLevel());
        s.setStatus(r.getStatus().name());
        s.setRuleApplied(r.getRuleApplied());
        s.setCreatedAt(r.getCreatedAt());
        s.setCompletedAt(r.getActualEndTime());
        return s;
    }
}
