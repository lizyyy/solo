package com.hospital.oxygen.service;

import com.hospital.oxygen.entity.*;
import com.hospital.oxygen.enums.BookingStatus;
import com.hospital.oxygen.enums.BorrowStatus;
import com.hospital.oxygen.enums.PortStatus;
import com.hospital.oxygen.enums.TransferStatus;
import com.hospital.oxygen.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    private final OccupancyReportRepository reportRepository;
    private final OxygenPortRepository portRepository;
    private final EquipmentRepository equipmentRepository;
    private final BookingRepository bookingRepository;
    private final TransferRequestRepository transferRepository;
    private final EquipmentBorrowRepository borrowRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;

    public ReportService(OccupancyReportRepository reportRepository, OxygenPortRepository portRepository, EquipmentRepository equipmentRepository, BookingRepository bookingRepository, TransferRequestRepository transferRepository, EquipmentBorrowRepository borrowRepository, AuditLogRepository auditLogRepository, AuditService auditService) {
        this.reportRepository = reportRepository;
        this.portRepository = portRepository;
        this.equipmentRepository = equipmentRepository;
        this.bookingRepository = bookingRepository;
        this.transferRepository = transferRepository;
        this.borrowRepository = borrowRepository;
        this.auditLogRepository = auditLogRepository;
        this.auditService = auditService;
    }

    @Transactional
    public OccupancyReport generateReport(String ward, String operator) {
        log.info("生成占用报告: 科室={}", ward);

        String reportNumber = "RPT" + System.currentTimeMillis();

        List<OxygenPort> ports = portRepository.findByWard(ward);
        List<Equipment> equipments = equipmentRepository.findByWard(ward);
        List<Booking> activeBookings = bookingRepository.findByStatusIn(
                List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE)
        ).stream().filter(b -> b.getWard().equals(ward)).toList();

        long overdueCount = borrowRepository.findOverdueBorrows(LocalDateTime.now()).stream()
                .filter(b -> b.getBorrowWard().equals(ward)).count();

        long borrowedCount = borrowRepository.findByStatus(BorrowStatus.BORROWED).stream()
                .filter(b -> b.getBorrowWard().equals(ward)).count();

        List<TransferRequest> transfers = transferRepository.findByFromWard(ward);
        long pendingTransfers = transfers.stream().filter(t -> t.getStatus() == TransferStatus.PENDING).count();
        long completedTransfers = transfers.stream().filter(t -> t.getStatus() == TransferStatus.COMPLETED).count();
        long unreleasedTransfers = transfers.stream()
                .filter(t -> t.getStatus() == TransferStatus.COMPLETED && !t.getResourcesReleased()).count();

        LocalDateTime startOfDay = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0);
        LocalDateTime endOfDay = LocalDateTime.now().withHour(23).withMinute(59).withSecond(59);
        long duplicateAttempts = auditLogRepository.countDuplicateOperations(startOfDay, endOfDay);

        OccupancyReport report = new OccupancyReport();
        report.setReportNumber(reportNumber);
        report.setWard(ward);
        report.setReportDate(LocalDateTime.now());

        report.setTotalPorts(ports.size());
        report.setOccupiedPorts((int) ports.stream().filter(p -> p.getStatus() == PortStatus.OCCUPIED).count());
        report.setAvailablePorts((int) ports.stream().filter(p -> p.getStatus() == PortStatus.AVAILABLE).count());
        report.setReservedPorts((int) ports.stream().filter(p -> p.getStatus() == PortStatus.RESERVED).count());
        report.setMaintenancePorts((int) ports.stream().filter(p -> p.getStatus() == PortStatus.MAINTENANCE).count());

        report.setTotalEquipments(equipments.size());
        report.setBorrowedEquipments((int) borrowedCount);
        report.setOverdueEquipments((int) overdueCount);

        report.setPendingTransfers((int) pendingTransfers);
        report.setCompletedTransfers((int) completedTransfers);
        report.setUnreleasedTransfers((int) unreleasedTransfers);

        report.setActiveBookings(activeBookings.size());
        report.setDuplicateAttempts((int) duplicateAttempts);

        report.setGeneratedBy(operator);
        report = reportRepository.save(report);

        auditService.logOperation("GENERATE", "REPORT", reportNumber, null, report, operator, "报告生成");

        return report;
    }

    public byte[] exportReportToCsv(String reportNumber) {
        OccupancyReport report = reportRepository.findByReportNumber(reportNumber)
                .orElseThrow(() -> new RuntimeException("报告不存在"));

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {

            writer.println("\uFEFF");
            writer.println("病房氧气接口占用报告");
            writer.println("报告编号," + report.getReportNumber());
            writer.println("科室," + report.getWard());
            writer.println("生成时间," + report.getReportDate().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            writer.println("生成人," + report.getGeneratedBy());
            writer.println();

            writer.println("=== 氧气接口统计 ===");
            writer.println("总接口数," + report.getTotalPorts());
            writer.println("已占用," + report.getOccupiedPorts());
            writer.println("可用," + report.getAvailablePorts());
            writer.println("预留," + report.getReservedPorts());
            writer.println("维护中," + report.getMaintenancePorts());
            writer.println();

            writer.println("=== 设备统计 ===");
            writer.println("总设备数," + report.getTotalEquipments());
            writer.println("已借出," + report.getBorrowedEquipments());
            writer.println("超期未还," + report.getOverdueEquipments());
            writer.println();

            writer.println("=== 转科统计 ===");
            writer.println("待审批," + report.getPendingTransfers());
            writer.println("已完成," + report.getCompletedTransfers());
            writer.println("未释放资源," + report.getUnreleasedTransfers());
            writer.println();

            writer.println("=== 其他统计 ===");
            writer.println("活跃预约," + report.getActiveBookings());
            writer.println("今日重复操作," + report.getDuplicateAttempts());
            writer.println();

            writer.println("备注," + (report.getRemarks() != null ? report.getRemarks() : ""));

            writer.flush();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("导出报告失败", e);
            throw new RuntimeException("导出报告失败");
        }
    }

    public List<OccupancyReport> getReportsByWard(String ward) {
        return reportRepository.findByWard(ward);
    }

    public List<OccupancyReport> getReportsByDateRange(LocalDateTime start, LocalDateTime end) {
        return reportRepository.findByDateRange(start, end);
    }

    public OccupancyReport getReport(String reportNumber) {
        return reportRepository.findByReportNumber(reportNumber)
                .orElseThrow(() -> new RuntimeException("报告不存在"));
    }

    public List<OccupancyReport> getAllReports() {
        return reportRepository.findAll();
    }
}
