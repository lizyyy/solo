package com.warehouse.charging.service;

import com.warehouse.charging.config.SchedulingRules;
import com.warehouse.charging.dto.ChargingRequestDTO;
import com.warehouse.charging.enums.ReservationStatus;
import com.warehouse.charging.enums.StationStatus;
import com.warehouse.charging.enums.TaskPriority;
import com.warehouse.charging.model.ChargingReservation;
import com.warehouse.charging.model.ChargingStation;
import com.warehouse.charging.model.Robot;
import com.warehouse.charging.model.ScheduleLog;
import com.warehouse.charging.repository.ChargingReservationRepository;
import com.warehouse.charging.repository.ChargingStationRepository;
import com.warehouse.charging.repository.RobotRepository;
import com.warehouse.charging.repository.ScheduleLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ChargingSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(ChargingSchedulerService.class);

    private final ChargingReservationRepository reservationRepository;
    private final ChargingStationRepository stationRepository;
    private final RobotRepository robotRepository;
    private final ScheduleLogRepository logRepository;
    private final SchedulingRules schedulingRules;

    public ChargingSchedulerService(ChargingReservationRepository reservationRepository,
                                    ChargingStationRepository stationRepository,
                                    RobotRepository robotRepository,
                                    ScheduleLogRepository logRepository,
                                    SchedulingRules schedulingRules) {
        this.reservationRepository = reservationRepository;
        this.stationRepository = stationRepository;
        this.robotRepository = robotRepository;
        this.logRepository = logRepository;
        this.schedulingRules = schedulingRules;
    }

    private static final List<ReservationStatus> ACTIVE_STATUSES = Arrays.asList(
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHARGING
    );

    @Transactional
    public ChargingReservation createReservation(ChargingRequestDTO request) {
        if (reservationRepository.existsByRequestId(request.getRequestId())) {
            ChargingReservation existing = reservationRepository.findByRequestId(request.getRequestId()).get();
            log.info("重复请求，返回已有记录: requestId={}", request.getRequestId());
            return existing;
        }

        validateRequest(request);
        syncRobotInfo(request);
        ChargingStation assignedStation = findOrAssignStation(request);
        List<ChargingReservation> activeReservations = reservationRepository
                .findActiveReservationsByStation(assignedStation.getStationCode(), ACTIVE_STATUSES);

        SchedulingDecision decision = evaluateScheduling(request, assignedStation, activeReservations);
        ChargingReservation reservation = buildReservation(request, assignedStation, decision);

        if (decision.isPreempt() && decision.getPreemptedReservation() != null) {
            handlePreemption(decision.getPreemptedReservation(), reservation);
        }

        ChargingReservation saved = reservationRepository.save(reservation);
        createScheduleLog(saved, request.getEvidence(), decision.getRuleApplied(), decision.getReason(), request.getOperator());
        updateStationStatus(assignedStation, reservation.getStatus());

        return saved;
    }

    private void validateRequest(ChargingRequestDTO request) {
        if (request.getBatteryLevel() < 0 || request.getBatteryLevel() > 100) {
            throw new IllegalArgumentException("电量必须在0-100之间");
        }
    }

    private void syncRobotInfo(ChargingRequestDTO request) {
        Optional<Robot> robotOpt = robotRepository.findByRobotCode(request.getRobotCode());
        if (robotOpt.isPresent()) {
            Robot robot = robotOpt.get();
            robot.setCurrentBattery(request.getBatteryLevel());
            if (request.getCurrentTask() != null) {
                robot.setCurrentTask(request.getCurrentTask());
            }
            robot.setLastHeartbeat(LocalDateTime.now());
            robotRepository.save(robot);
        } else {
            Robot newRobot = new Robot();
            newRobot.setRobotCode(request.getRobotCode());
            newRobot.setCurrentBattery(request.getBatteryLevel());
            newRobot.setCurrentTask(request.getCurrentTask());
            newRobot.setIsOnline(true);
            newRobot.setLastHeartbeat(LocalDateTime.now());
            robotRepository.save(newRobot);
        }
    }

    private ChargingStation findOrAssignStation(ChargingRequestDTO request) {
        if (request.getStationCode() != null && !request.getStationCode().isEmpty()) {
            return stationRepository.findByStationCode(request.getStationCode())
                    .filter(s -> s.getStatus() != StationStatus.MAINTENANCE && s.getStatus() != StationStatus.OFFLINE)
                    .orElseThrow(() -> new IllegalArgumentException("指定的充电位不可用: " + request.getStationCode()));
        }

        List<ChargingStation> availableStations = stationRepository.findByStatus(StationStatus.AVAILABLE);
        if (availableStations.isEmpty()) {
            List<ChargingStation> occupiedStations = stationRepository.findByStatus(StationStatus.OCCUPIED);
            if (occupiedStations.isEmpty()) {
                throw new IllegalStateException("没有可用的充电位");
            }
            return occupiedStations.get(0);
        }
        return availableStations.get(0);
    }

    private SchedulingDecision evaluateScheduling(ChargingRequestDTO request, ChargingStation station, List<ChargingReservation> activeReservations) {
        SchedulingDecision decision = new SchedulingDecision();

        boolean isLowBattery = request.getBatteryLevel() <= schedulingRules.getLowBatteryThreshold();
        boolean isCriticalBattery = request.getBatteryLevel() <= schedulingRules.getCriticalBatteryThreshold();
        boolean isHighPriority = request.getPriority().getLevel() >= TaskPriority.HIGH.getLevel();

        if (activeReservations.isEmpty()) {
            decision.setStatus(ReservationStatus.CONFIRMED);
            decision.setRuleApplied("RULE-001: 充电位空闲，直接分配");
            decision.setReason("充电位" + station.getStationCode() + "当前空闲，直接分配");
            return decision;
        }

        if (isCriticalBattery || (isLowBattery && isHighPriority)) {
            for (ChargingReservation existing : activeReservations) {
                if (existing.getPriority().getLevel() < request.getPriority().getLevel() ||
                    existing.getBatteryLevel() > request.getBatteryLevel() + 10) {

                    if (existing.getStatus() == ReservationStatus.CHARGING &&
                        schedulingRules.isTaskCompletionRequired() &&
                        existing.getCurrentTask() != null && !existing.getCurrentTask().isEmpty()) {
                        continue;
                    }

                    decision.setStatus(ReservationStatus.CONFIRMED);
                    decision.setPreempt(true);
                    decision.setPreemptedReservation(existing);
                    decision.setRuleApplied("RULE-002: 低电量高优先级插队");
                    decision.setReason(String.format("机器人%s电量%d%%，优先级%s，优于当前占用机器人%s电量%d%%，优先级%s",
                            request.getRobotCode(), request.getBatteryLevel(), request.getPriority(),
                            existing.getRobotCode(), existing.getBatteryLevel(), existing.getPriority()));
                    return decision;
                }
            }
        }

        decision.setStatus(ReservationStatus.PENDING);
        decision.setRuleApplied("RULE-003: 进入等待队列");
        decision.setReason("充电位已被占用，进入等待队列，当前等待数: " + activeReservations.size());
        return decision;
    }

    private ChargingReservation buildReservation(ChargingRequestDTO request, ChargingStation station, SchedulingDecision decision) {
        ChargingReservation reservation = new ChargingReservation();
        reservation.setRequestId(request.getRequestId());
        reservation.setRobotCode(request.getRobotCode());
        reservation.setStationCode(station.getStationCode());
        reservation.setPriority(request.getPriority());
        reservation.setBatteryLevel(request.getBatteryLevel());
        reservation.setCurrentTask(request.getCurrentTask());
        reservation.setStatus(decision.getStatus());
        reservation.setDecisionReason(decision.getReason());
        reservation.setRuleApplied(decision.getRuleApplied());
        reservation.setCreatedBy(request.getOperator());
        reservation.setEstimatedChargingStartTime(LocalDateTime.now());
        reservation.setEstimatedChargingEndTime(LocalDateTime.now().plusMinutes(60));
        return reservation;
    }

    private void handlePreemption(ChargingReservation existing, ChargingReservation newReservation) {
        existing.setPreviousStatus(existing.getStatus());
        existing.setStatus(ReservationStatus.PREEMPTED);
        existing.setPreemptedByReservationId(newReservation.getId());
        existing.setDecisionReason("被高优先级请求抢占: " + newReservation.getRequestId());
        reservationRepository.save(existing);

        createScheduleLog(existing, "被抢占", "RULE-002",
                "被机器人" + newReservation.getRobotCode() + "抢占充电位", newReservation.getCreatedBy());
    }

    private void createScheduleLog(ChargingReservation reservation, String evidence, String rule, String reason, String operator) {
        ScheduleLog scheduleLog = new ScheduleLog();
        scheduleLog.setRequestId(reservation.getRequestId());
        scheduleLog.setReservationId(reservation.getId());
        scheduleLog.setRobotCode(reservation.getRobotCode());
        scheduleLog.setStationCode(reservation.getStationCode());
        scheduleLog.setOperationType("SCHEDULE_DECISION");
        scheduleLog.setFromStatus(reservation.getPreviousStatus());
        scheduleLog.setToStatus(reservation.getStatus());
        scheduleLog.setEvidence(evidence);
        scheduleLog.setRuleApplied(rule);
        scheduleLog.setDecisionReason(reason);
        scheduleLog.setOperator(operator);
        logRepository.save(scheduleLog);
    }

    private void updateStationStatus(ChargingStation station, ReservationStatus reservationStatus) {
        if (reservationStatus == ReservationStatus.CONFIRMED || reservationStatus == ReservationStatus.CHARGING) {
            station.setStatus(StationStatus.OCCUPIED);
            stationRepository.save(station);
        }
    }

    @Transactional
    public ChargingReservation startCharging(Long reservationId) {
        ChargingReservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("预约记录不存在"));

        if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
            throw new IllegalStateException("只有已确认的预约可以开始充电");
        }

        reservation.setPreviousStatus(reservation.getStatus());
        reservation.setStatus(ReservationStatus.CHARGING);
        reservation.setActualStartTime(LocalDateTime.now());
        reservation.setDecisionReason("机器人到达充电位，开始充电");
        reservation.setRuleApplied("RULE-004: 充电开始");

        ChargingReservation saved = reservationRepository.save(reservation);
        createScheduleLog(saved, "机器人就位", "RULE-004", "开始充电", "SYSTEM");

        return saved;
    }

    @Transactional
    public ChargingReservation completeCharging(Long reservationId) {
        ChargingReservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("预约记录不存在"));

        reservation.setPreviousStatus(reservation.getStatus());
        reservation.setStatus(ReservationStatus.COMPLETED);
        reservation.setActualEndTime(LocalDateTime.now());
        reservation.setDecisionReason("充电完成");
        reservation.setRuleApplied("RULE-005: 充电完成");

        ChargingStation station = stationRepository.findByStationCode(reservation.getStationCode()).orElse(null);
        if (station != null) {
            station.setStatus(StationStatus.AVAILABLE);
            stationRepository.save(station);
        }

        ChargingReservation saved = reservationRepository.save(reservation);
        createScheduleLog(saved, "充电完成", "RULE-005", "充电完成，释放充电位", "SYSTEM");

        return saved;
    }

    @Transactional
    public ChargingReservation cancelReservation(Long reservationId, String reason, String operator) {
        ChargingReservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("预约记录不存在"));

        if (reservation.getStatus() == ReservationStatus.COMPLETED || reservation.getStatus() == ReservationStatus.CANCELLED) {
            throw new IllegalStateException("该预约无法取消");
        }

        reservation.setPreviousStatus(reservation.getStatus());
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservation.setDecisionReason(reason);
        reservation.setRuleApplied("RULE-006: 取消预约");

        ChargingStation station = stationRepository.findByStationCode(reservation.getStationCode()).orElse(null);
        if (station != null) {
            station.setStatus(StationStatus.AVAILABLE);
            stationRepository.save(station);
        }

        ChargingReservation saved = reservationRepository.save(reservation);
        createScheduleLog(saved, "用户取消", "RULE-006", reason, operator);

        return saved;
    }

    public Optional<ChargingReservation> findByRequestId(String requestId) {
        return reservationRepository.findByRequestId(requestId);
    }

    public List<ChargingReservation> findActiveReservations() {
        return reservationRepository.findByStatusIn(ACTIVE_STATUSES);
    }

    private static class SchedulingDecision {
        private ReservationStatus status;
        private boolean preempt;
        private ChargingReservation preemptedReservation;
        private String ruleApplied;
        private String reason;

        public ReservationStatus getStatus() { return status; }
        public void setStatus(ReservationStatus status) { this.status = status; }
        public boolean isPreempt() { return preempt; }
        public void setPreempt(boolean preempt) { this.preempt = preempt; }
        public ChargingReservation getPreemptedReservation() { return preemptedReservation; }
        public void setPreemptedReservation(ChargingReservation preemptedReservation) { this.preemptedReservation = preemptedReservation; }
        public String getRuleApplied() { return ruleApplied; }
        public void setRuleApplied(String ruleApplied) { this.ruleApplied = ruleApplied; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }
}
