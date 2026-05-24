package com.warehouse.charging.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class ScheduleReportDTO {
    private LocalDateTime reportStartTime;
    private LocalDateTime reportEndTime;
    private LocalDateTime generatedAt;

    private long totalRequests;
    private long confirmedCount;
    private long pendingCount;
    private long completedCount;
    private long cancelledCount;
    private long preemptedCount;

    private Map<String, Long> stationUsage;
    private Map<String, Long> robotChargingCount;
    private Map<String, Long> priorityDistribution;

    private double avgWaitingTimeMinutes;
    private double avgChargingTimeMinutes;
    private double preemptionRate;

    private List<String> keyInsights;
    private List<ReservationSummary> reservationSummaries;

    public static class ReservationSummary {
        private String requestId;
        private String robotCode;
        private String stationCode;
        private String priority;
        private Integer batteryLevel;
        private String status;
        private String ruleApplied;
        private LocalDateTime createdAt;
        private LocalDateTime completedAt;

        public String getRequestId() { return requestId; }
        public void setRequestId(String requestId) { this.requestId = requestId; }
        public String getRobotCode() { return robotCode; }
        public void setRobotCode(String robotCode) { this.robotCode = robotCode; }
        public String getStationCode() { return stationCode; }
        public void setStationCode(String stationCode) { this.stationCode = stationCode; }
        public String getPriority() { return priority; }
        public void setPriority(String priority) { this.priority = priority; }
        public Integer getBatteryLevel() { return batteryLevel; }
        public void setBatteryLevel(Integer batteryLevel) { this.batteryLevel = batteryLevel; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getRuleApplied() { return ruleApplied; }
        public void setRuleApplied(String ruleApplied) { this.ruleApplied = ruleApplied; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
        public LocalDateTime getCompletedAt() { return completedAt; }
        public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    }

    public LocalDateTime getReportStartTime() { return reportStartTime; }
    public void setReportStartTime(LocalDateTime reportStartTime) { this.reportStartTime = reportStartTime; }
    public LocalDateTime getReportEndTime() { return reportEndTime; }
    public void setReportEndTime(LocalDateTime reportEndTime) { this.reportEndTime = reportEndTime; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
    public long getTotalRequests() { return totalRequests; }
    public void setTotalRequests(long totalRequests) { this.totalRequests = totalRequests; }
    public long getConfirmedCount() { return confirmedCount; }
    public void setConfirmedCount(long confirmedCount) { this.confirmedCount = confirmedCount; }
    public long getPendingCount() { return pendingCount; }
    public void setPendingCount(long pendingCount) { this.pendingCount = pendingCount; }
    public long getCompletedCount() { return completedCount; }
    public void setCompletedCount(long completedCount) { this.completedCount = completedCount; }
    public long getCancelledCount() { return cancelledCount; }
    public void setCancelledCount(long cancelledCount) { this.cancelledCount = cancelledCount; }
    public long getPreemptedCount() { return preemptedCount; }
    public void setPreemptedCount(long preemptedCount) { this.preemptedCount = preemptedCount; }
    public Map<String, Long> getStationUsage() { return stationUsage; }
    public void setStationUsage(Map<String, Long> stationUsage) { this.stationUsage = stationUsage; }
    public Map<String, Long> getRobotChargingCount() { return robotChargingCount; }
    public void setRobotChargingCount(Map<String, Long> robotChargingCount) { this.robotChargingCount = robotChargingCount; }
    public Map<String, Long> getPriorityDistribution() { return priorityDistribution; }
    public void setPriorityDistribution(Map<String, Long> priorityDistribution) { this.priorityDistribution = priorityDistribution; }
    public double getAvgWaitingTimeMinutes() { return avgWaitingTimeMinutes; }
    public void setAvgWaitingTimeMinutes(double avgWaitingTimeMinutes) { this.avgWaitingTimeMinutes = avgWaitingTimeMinutes; }
    public double getAvgChargingTimeMinutes() { return avgChargingTimeMinutes; }
    public void setAvgChargingTimeMinutes(double avgChargingTimeMinutes) { this.avgChargingTimeMinutes = avgChargingTimeMinutes; }
    public double getPreemptionRate() { return preemptionRate; }
    public void setPreemptionRate(double preemptionRate) { this.preemptionRate = preemptionRate; }
    public List<String> getKeyInsights() { return keyInsights; }
    public void setKeyInsights(List<String> keyInsights) { this.keyInsights = keyInsights; }
    public List<ReservationSummary> getReservationSummaries() { return reservationSummaries; }
    public void setReservationSummaries(List<ReservationSummary> reservationSummaries) { this.reservationSummaries = reservationSummaries; }
}
