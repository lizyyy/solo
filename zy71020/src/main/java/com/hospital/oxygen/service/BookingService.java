package com.hospital.oxygen.service;

import com.hospital.oxygen.common.BusinessException;
import com.hospital.oxygen.dto.BookingRequest;
import com.hospital.oxygen.entity.Booking;
import com.hospital.oxygen.entity.OxygenPort;
import com.hospital.oxygen.enums.BookingStatus;
import com.hospital.oxygen.enums.PortStatus;
import com.hospital.oxygen.repository.BookingRepository;
import com.hospital.oxygen.repository.OxygenPortRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);

    private final BookingRepository bookingRepository;
    private final OxygenPortRepository portRepository;
    private final RuleEngineService ruleEngineService;
    private final AuditService auditService;

    public BookingService(BookingRepository bookingRepository, OxygenPortRepository portRepository, RuleEngineService ruleEngineService, AuditService auditService) {
        this.bookingRepository = bookingRepository;
        this.portRepository = portRepository;
        this.ruleEngineService = ruleEngineService;
        this.auditService = auditService;
    }

    @Transactional
    public Booking createBooking(BookingRequest request) {
        log.info("创建氧气接口预约: 患者={}, 接口={}", request.getPatientId(), request.getOxygenPortCode());

        RuleEngineService.RuleResult ruleResult = ruleEngineService.validateBooking(request);

        String bookingNumber = "BK" + System.currentTimeMillis();

        Booking booking = new Booking();
        booking.setBookingNumber(bookingNumber);
        booking.setPatientId(request.getPatientId());
        booking.setWard(request.getWard());
        booking.setBedNumber(request.getBedNumber());
        booking.setOxygenPortCode(request.getOxygenPortCode());
        booking.setStartTime(request.getStartTime() != null ? request.getStartTime() : LocalDateTime.now());
        booking.setExpectedEndTime(request.getExpectedEndTime());
        booking.setRemarks(request.getRemarks());
        booking.setOperator(request.getOperator());
        booking.setRuleResults(String.join(";", ruleResult.getViolations()));

        if (!ruleResult.isPassed()) {
            booking.setStatus(BookingStatus.REJECTED);
            booking.setRuleViolations(String.join(";", ruleResult.getViolations()));
            booking = bookingRepository.save(booking);
            auditService.logOperation("CREATE_REJECTED", "BOOKING", bookingNumber, null, booking.getStatus(), request.getOperator(), String.join(";", ruleResult.getViolations()));
            log.info("预约被拒绝: {}, 原因: {}", bookingNumber, ruleResult.getViolations());
            return booking;
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking = bookingRepository.save(booking);

        lockPort(request.getOxygenPortCode(), bookingNumber, request.getOperator());

        auditService.logOperation("CREATE", "BOOKING", bookingNumber, null, booking.getStatus(), request.getOperator(), "预约创建成功");

        log.info("预约创建成功: {}", bookingNumber);
        return booking;
    }

    @Transactional
    public Booking createDuplicateBooking(BookingRequest request, String existingBookingNumber) {
        String bookingNumber = "BK" + System.currentTimeMillis() + "-DUP";
        Booking booking = new Booking();
        booking.setBookingNumber(bookingNumber);
        booking.setPatientId(request.getPatientId());
        booking.setWard(request.getWard());
        booking.setOxygenPortCode(request.getOxygenPortCode());
        booking.setStatus(BookingStatus.REJECTED);
        booking.setRuleViolations("重复预约");
        booking.setOperator(request.getOperator());
        bookingRepository.save(booking);

        auditService.logDuplicateOperation("CREATE", "BOOKING", bookingNumber, existingBookingNumber, request.getOperator());

        return booking;
    }

    private void lockPort(String portCode, String bookingNumber, String operator) {
        OxygenPort port = portRepository.findByPortCode(portCode)
                .orElseThrow(() -> new BusinessException("氧气接口不存在"));

        if (port.getStatus() != PortStatus.AVAILABLE) {
            throw new BusinessException("氧气接口当前不可用: " + port.getStatus());
        }

        port.setStatus(PortStatus.OCCUPIED);
        port.setCurrentBookingId(bookingNumber);
        portRepository.save(port);

        auditService.logOperation("LOCK", "PORT", portCode, PortStatus.AVAILABLE, PortStatus.OCCUPIED, operator, "预约锁定");
    }

    @Transactional
    public Booking completeBooking(String bookingNumber, String operator) {
        Booking booking = bookingRepository.findByBookingNumber(bookingNumber)
                .orElseThrow(() -> new BusinessException("预约不存在"));

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            auditService.logDuplicateOperation("COMPLETE", "BOOKING", bookingNumber, bookingNumber, operator);
            return booking;
        }

        Booking before = new Booking();
        before.setStatus(booking.getStatus());

        booking.setStatus(BookingStatus.COMPLETED);
        booking.setActualEndTime(LocalDateTime.now());
        booking = bookingRepository.save(booking);

        releasePort(booking.getOxygenPortCode(), operator);

        auditService.logOperation("COMPLETE", "BOOKING", bookingNumber, before, booking, operator, "使用完成");

        return booking;
    }

    private void releasePort(String portCode, String operator) {
        portRepository.findByPortCode(portCode).ifPresent(port -> {
            PortStatus before = port.getStatus();
            port.setStatus(PortStatus.AVAILABLE);
            port.setCurrentBookingId(null);
            portRepository.save(port);
            auditService.logOperation("RELEASE", "PORT", portCode, before, PortStatus.AVAILABLE, operator, "预约释放");
        });
    }

    @Transactional
    public Booking cancelBooking(String bookingNumber, String operator) {
        Booking booking = bookingRepository.findByBookingNumber(bookingNumber)
                .orElseThrow(() -> new BusinessException("预约不存在"));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            auditService.logDuplicateOperation("CANCEL", "BOOKING", bookingNumber, bookingNumber, operator);
            return booking;
        }

        Booking before = new Booking();
        before.setStatus(booking.getStatus());

        booking.setStatus(BookingStatus.CANCELLED);
        booking = bookingRepository.save(booking);

        releasePort(booking.getOxygenPortCode(), operator);

        auditService.logOperation("CANCEL", "BOOKING", bookingNumber, before, booking, operator, "取消预约");

        return booking;
    }

    @Transactional
    public Booking overrideBooking(String bookingNumber, String reason, String operator, BookingStatus newStatus) {
        Booking booking = bookingRepository.findByBookingNumber(bookingNumber)
                .orElseThrow(() -> new BusinessException("预约不存在"));

        Booking before = new Booking();
        before.setStatus(booking.getStatus());
        before.setIsOverridden(booking.getIsOverridden());

        booking.setStatus(newStatus);
        booking.setIsOverridden(true);
        booking.setOverrideReason(reason);
        booking.setOverrideOperator(operator);

        if (newStatus == BookingStatus.COMPLETED || newStatus == BookingStatus.CANCELLED) {
            releasePort(booking.getOxygenPortCode(), operator);
        } else if (newStatus == BookingStatus.CONFIRMED || newStatus == BookingStatus.ACTIVE) {
            lockPort(booking.getOxygenPortCode(), bookingNumber, operator);
        }

        booking = bookingRepository.save(booking);

        auditService.logOperation("OVERRIDE", "BOOKING", bookingNumber, before, booking, operator, reason);

        return booking;
    }

    public Booking getBooking(String bookingNumber) {
        return bookingRepository.findByBookingNumber(bookingNumber)
                .orElseThrow(() -> new BusinessException("预约不存在"));
    }

    public List<Booking> getBookingsByPatient(String patientId) {
        return bookingRepository.findByPatientId(patientId);
    }

    public List<Booking> getBookingsByPort(String portCode) {
        return bookingRepository.findByOxygenPortCode(portCode);
    }

    public List<Booking> getActiveBookings() {
        return bookingRepository.findByStatusIn(List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE));
    }

    public List<Booking> getAllBookings() {
        return bookingRepository.findAll();
    }
}
