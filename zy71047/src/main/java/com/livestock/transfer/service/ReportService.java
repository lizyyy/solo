package com.livestock.transfer.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livestock.transfer.common.TransferNoGenerator;
import com.livestock.transfer.dto.TransferDetailVO;
import com.livestock.transfer.entity.*;
import com.livestock.transfer.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ReportService {
    private static final Logger log = LoggerFactory.getLogger(ReportService.class);
    
    private final TransferReportRepository reportRepository;
    private final TransferOrderRepository transferOrderRepository;
    private final TransferEarTagRepository transferEarTagRepository;
    private final TransferValidationRepository validationRepository;
    private final AcceptanceRecordRepository acceptanceRepository;
    private final AcceptanceTagRepository acceptanceTagRepository;
    private final FarmRepository farmRepository;
    private final QuarantineCertificateRepository certificateRepository;
    private final TransportVehicleRepository vehicleRepository;
    private final OperationLogRepository operationLogRepository;
    private final TransferNoGenerator noGenerator;
    private final ObjectMapper objectMapper;

    public ReportService(TransferReportRepository reportRepository,
            TransferOrderRepository transferOrderRepository,
            TransferEarTagRepository transferEarTagRepository,
            TransferValidationRepository validationRepository,
            AcceptanceRecordRepository acceptanceRepository,
            AcceptanceTagRepository acceptanceTagRepository,
            FarmRepository farmRepository,
            QuarantineCertificateRepository certificateRepository,
            TransportVehicleRepository vehicleRepository,
            OperationLogRepository operationLogRepository,
            TransferNoGenerator noGenerator,
            ObjectMapper objectMapper) {
        this.reportRepository = reportRepository;
        this.transferOrderRepository = transferOrderRepository;
        this.transferEarTagRepository = transferEarTagRepository;
        this.validationRepository = validationRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.acceptanceTagRepository = acceptanceTagRepository;
        this.farmRepository = farmRepository;
        this.certificateRepository = certificateRepository;
        this.vehicleRepository = vehicleRepository;
        this.operationLogRepository = operationLogRepository;
        this.noGenerator = noGenerator;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public TransferReport generateTransferReport(Long transferId, String operator) {
        TransferOrder order = transferOrderRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        Farm sourceFarm = farmRepository.findById(order.getSourceFarmId()).orElse(null);
        Farm targetFarm = farmRepository.findById(order.getTargetFarmId()).orElse(null);
        QuarantineCertificate cert = order.getCertificateId() != null ?
                certificateRepository.findById(order.getCertificateId()).orElse(null) : null;
        TransportVehicle vehicle = order.getVehicleId() != null ?
                vehicleRepository.findById(order.getVehicleId()).orElse(null) : null;

        List<TransferEarTag> earTags = transferEarTagRepository.findByTransferId(transferId);
        List<TransferValidation> validations = validationRepository.findByTransferId(transferId);
        List<AcceptanceRecord> acceptanceRecords = acceptanceRepository.findByTransferId(transferId);
        List<OperationLog> operationLogs = operationLogRepository.findByTransferIdOrderByCreatedAtDesc(transferId);

        Map<String, Object> reportData = new LinkedHashMap<>();
        reportData.put("transferNo", order.getTransferNo());
        reportData.put("status", order.getStatus().name());
        reportData.put("statusDescription", order.getStatus().getDescription());
        
        Map<String, Object> farms = new LinkedHashMap<>();
        farms.put("sourceFarm", sourceFarm != null ? sourceFarm.getFarmName() + "(" + sourceFarm.getFarmCode() + ")" : "未知");
        farms.put("targetFarm", targetFarm != null ? targetFarm.getFarmName() + "(" + targetFarm.getFarmCode() + ")" : "未知");
        reportData.put("farms", farms);

        Map<String, Object> documents = new LinkedHashMap<>();
        documents.put("quarantineCertificate", cert != null ? 
                cert.getCertificateNo() + " (有效期至:" + cert.getExpireDate() + ")" : "未提供");
        documents.put("transportVehicle", vehicle != null ? 
                vehicle.getPlateNo() + " - " + vehicle.getDriverName() : "未提供");
        reportData.put("documents", documents);

        Map<String, Object> quantities = new LinkedHashMap<>();
        quantities.put("planned", order.getPlannedQuantity());
        quantities.put("actual", order.getActualQuantity());
        quantities.put("earTagCount", earTags.size());
        reportData.put("quantities", quantities);

        Map<String, Object> earTagStats = new LinkedHashMap<>();
        long duplicateCount = earTags.stream().filter(TransferEarTag::getIsDuplicate).count();
        earTagStats.put("total", earTags.size());
        earTagStats.put("duplicate", duplicateCount);
        earTagStats.put("normal", earTags.size() - duplicateCount);
        reportData.put("earTagStatistics", earTagStats);

        Map<String, Object> validationStats = new LinkedHashMap<>();
        long failCount = validations.stream().filter(v -> "FAIL".equals(v.getValidationResult().name())).count();
        long warnCount = validations.stream().filter(v -> "WARN".equals(v.getValidationResult().name())).count();
        long resolvedCount = validations.stream().filter(v -> Boolean.TRUE.equals(v.getIsResolved())).count();
        validationStats.put("total", validations.size());
        validationStats.put("fail", failCount);
        validationStats.put("warn", warnCount);
        validationStats.put("resolved", resolvedCount);
        validationStats.put("unresolved", validations.size() - resolvedCount);
        reportData.put("validationStatistics", validationStats);

        Map<String, Object> acceptanceStats = new LinkedHashMap<>();
        if (!acceptanceRecords.isEmpty()) {
            AcceptanceRecord latest = acceptanceRecords.get(acceptanceRecords.size() - 1);
            acceptanceStats.put("latestAcceptanceNo", latest.getAcceptanceNo());
            acceptanceStats.put("status", latest.getStatus());
            acceptanceStats.put("acceptedQuantity", latest.getAcceptedQuantity());
            acceptanceStats.put("difference", latest.getDifferenceQuantity());
            
            List<AcceptanceTag> acceptanceTags = acceptanceTagRepository.findByAcceptanceId(latest.getId());
            long matched = acceptanceTags.stream().filter(AcceptanceTag::getIsMatched).count();
            long extra = acceptanceTags.stream().filter(AcceptanceTag::getIsExtra).count();
            long missing = acceptanceTags.stream().filter(AcceptanceTag::getIsMissing).count();
            acceptanceStats.put("matchedCount", matched);
            acceptanceStats.put("extraCount", extra);
            acceptanceStats.put("missingCount", missing);
        }
        reportData.put("acceptanceStatistics", acceptanceStats);

        reportData.put("consistencyCheck", performConsistencyCheck(order, earTags, acceptanceRecords));
        reportData.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        reportData.put("operationLogCount", operationLogs.size());

        TransferReport report = new TransferReport();
        report.setReportNo(noGenerator.generateReportNo());
        report.setTransferId(transferId);
        report.setReportType("FULL");
        report.setReportContent(toJson(reportData));
        report.setGeneratedBy(operator);
        return reportRepository.save(report);
    }

    private Map<String, Object> performConsistencyCheck(TransferOrder order, 
            List<TransferEarTag> earTags, List<AcceptanceRecord> acceptanceRecords) {
        Map<String, Object> checks = new LinkedHashMap<>();
        
        checks.put("plannedVsEarTagCount", order.getPlannedQuantity().equals(earTags.size()));
        
        if (!acceptanceRecords.isEmpty()) {
            AcceptanceRecord latest = acceptanceRecords.get(acceptanceRecords.size() - 1);
            checks.put("plannedVsAcceptedCount", order.getPlannedQuantity().equals(latest.getAcceptedQuantity()));
            if (order.getActualQuantity() != null) {
                checks.put("actualVsAcceptedCount", order.getActualQuantity().equals(latest.getAcceptedQuantity()));
            }
        }
        
        long allMatched = checks.values().stream().filter(v -> Boolean.TRUE.equals(v)).count();
        checks.put("overallConsistent", allMatched == checks.size());
        checks.put("consistentChecks", allMatched);
        checks.put("totalChecks", checks.size() - 3);
        
        return checks;
    }

    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new LinkedHashMap<>();
        
        List<TransferOrder> allOrders = transferOrderRepository.findAll();
        stats.put("totalTransfers", allOrders.size());
        
        Map<String, Long> statusCount = new LinkedHashMap<>();
        for (TransferOrder order : allOrders) {
            String status = order.getStatus().name();
            statusCount.put(status, statusCount.getOrDefault(status, 0L) + 1);
        }
        stats.put("statusDistribution", statusCount);
        
        long todayCount = allOrders.stream()
                .filter(o -> o.getCreatedAt().toLocalDate().equals(java.time.LocalDate.now()))
                .count();
        stats.put("todayTransfers", todayCount);
        
        List<TransferValidation> allValidations = validationRepository.findAll();
        long unresolved = allValidations.stream().filter(v -> !v.getIsResolved()).count();
        stats.put("unresolvedValidations", unresolved);
        
        List<AcceptanceRecord> allAcceptances = acceptanceRepository.findAll();
        long inDispute = allAcceptances.stream().filter(a -> "DISPUTE".equals(a.getStatus())).count();
        stats.put("acceptanceDisputes", inDispute);
        
        return stats;
    }

    public String exportReportAsCsv(Long reportId) {
        TransferReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("报告不存在"));
        
        StringBuilder csv = new StringBuilder();
        csv.append("字段,值\n");
        
        try {
            Map<String, Object> data = objectMapper.readValue(report.getReportContent(), Map.class);
            flattenMap("", data, csv);
        } catch (Exception e) {
            log.error("导出CSV失败", e);
            csv.append("导出错误,").append(e.getMessage());
        }
        
        return csv.toString();
    }

    private void flattenMap(String prefix, Map<String, Object> map, StringBuilder csv) {
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String key = prefix.isEmpty() ? entry.getKey() : prefix + "." + entry.getKey();
            Object value = entry.getValue();
            
            if (value instanceof Map) {
                flattenMap(key, (Map<String, Object>) value, csv);
            } else if (value instanceof Collection) {
                csv.append(key).append(",[").append(((Collection<?>) value).size()).append(" 项]\n");
            } else {
                csv.append(key).append(",").append(value != null ? value.toString() : "").append("\n");
            }
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }

    public List<TransferReport> getReports(Long transferId) {
        return reportRepository.findByTransferId(transferId);
    }
}
