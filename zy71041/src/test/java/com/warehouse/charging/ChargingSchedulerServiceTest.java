package com.warehouse.charging;

import com.warehouse.charging.dto.ChargingRequestDTO;
import com.warehouse.charging.enums.ReservationStatus;
import com.warehouse.charging.enums.StationStatus;
import com.warehouse.charging.enums.TaskPriority;
import com.warehouse.charging.model.ChargingReservation;
import com.warehouse.charging.model.ChargingStation;
import com.warehouse.charging.repository.ChargingReservationRepository;
import com.warehouse.charging.repository.ChargingStationRepository;
import com.warehouse.charging.repository.ScheduleLogRepository;
import com.warehouse.charging.service.ChargingSchedulerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Rollback
class ChargingSchedulerServiceTest {

    @Autowired
    private ChargingSchedulerService schedulerService;

    @Autowired
    private ChargingReservationRepository reservationRepository;

    @Autowired
    private ChargingStationRepository stationRepository;

    @Autowired
    private ScheduleLogRepository logRepository;

    @BeforeEach
    void setUp() {
        ChargingStation station = new ChargingStation();
        station.setStationCode("TEST-STATION-001");
        station.setName("测试充电位1");
        station.setStatus(StationStatus.AVAILABLE);
        stationRepository.save(station);
    }

    private ChargingRequestDTO createRequest(String requestId, String robotCode, int battery, TaskPriority priority) {
        ChargingRequestDTO request = new ChargingRequestDTO();
        request.setRequestId(requestId);
        request.setRobotCode(robotCode);
        request.setBatteryLevel(battery);
        request.setPriority(priority);
        request.setCurrentTask("测试任务");
        request.setOperator("TEST-USER");
        request.setEvidence("测试证据");
        return request;
    }

    @Test
    void testCreateReservation_Success() {
        ChargingRequestDTO request = createRequest("REQ-TEST-001", "ROBOT-TEST-001", 50, TaskPriority.MEDIUM);

        ChargingReservation reservation = schedulerService.createReservation(request);

        assertNotNull(reservation);
        assertEquals("REQ-TEST-001", reservation.getRequestId());
        assertEquals(ReservationStatus.CONFIRMED, reservation.getStatus());
        assertNotNull(reservation.getRuleApplied());
        assertNotNull(reservation.getDecisionReason());
    }

    @Test
    void testCreateReservation_Idempotent() {
        ChargingRequestDTO request = createRequest("REQ-TEST-002", "ROBOT-TEST-002", 50, TaskPriority.MEDIUM);

        ChargingReservation first = schedulerService.createReservation(request);
        ChargingReservation second = schedulerService.createReservation(request);

        assertEquals(first.getId(), second.getId());
        assertEquals(first.getRequestId(), second.getRequestId());
    }

    @Test
    void testStartAndCompleteCharging() {
        ChargingRequestDTO request = createRequest("REQ-TEST-003", "ROBOT-TEST-003", 30, TaskPriority.MEDIUM);
        ChargingReservation reservation = schedulerService.createReservation(request);

        ChargingReservation charging = schedulerService.startCharging(reservation.getId());
        assertEquals(ReservationStatus.CHARGING, charging.getStatus());
        assertNotNull(charging.getActualStartTime());

        ChargingReservation completed = schedulerService.completeCharging(reservation.getId());
        assertEquals(ReservationStatus.COMPLETED, completed.getStatus());
        assertNotNull(completed.getActualEndTime());
    }

    @Test
    void testCancelReservation() {
        ChargingRequestDTO request = createRequest("REQ-TEST-004", "ROBOT-TEST-004", 30, TaskPriority.MEDIUM);
        ChargingReservation reservation = schedulerService.createReservation(request);

        ChargingReservation cancelled = schedulerService.cancelReservation(reservation.getId(), "测试取消", "TEST-USER");

        assertEquals(ReservationStatus.CANCELLED, cancelled.getStatus());
        assertEquals("测试取消", cancelled.getDecisionReason());
    }

    @Test
    void testInvalidBatteryLevel() {
        ChargingRequestDTO request = createRequest("REQ-TEST-005", "ROBOT-TEST-005", 150, TaskPriority.MEDIUM);

        assertThrows(IllegalArgumentException.class, () -> schedulerService.createReservation(request));
    }

    @Test
    void testScheduleLogCreated() {
        ChargingRequestDTO request = createRequest("REQ-TEST-006", "ROBOT-TEST-006", 50, TaskPriority.MEDIUM);
        ChargingReservation reservation = schedulerService.createReservation(request);

        var logs = logRepository.findByReservationIdOrderByCreatedAtDesc(reservation.getId());

        assertFalse(logs.isEmpty());
        assertTrue(logs.stream().anyMatch(log -> "SCHEDULE_DECISION".equals(log.getOperationType())));
    }
}
