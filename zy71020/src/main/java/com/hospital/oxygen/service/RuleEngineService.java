package com.hospital.oxygen.service;

import com.hospital.oxygen.dto.BookingRequest;
import com.hospital.oxygen.entity.*;
import com.hospital.oxygen.enums.BookingStatus;
import com.hospital.oxygen.enums.BorrowStatus;
import com.hospital.oxygen.enums.TransferStatus;
import com.hospital.oxygen.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class RuleEngineService {

    private static final Logger log = LoggerFactory.getLogger(RuleEngineService.class);

    private final BookingRepository bookingRepository;
    private final EquipmentBorrowRepository borrowRepository;
    private final TransferRequestRepository transferRepository;
    private final OxygenPortRepository portRepository;

    private static final List<BookingStatus> ACTIVE_BOOKING_STATUSES =
            List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE);
    private static final List<BorrowStatus> ACTIVE_BORROW_STATUSES =
            List.of(BorrowStatus.REQUESTED, BorrowStatus.APPROVED, BorrowStatus.BORROWED);
    private static final List<TransferStatus> ACTIVE_TRANSFER_STATUSES =
            List.of(TransferStatus.PENDING, TransferStatus.APPROVED, TransferStatus.IN_TRANSIT);

    public RuleEngineService(BookingRepository bookingRepository, EquipmentBorrowRepository borrowRepository, TransferRequestRepository transferRepository, OxygenPortRepository portRepository) {
        this.bookingRepository = bookingRepository;
        this.borrowRepository = borrowRepository;
        this.transferRepository = transferRepository;
        this.portRepository = portRepository;
    }

    public RuleResult validateBooking(BookingRequest request) {
        RuleResult result = new RuleResult();
        result.setPassed(true);
        List<String> violations = new ArrayList<>();

        checkDuplicateBooking(request, violations);
        checkPortOccupancy(request, violations);
        checkUnreleasedTransfers(request, violations);
        checkOverlappingBookings(request, violations);

        if (!violations.isEmpty()) {
            result.setPassed(false);
            result.setViolations(violations);
        }

        return result;
    }

    private void checkDuplicateBooking(BookingRequest request, List<String> violations) {
        long count = bookingRepository.countDuplicateBookings(
                request.getPatientId(),
                request.getOxygenPortCode(),
                ACTIVE_BOOKING_STATUSES
        );
        if (count > 0) {
            violations.add("重复预约：该患者已预约此氧气接口");
            log.warn("规则命中: 重复预约检测 - 患者:{}, 接口:{}", request.getPatientId(), request.getOxygenPortCode());
        }
    }

    private void checkPortOccupancy(BookingRequest request, List<String> violations) {
        portRepository.findByPortCode(request.getOxygenPortCode()).ifPresent(port -> {
            if (!"AVAILABLE".equals(port.getStatus().name())) {
                violations.add("接口占用：氧气接口 " + port.getPortCode() + " 当前状态为 " + port.getStatus());
                log.warn("规则命中: 接口占用检测 - 接口:{}, 状态:{}", port.getPortCode(), port.getStatus());
            }
        });
    }

    private void checkUnreleasedTransfers(BookingRequest request, List<String> violations) {
        long count = transferRepository.countUnreleasedTransfers(request.getPatientId());
        if (count > 0) {
            violations.add("转科未释放：该患者存在未释放资源的转科记录");
            log.warn("规则命中: 转科未释放检测 - 患者:{}", request.getPatientId());
        }
    }

    private void checkOverlappingBookings(BookingRequest request, List<String> violations) {
        LocalDateTime startTime = request.getStartTime() != null ? request.getStartTime() : LocalDateTime.now();
        LocalDateTime endTime = request.getExpectedEndTime() != null ? request.getExpectedEndTime() : startTime.plusHours(24);

        List<Booking> overlaps = bookingRepository.findOverlappingBookings(
                request.getOxygenPortCode(),
                ACTIVE_BOOKING_STATUSES,
                startTime,
                endTime
        );
        if (!overlaps.isEmpty()) {
            violations.add("时间冲突：与现有预约 " + overlaps.get(0).getBookingNumber() + " 时间重叠");
            log.warn("规则命中: 时间冲突检测 - 接口:{}, 冲突预约:{}", request.getOxygenPortCode(), overlaps.get(0).getBookingNumber());
        }
    }

    public RuleResult validateBorrow(String equipmentCode, String patientId) {
        RuleResult result = new RuleResult();
        result.setPassed(true);
        List<String> violations = new ArrayList<>();

        long count = borrowRepository.countDuplicateBorrowAttempts(equipmentCode, patientId, ACTIVE_BORROW_STATUSES);
        if (count > 0) {
            violations.add("重复借用：该设备已被该患者借用");
            result.setPassed(false);
        }

        List<EquipmentBorrow> activeBorrows = borrowRepository.findActiveBorrowsByEquipment(equipmentCode, ACTIVE_BORROW_STATUSES);
        if (!activeBorrows.isEmpty()) {
            violations.add("设备占用：设备 " + equipmentCode + " 已被借用");
            result.setPassed(false);
        }

        result.setViolations(violations);
        return result;
    }

    public List<TransferRequest> checkUnreleasedTransfers() {
        return transferRepository.findCompletedTransfersWithUnreleasedResources();
    }

    public List<EquipmentBorrow> checkOverdueBorrows() {
        return borrowRepository.findOverdueBorrows(LocalDateTime.now());
    }

    public static class RuleResult {
        private boolean passed;
        private List<String> violations = new ArrayList<>();
        private List<String> warnings = new ArrayList<>();

        public boolean isPassed() { return passed; }
        public void setPassed(boolean passed) { this.passed = passed; }
        public List<String> getViolations() { return violations; }
        public void setViolations(List<String> violations) { this.violations = violations; }
        public List<String> getWarnings() { return warnings; }
        public void setWarnings(List<String> warnings) { this.warnings = warnings; }
    }
}
