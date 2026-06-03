package com.aerialsurvey.service;

import com.aerialsurvey.dto.InspectionResultDTO;
import com.aerialsurvey.entity.InspectionAlert;
import com.aerialsurvey.entity.ParkingSlopeInspection;
import com.aerialsurvey.entity.SafetyRadiusTable;
import com.aerialsurvey.entity.SelfCheckRecord;
import com.aerialsurvey.enums.AlertType;
import com.aerialsurvey.enums.InspectionStatus;
import com.aerialsurvey.enums.SelfCheckResult;
import com.aerialsurvey.enums.SelfCheckType;
import com.aerialsurvey.repository.InspectionAlertRepository;
import com.aerialsurvey.repository.ParkingSlopeInspectionRepository;
import com.aerialsurvey.repository.SafetyRadiusTableRepository;
import com.aerialsurvey.repository.SelfCheckRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class SelfCheckService {

    private static final Logger log = LoggerFactory.getLogger(SelfCheckService.class);

    private final SafetyRadiusTableRepository safetyRadiusRepository;
    private final ParkingSlopeInspectionRepository inspectionRepository;
    private final SelfCheckRecordRepository selfCheckRecordRepository;
    private final InspectionAlertRepository alertRepository;
    private final UnifiedInspectionResultService unifiedResultService;
    private final ExportService exportService;

    public SelfCheckService(SafetyRadiusTableRepository safetyRadiusRepository,
                            ParkingSlopeInspectionRepository inspectionRepository,
                            SelfCheckRecordRepository selfCheckRecordRepository,
                            InspectionAlertRepository alertRepository,
                            UnifiedInspectionResultService unifiedResultService,
                            ExportService exportService) {
        this.safetyRadiusRepository = safetyRadiusRepository;
        this.inspectionRepository = inspectionRepository;
        this.selfCheckRecordRepository = selfCheckRecordRepository;
        this.alertRepository = alertRepository;
        this.unifiedResultService = unifiedResultService;
        this.exportService = exportService;
    }

    @Transactional
    public SelfCheckRecord checkDuplicateImport(String parkingLotCode,
                                                Double safetyRadius,
                                                String coordinateReference,
                                                String operator) {
        log.info("自检-重复导入检查：停车楼{}", parkingLotCode);
        SelfCheckRecord record = new SelfCheckRecord();
        record.setParkingLotCode(parkingLotCode);
        record.setCheckType(SelfCheckType.DUPLICATE_IMPORT);
        record.setOperator(operator);

        boolean exists = safetyRadiusRepository.existsByParkingLotCodeAndSafetyRadiusAndCoordinateReferenceAndIsActiveTrue(
                parkingLotCode, safetyRadius, coordinateReference);

        long count = safetyRadiusRepository.countByParkingLotCodeAndIsActiveTrue(parkingLotCode);

        if (exists) {
            record.setCheckResult(SelfCheckResult.FAILED);
            String detail = String.format("检测到重复导入：停车楼%s已存在相同的安全半径记录(%.2f, %s)，当前已有%d条有效记录",
                    parkingLotCode, safetyRadius, coordinateReference, count);
            record.setCheckDetail(detail);
            log.warn(detail);
        } else {
            record.setCheckResult(SelfCheckResult.PASSED);
            String detail = String.format("重复导入检查通过：停车楼%s暂无重复记录，当前有%d条有效记录",
                    parkingLotCode, count);
            record.setCheckDetail(detail);
            log.info(detail);
        }

        return selfCheckRecordRepository.save(record);
    }

    @Transactional
    public SelfCheckRecord checkScreenshotBlocked(String parkingLotCode, String operator) {
        log.info("自检-移动端截图遮挡告警检查：停车楼{}", parkingLotCode);
        SelfCheckRecord record = new SelfCheckRecord();
        record.setParkingLotCode(parkingLotCode);
        record.setCheckType(SelfCheckType.SCREENSHOT_BLOCKED_CHECK);
        record.setOperator(operator);

        List<ParkingSlopeInspection> blockedInspections =
                inspectionRepository.findByParkingLotCodeAndIsScreenshotBlockedTrue(parkingLotCode);

        List<String> details = new ArrayList<>();
        for (ParkingSlopeInspection inspection : blockedInspections) {
            String detail = String.format("车位[%s]移动端截图可能遮挡告警标签，需要施工经理复核",
                    inspection.getParkingSpaceNo());
            details.add(detail);

            createScreenshotBlockedAlert(inspection, operator);
        }

        if (!blockedInspections.isEmpty()) {
            record.setCheckResult(SelfCheckResult.FAILED);
            String detail = String.format("检测到%d条截图遮挡告警记录：%s",
                    blockedInspections.size(), String.join("；", details));
            record.setCheckDetail(detail);
            log.warn(detail);
        } else {
            record.setCheckResult(SelfCheckResult.PASSED);
            record.setCheckDetail("截图遮挡检查通过：所有记录截图正常");
            log.info("截图遮挡检查通过");
        }

        return selfCheckRecordRepository.save(record);
    }

    private void createScreenshotBlockedAlert(ParkingSlopeInspection inspection, String operator) {
        List<InspectionAlert> existingAlerts = alertRepository.findByInspectionId(inspection.getId());
        boolean hasBlockedAlert = existingAlerts.stream()
                .anyMatch(a -> a.getAlertType() == AlertType.SCREENSHOT_BLOCKED && !a.getIsManagerReviewed());

        if (!hasBlockedAlert) {
            InspectionAlert alert = new InspectionAlert();
            alert.setParkingLotCode(inspection.getParkingLotCode());
            alert.setInspectionId(inspection.getId());
            alert.setAlertType(AlertType.SCREENSHOT_BLOCKED);
            alert.setAlertMessage(String.format("车位[%s]移动端截图遮挡告警标签，状态保留待施工经理复核，不自动归为正常",
                    inspection.getParkingSpaceNo()));
            alert.setCreatedBy(operator);
            alertRepository.save(alert);
        }
    }

    @Transactional
    public SelfCheckRecord checkRecalculationAfterSupplement(Long inspectionId, String operator) {
        log.info("自检-补录后重算检查：检查记录{}", inspectionId);
        SelfCheckRecord record = new SelfCheckRecord();
        record.setRelatedRecordId(String.valueOf(inspectionId));
        record.setCheckType(SelfCheckType.RECALCULATION_AFTER_SUPPLEMENT);
        record.setOperator(operator);

        ParkingSlopeInspection inspection = inspectionRepository.findById(inspectionId)
                .orElseThrow(() -> new IllegalArgumentException("检查记录不存在: " + inspectionId));

        record.setParkingLotCode(inspection.getParkingLotCode());

        boolean recalculated = false;
        String detail;

        if (inspection.getSupplementedAt() != null) {
            if (inspection.getCalculatedSafeDistance() != null) {
                recalculated = true;
                detail = String.format("补录后重算检查通过：车位[%s]已补录并完成重算，计算安全距离=%.2f",
                        inspection.getParkingSpaceNo(), inspection.getCalculatedSafeDistance());
            } else {
                detail = String.format("补录后未重算：车位[%s]已补录但计算安全距离为空，请执行重算",
                        inspection.getParkingSpaceNo());
            }
        } else {
            detail = String.format("记录未补录：车位[%s]尚未进行补录操作",
                    inspection.getParkingSpaceNo());
            recalculated = true;
        }

        record.setCheckResult(recalculated ? SelfCheckResult.PASSED : SelfCheckResult.FAILED);
        record.setCheckDetail(detail);

        if (!recalculated) {
            log.warn(detail);
        } else {
            log.info(detail);
        }

        return selfCheckRecordRepository.save(record);
    }

    @Transactional
    public SelfCheckRecord checkExportConsistency(String parkingLotCode, String operator) {
        log.info("自检-导出一致性检查：停车楼{}", parkingLotCode);
        SelfCheckRecord record = new SelfCheckRecord();
        record.setParkingLotCode(parkingLotCode);
        record.setCheckType(SelfCheckType.EXPORT_CONSISTENCY);
        record.setOperator(operator);

        List<InspectionResultDTO> pageResults = unifiedResultService.getUnifiedResults(parkingLotCode);
        List<InspectionResultDTO> exportResults = exportService.getExportData(parkingLotCode);

        boolean consistent = true;
        List<String> inconsistentDetails = new ArrayList<>();

        if (pageResults.size() != exportResults.size()) {
            consistent = false;
            inconsistentDetails.add(String.format("记录数量不一致：页面显示%d条，导出%d条",
                    pageResults.size(), exportResults.size()));
        }

        for (int i = 0; i < Math.min(pageResults.size(), exportResults.size()); i++) {
            InspectionResultDTO page = pageResults.get(i);
            InspectionResultDTO export = exportResults.get(i);

            if (!compareInspectionResults(page, export)) {
                consistent = false;
                inconsistentDetails.add(String.format("车位[%s]数据不一致", page.getParkingSpaceNo()));
            }
        }

        List<InspectionResultDTO> blockedPage =
                unifiedResultService.getResultsRequiringManagerReview(parkingLotCode);
        List<InspectionResultDTO> blockedExport =
                exportService.getExportDataRequiringReview(parkingLotCode);

        if (blockedPage.size() != blockedExport.size()) {
            consistent = false;
            inconsistentDetails.add(String.format("待复核记录数量不一致：页面%d条，导出%d条",
                    blockedPage.size(), blockedExport.size()));
        }

        if (consistent) {
            record.setCheckResult(SelfCheckResult.PASSED);
            record.setCheckDetail(String.format("导出一致性检查通过：%d条记录数据一致", pageResults.size()));
            log.info("导出一致性检查通过");
        } else {
            record.setCheckResult(SelfCheckResult.FAILED);
            record.setCheckDetail("导出不一致：" + String.join("；", inconsistentDetails));
            log.warn("导出一致性检查失败：{}", record.getCheckDetail());
        }

        return selfCheckRecordRepository.save(record);
    }

    private boolean compareInspectionResults(InspectionResultDTO a, InspectionResultDTO b) {
        if (!a.getId().equals(b.getId())) return false;
        if (!a.getParkingSpaceNo().equals(b.getParkingSpaceNo())) return false;
        if (!safeEquals(a.getSlopeValue(), b.getSlopeValue())) return false;
        if (!safeEquals(a.getActualSafeDistance(), b.getActualSafeDistance())) return false;
        if (!safeEquals(a.getCalculatedSafeDistance(), b.getCalculatedSafeDistance())) return false;
        if (!safeEquals(a.getIsScreenshotBlocked(), b.getIsScreenshotBlocked())) return false;
        if (a.getStatus() != b.getStatus()) return false;
        if (!safeEquals(a.getRequiresManagerReview(), b.getRequiresManagerReview())) return false;
        return true;
    }

    private <T> boolean safeEquals(T a, T b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }

    @Transactional
    public List<SelfCheckRecord> runAllSelfChecks(String parkingLotCode, String operator) {
        log.info("执行停车楼{}的全部自检", parkingLotCode);
        List<SelfCheckRecord> results = new ArrayList<>();

        Optional<SafetyRadiusTable> latestRadius =
                safetyRadiusRepository.findTopByParkingLotCodeAndIsActiveTrueOrderByImportedAtDesc(parkingLotCode);
        if (latestRadius.isPresent()) {
            SafetyRadiusTable r = latestRadius.get();
            results.add(checkDuplicateImport(parkingLotCode, r.getSafetyRadius(),
                    r.getCoordinateReference(), operator));
        }

        results.add(checkScreenshotBlocked(parkingLotCode, operator));

        List<ParkingSlopeInspection> inspections = inspectionRepository.findByParkingLotCode(parkingLotCode);
        for (ParkingSlopeInspection inspection : inspections) {
            if (inspection.getSupplementedAt() != null) {
                results.add(checkRecalculationAfterSupplement(inspection.getId(), operator));
            }
        }

        results.add(checkExportConsistency(parkingLotCode, operator));

        return results;
    }

    @Transactional(readOnly = true)
    public List<SelfCheckRecord> getSelfCheckHistory(String parkingLotCode) {
        return selfCheckRecordRepository.findByParkingLotCode(parkingLotCode);
    }
}
