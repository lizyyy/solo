package com.aerialsurvey.service;

import com.aerialsurvey.dto.*;
import com.aerialsurvey.entity.*;
import com.aerialsurvey.enums.ConflictStatus;
import com.aerialsurvey.enums.InspectionStatus;
import com.aerialsurvey.enums.ProcessStep;
import com.aerialsurvey.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ParkingSlopeInspectionService {

    private static final Logger log = LoggerFactory.getLogger(ParkingSlopeInspectionService.class);

    private final SafetyRadiusTableRepository safetyRadiusRepository;
    private final CoordinateOriginSpecRepository coordinateOriginRepository;
    private final ParkingSlopeInspectionRepository inspectionRepository;
    private final ProcessTraceRepository processTraceRepository;
    private final InspectionAlertRepository alertRepository;
    private final ConflictRecordRepository conflictRecordRepository;
    private final ConflictDetectionService conflictDetectionService;
    private final SelfCheckService selfCheckService;

    public ParkingSlopeInspectionService(SafetyRadiusTableRepository safetyRadiusRepository,
                                         CoordinateOriginSpecRepository coordinateOriginRepository,
                                         ParkingSlopeInspectionRepository inspectionRepository,
                                         ProcessTraceRepository processTraceRepository,
                                         InspectionAlertRepository alertRepository,
                                         ConflictRecordRepository conflictRecordRepository,
                                         ConflictDetectionService conflictDetectionService,
                                         SelfCheckService selfCheckService) {
        this.safetyRadiusRepository = safetyRadiusRepository;
        this.coordinateOriginRepository = coordinateOriginRepository;
        this.inspectionRepository = inspectionRepository;
        this.processTraceRepository = processTraceRepository;
        this.alertRepository = alertRepository;
        this.conflictRecordRepository = conflictRecordRepository;
        this.conflictDetectionService = conflictDetectionService;
        this.selfCheckService = selfCheckService;
    }

    @Transactional
    public SafetyRadiusTable importSafetyRadiusTable(SafetyRadiusImportDTO dto) {
        log.info("第一步-导入安全半径表：停车楼{}，操作人{}", dto.getParkingLotCode(), dto.getImportedBy());

        selfCheckService.checkDuplicateImport(
                dto.getParkingLotCode(), dto.getSafetyRadius(),
                dto.getCoordinateReference(), dto.getImportedBy());

        SafetyRadiusTable table = new SafetyRadiusTable();
        table.setParkingLotCode(dto.getParkingLotCode());
        table.setSafetyRadius(dto.getSafetyRadius());
        table.setCoordinateReference(dto.getCoordinateReference());
        table.setRadiusUnit(dto.getRadiusUnit());
        table.setDescription(dto.getDescription());
        table.setImportedBy(dto.getImportedBy());
        table = safetyRadiusRepository.save(table);

        recordProcessStep(dto.getParkingLotCode(), ProcessStep.IMPORT_SAFETY_RADIUS,
                table.getId(), dto.getImportedBy(), "安全半径表导入完成，半径=" + dto.getSafetyRadius());

        log.info("安全半径表导入成功，ID={}", table.getId());
        return table;
    }

    @Transactional
    public CoordinateOriginSpec reviewCoordinateOrigin(CoordinateOriginReviewDTO dto) {
        log.info("第二步-补看坐标原点说明：停车楼{}，操作人{}", dto.getParkingLotCode(), dto.getReviewedBy());

        if (!processTraceRepository.existsByParkingLotCodeAndProcessStep(
                dto.getParkingLotCode(), ProcessStep.IMPORT_SAFETY_RADIUS)) {
            throw new IllegalStateException("请先完成第一步：安全半径表导入");
        }

        CoordinateOriginSpec spec = new CoordinateOriginSpec();
        spec.setParkingLotCode(dto.getParkingLotCode());
        spec.setOriginPoint(dto.getOriginPoint());
        spec.setCoordinateSystem(dto.getCoordinateSystem());
        spec.setOriginX(dto.getOriginX());
        spec.setOriginY(dto.getOriginY());
        spec.setOriginZ(dto.getOriginZ());
        spec.setReferenceDescription(dto.getReferenceDescription());
        spec.setReviewedBy(dto.getReviewedBy());
        spec = coordinateOriginRepository.save(spec);

        recordProcessStep(dto.getParkingLotCode(), ProcessStep.REVIEW_COORDINATE_ORIGIN,
                spec.getId(), dto.getReviewedBy(), "坐标原点说明补看完成");

        conflictDetectionService.detectConflicts(dto.getParkingLotCode(), dto.getReviewedBy());

        log.info("坐标原点说明补看完成，ID={}", spec.getId());
        return spec;
    }

    @Transactional
    public ParkingSlopeInspection createSlopeInspection(SlopeInspectionDTO dto) {
        log.info("创建车位坡度检查记录：车位{}，操作人{}", dto.getParkingSpaceNo(), dto.getCreatedBy());

        if (!processTraceRepository.existsByParkingLotCodeAndProcessStep(
                dto.getParkingLotCode(), ProcessStep.REVIEW_COORDINATE_ORIGIN)) {
            throw new IllegalStateException("请先完成第二步：坐标原点说明补看");
        }

        if (inspectionRepository.existsByParkingLotCodeAndParkingSpaceNo(
                dto.getParkingLotCode(), dto.getParkingSpaceNo())) {
            throw new IllegalArgumentException("该车位检查记录已存在：" + dto.getParkingSpaceNo());
        }

        ParkingSlopeInspection inspection = new ParkingSlopeInspection();
        inspection.setParkingLotCode(dto.getParkingLotCode());
        inspection.setParkingSpaceNo(dto.getParkingSpaceNo());
        inspection.setSlopeValue(dto.getSlopeValue());
        inspection.setMaxAllowedSlope(dto.getMaxAllowedSlope());
        inspection.setActualSafeDistance(dto.getActualSafeDistance());
        inspection.setCoordinateX(dto.getCoordinateX());
        inspection.setCoordinateY(dto.getCoordinateY());
        inspection.setRemark(dto.getRemark());
        inspection.setScreenshotPath(dto.getScreenshotPath());
        inspection.setIsScreenshotBlocked(dto.getIsScreenshotBlocked());
        inspection.setCreatedBy(dto.getCreatedBy());

        if (Boolean.TRUE.equals(dto.getIsScreenshotBlocked())) {
            inspection.setStatus(InspectionStatus.PENDING_REVIEW);
            log.warn("车位{}移动端截图遮挡告警标签，状态设为待施工经理复核，不自动归正常",
                    dto.getParkingSpaceNo());
        } else if (dto.getSlopeValue() > dto.getMaxAllowedSlope()) {
            inspection.setStatus(InspectionStatus.PENDING_REVIEW);
        } else {
            inspection.setStatus(InspectionStatus.COMPLETED);
        }

        Optional<SafetyRadiusTable> radiusOpt = safetyRadiusRepository
                .findTopByParkingLotCodeAndIsActiveTrueOrderByImportedAtDesc(dto.getParkingLotCode());
        if (radiusOpt.isPresent() && dto.getActualSafeDistance() != null) {
            Double safetyRadius = radiusOpt.get().getSafetyRadius();
            inspection.setCalculatedSafeDistance(calculateSafeDistance(
                    dto.getSlopeValue(), safetyRadius, dto.getActualSafeDistance()));
        }

        inspection = inspectionRepository.save(inspection);

        if (Boolean.TRUE.equals(dto.getIsScreenshotBlocked())) {
            selfCheckService.checkScreenshotBlocked(dto.getParkingLotCode(), dto.getCreatedBy());
        }

        log.info("车位坡度检查记录创建成功，ID={}，状态={}", inspection.getId(), inspection.getStatus());
        return inspection;
    }

    @Transactional
    public ParkingSlopeInspection supplementInspection(SupplementInspectionDTO dto) {
        log.info("补录检查记录：ID={}，操作人{}", dto.getInspectionId(), dto.getSupplementedBy());

        ParkingSlopeInspection inspection = inspectionRepository.findById(dto.getInspectionId())
                .orElseThrow(() -> new IllegalArgumentException("检查记录不存在: " + dto.getInspectionId()));

        if (dto.getActualSafeDistance() != null) {
            inspection.setActualSafeDistance(dto.getActualSafeDistance());
        }
        if (dto.getCoordinateX() != null) {
            inspection.setCoordinateX(dto.getCoordinateX());
        }
        if (dto.getCoordinateY() != null) {
            inspection.setCoordinateY(dto.getCoordinateY());
        }
        if (dto.getRemark() != null) {
            inspection.setRemark(dto.getRemark());
        }
        if (dto.getScreenshotPath() != null) {
            inspection.setScreenshotPath(dto.getScreenshotPath());
        }
        if (dto.getIsScreenshotBlocked() != null) {
            inspection.setIsScreenshotBlocked(dto.getIsScreenshotBlocked());
        }

        inspection.setSupplementedBy(dto.getSupplementedBy());
        inspection.setSupplementedAt(LocalDateTime.now());

        Optional<SafetyRadiusTable> radiusOpt = safetyRadiusRepository
                .findTopByParkingLotCodeAndIsActiveTrueOrderByImportedAtDesc(inspection.getParkingLotCode());
        if (radiusOpt.isPresent() && inspection.getActualSafeDistance() != null) {
            Double safetyRadius = radiusOpt.get().getSafetyRadius();
            inspection.setCalculatedSafeDistance(calculateSafeDistance(
                    inspection.getSlopeValue(), safetyRadius, inspection.getActualSafeDistance()));
            log.info("补录后自动重算安全距离，车位{}，计算结果={}",
                    inspection.getParkingSpaceNo(), inspection.getCalculatedSafeDistance());
        }

        if (Boolean.TRUE.equals(dto.getIsScreenshotBlocked())) {
            inspection.setStatus(InspectionStatus.PENDING_REVIEW);
            log.warn("车位{}补录后仍标记截图遮挡，状态保留待施工经理复核", inspection.getParkingSpaceNo());
            selfCheckService.checkScreenshotBlocked(inspection.getParkingLotCode(), dto.getSupplementedBy());
        } else if (inspection.getIsScreenshotBlocked()) {
            inspection.setStatus(InspectionStatus.PENDING_REVIEW);
            log.warn("车位{}原截图遮挡标记未清除，状态仍待复核", inspection.getParkingSpaceNo());
        }

        inspection = inspectionRepository.save(inspection);
        selfCheckService.checkRecalculationAfterSupplement(inspection.getId(), dto.getSupplementedBy());

        log.info("补录完成，记录ID={}", inspection.getId());
        return inspection;
    }

    @Transactional
    public String updateSafetyReport(String parkingLotCode, String operator) {
        log.info("第三步-更新安全距离报告：停车楼{}，操作人{}", parkingLotCode, operator);

        if (!processTraceRepository.existsByParkingLotCodeAndProcessStep(
                parkingLotCode, ProcessStep.REVIEW_COORDINATE_ORIGIN)) {
            throw new IllegalStateException("请先完成第二步：坐标原点说明补看");
        }

        if (conflictRecordRepository.existsByParkingLotCodeAndStatus(
                parkingLotCode, ConflictStatus.PENDING_CONFIRM)) {
            throw new IllegalStateException("存在待确认的冲突记录，请先通过确认或驳回后再更新安全距离报告");
        }

        List<ParkingSlopeInspection> inspections = inspectionRepository.findByParkingLotCode(parkingLotCode);
        int updatedCount = 0;

        Optional<SafetyRadiusTable> radiusOpt = safetyRadiusRepository
                .findTopByParkingLotCodeAndIsActiveTrueOrderByImportedAtDesc(parkingLotCode);
        if (radiusOpt.isPresent()) {
            Double safetyRadius = radiusOpt.get().getSafetyRadius();
            for (ParkingSlopeInspection inspection : inspections) {
                if (inspection.getActualSafeDistance() != null && inspection.getCalculatedSafeDistance() == null) {
                    inspection.setCalculatedSafeDistance(calculateSafeDistance(
                            inspection.getSlopeValue(), safetyRadius, inspection.getActualSafeDistance()));
                    updatedCount++;
                }
            }
            inspectionRepository.saveAll(inspections);
        }

        selfCheckService.checkExportConsistency(parkingLotCode, operator);

        recordProcessStep(parkingLotCode, ProcessStep.UPDATE_SAFETY_REPORT,
                null, operator, "安全距离报告更新完成，更新记录数=" + updatedCount);

        String result = String.format("安全距离报告更新完成，共处理%d条记录，更新%d条计算安全距离",
                inspections.size(), updatedCount);
        log.info(result);
        return result;
    }

    @Transactional
    public InspectionAlert handleManagerReview(ManagerReviewDTO dto) {
        log.info("施工经理复核：告警ID={}，操作人{}", dto.getAlertId(), dto.getReviewedBy());

        InspectionAlert alert = alertRepository.findById(dto.getAlertId())
                .orElseThrow(() -> new IllegalArgumentException("告警记录不存在: " + dto.getAlertId()));

        if (alert.getIsManagerReviewed()) {
            throw new IllegalStateException("该告警已完成复核，不可重复操作");
        }

        alert.setIsManagerReviewed(true);
        alert.setManagerReviewRemark(dto.getReviewRemark());
        alert.setReviewedBy(dto.getReviewedBy());
        alert.setReviewedAt(LocalDateTime.now());
        alert.setResolvedStatus(dto.getResolvedStatus());

        if (alert.getInspectionId() != null) {
            ParkingSlopeInspection inspection = inspectionRepository.findById(alert.getInspectionId())
                    .orElseThrow(() -> new IllegalArgumentException("关联检查记录不存在"));
            inspection.setStatus(dto.getResolvedStatus());
            inspection.setReviewedBy(dto.getReviewedBy());
            inspection.setReviewedAt(LocalDateTime.now());

            if (dto.getResolvedStatus() == InspectionStatus.COMPLETED) {
                inspection.setIsScreenshotBlocked(false);
            }

            inspectionRepository.save(inspection);
            log.info("车位{}状态已更新为{}", inspection.getParkingSpaceNo(), dto.getResolvedStatus());
        }

        alertRepository.save(alert);
        log.info("施工经理复核完成，告警ID={}", dto.getAlertId());
        return alert;
    }

    @Transactional(readOnly = true)
    public List<ProcessTrace> getProcessTrace(String parkingLotCode) {
        return processTraceRepository.findByParkingLotCodeOrderByOperatedAtAsc(parkingLotCode);
    }

    @Transactional(readOnly = true)
    public List<InspectionAlert> getPendingManagerReviews(String parkingLotCode) {
        return alertRepository.findByParkingLotCodeAndIsManagerReviewedFalse(parkingLotCode);
    }

    @Transactional(readOnly = true)
    public Optional<SafetyRadiusTable> getLatestSafetyRadius(String parkingLotCode) {
        return safetyRadiusRepository.findTopByParkingLotCodeAndIsActiveTrueOrderByImportedAtDesc(parkingLotCode);
    }

    @Transactional(readOnly = true)
    public Optional<CoordinateOriginSpec> getLatestCoordinateOrigin(String parkingLotCode) {
        return coordinateOriginRepository.findTopByParkingLotCodeAndIsActiveTrueOrderByReviewedAtDesc(parkingLotCode);
    }

    private Double calculateSafeDistance(Double slope, Double safetyRadius, Double actualDistance) {
        if (slope == null || safetyRadius == null || actualDistance == null) {
            return null;
        }
        double slopeRad = Math.toRadians(slope);
        double horizontalComponent = actualDistance * Math.cos(slopeRad);
        double verticalComponent = actualDistance * Math.sin(slopeRad);
        double correctedDistance = Math.sqrt(
                Math.pow(horizontalComponent, 2) + Math.pow(verticalComponent * 0.8, 2));
        return Math.max(correctedDistance, safetyRadius * 0.9);
    }

    private void recordProcessStep(String parkingLotCode, ProcessStep step,
                                   Long relatedRecordId, String operator, String remark) {
        ProcessTrace trace = new ProcessTrace();
        trace.setParkingLotCode(parkingLotCode);
        trace.setProcessStep(step);
        trace.setRelatedRecordId(relatedRecordId);
        trace.setOperator(operator);
        trace.setRemark(remark);
        processTraceRepository.save(trace);
    }
}
