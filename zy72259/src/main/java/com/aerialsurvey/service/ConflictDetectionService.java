package com.aerialsurvey.service;

import com.aerialsurvey.dto.ConflictDetectionDTO;
import com.aerialsurvey.dto.ConflictHandleDTO;
import com.aerialsurvey.entity.ConflictRecord;
import com.aerialsurvey.entity.CoordinateOriginSpec;
import com.aerialsurvey.entity.InspectionAlert;
import com.aerialsurvey.entity.SafetyRadiusTable;
import com.aerialsurvey.enums.AlertType;
import com.aerialsurvey.enums.ConflictStatus;
import com.aerialsurvey.repository.ConflictRecordRepository;
import com.aerialsurvey.repository.CoordinateOriginSpecRepository;
import com.aerialsurvey.repository.InspectionAlertRepository;
import com.aerialsurvey.repository.SafetyRadiusTableRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ConflictDetectionService {

    private static final Logger log = LoggerFactory.getLogger(ConflictDetectionService.class);

    private final SafetyRadiusTableRepository safetyRadiusRepository;
    private final CoordinateOriginSpecRepository coordinateOriginRepository;
    private final ConflictRecordRepository conflictRecordRepository;
    private final InspectionAlertRepository alertRepository;

    public ConflictDetectionService(SafetyRadiusTableRepository safetyRadiusRepository,
                                    CoordinateOriginSpecRepository coordinateOriginRepository,
                                    ConflictRecordRepository conflictRecordRepository,
                                    InspectionAlertRepository alertRepository) {
        this.safetyRadiusRepository = safetyRadiusRepository;
        this.coordinateOriginRepository = coordinateOriginRepository;
        this.conflictRecordRepository = conflictRecordRepository;
        this.alertRepository = alertRepository;
    }

    @Transactional
    public List<ConflictDetectionDTO> detectConflicts(String parkingLotCode, String operator) {
        log.info("检测停车楼{}的安全半径表与坐标原点说明冲突", parkingLotCode);

        Optional<SafetyRadiusTable> radiusOpt =
                safetyRadiusRepository.findTopByParkingLotCodeAndIsActiveTrueOrderByImportedAtDesc(parkingLotCode);
        Optional<CoordinateOriginSpec> originOpt =
                coordinateOriginRepository.findTopByParkingLotCodeAndIsActiveTrueOrderByReviewedAtDesc(parkingLotCode);

        if (radiusOpt.isEmpty() || originOpt.isEmpty()) {
            log.warn("停车楼{}缺少安全半径表或坐标原点说明，无法检测冲突", parkingLotCode);
            return new ArrayList<>();
        }

        SafetyRadiusTable radius = radiusOpt.get();
        CoordinateOriginSpec origin = originOpt.get();

        List<String> evidences = new ArrayList<>();
        StringBuilder description = new StringBuilder();

        if (!radius.getCoordinateReference().equalsIgnoreCase(origin.getCoordinateSystem())) {
            String evidence = String.format("坐标系不匹配：安全半径表使用[%s]，坐标原点说明使用[%s]",
                    radius.getCoordinateReference(), origin.getCoordinateSystem());
            evidences.add(evidence);
            description.append("坐标系不一致；");
        }

        if (radius.getSafetyRadius() <= 0) {
            String evidence = String.format("安全半径值异常：安全半径表值为[%.2f]，应为正数",
                    radius.getSafetyRadius());
            evidences.add(evidence);
            description.append("安全半径值异常；");
        }

        if ((origin.getOriginX() == null || origin.getOriginY() == null) &&
                (radius.getCoordinateReference().contains("投影") ||
                        radius.getCoordinateReference().toUpperCase().contains("UTM"))) {
            String evidence = "投影坐标系下缺少具体原点坐标值，但安全半径计算需要精确坐标基准";
            evidences.add(evidence);
            description.append("原点坐标缺失但坐标系要求精确基准；");
        }

        String radiusRef = radius.getCoordinateReference().toUpperCase();
        String originPoint = origin.getOriginPoint().toUpperCase();
        if ((radiusRef.contains("WGS84") || radiusRef.contains("GPS")) &&
                (originPoint.contains("楼角") || originPoint.contains("墙角"))) {
            String evidence = String.format("基准点类型矛盾：安全半径表基于[%s]全球坐标系，" +
                            "但坐标原点说明以建筑局部[%s]为基准",
                    radius.getCoordinateReference(), origin.getOriginPoint());
            evidences.add(evidence);
            description.append("基准点类型矛盾；");
        }

        if (!evidences.isEmpty()) {
            ConflictRecord record = new ConflictRecord();
            record.setParkingLotCode(parkingLotCode);
            record.setSafetyRadiusTableId(radius.getId());
            record.setCoordinateOriginSpecId(origin.getId());
            record.setConflictDescription(description.toString());
            record.setConflictEvidences(evidences);
            record.setDetectedBy(operator);
            conflictRecordRepository.save(record);

            createConflictAlert(parkingLotCode, radius, origin, evidences, operator);

            log.info("停车楼{}检测到{}个冲突点", parkingLotCode, evidences.size());
        }

        return getConflictsByParkingLotCode(parkingLotCode);
    }

    private void createConflictAlert(String parkingLotCode, SafetyRadiusTable radius,
                                     CoordinateOriginSpec origin, List<String> evidences, String operator) {
        InspectionAlert alert = new InspectionAlert();
        alert.setParkingLotCode(parkingLotCode);
        alert.setAlertType(AlertType.DATA_CONFLICT);
        alert.setAlertMessage("安全半径表与坐标原点说明存在冲突：" + String.join("；", evidences));
        alert.setCreatedBy(operator);
        alertRepository.save(alert);
    }

    @Transactional(readOnly = true)
    public List<ConflictDetectionDTO> getConflictsByParkingLotCode(String parkingLotCode) {
        return conflictRecordRepository.findByParkingLotCode(parkingLotCode).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ConflictDetectionDTO> getPendingConflicts(String parkingLotCode) {
        return conflictRecordRepository.findByParkingLotCodeAndStatus(
                        parkingLotCode, ConflictStatus.PENDING_CONFIRM).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ConflictDetectionDTO handleConflict(ConflictHandleDTO dto) {
        log.info("处理冲突记录{}，操作人：{}，状态：{}",
                dto.getConflictId(), dto.getHandledBy(), dto.getStatus());

        if (dto.getStatus() != ConflictStatus.CONFIRMED && dto.getStatus() != ConflictStatus.REJECTED) {
            throw new IllegalArgumentException("处理状态只能是CONFIRMED或REJECTED");
        }

        ConflictRecord record = conflictRecordRepository.findById(dto.getConflictId())
                .orElseThrow(() -> new IllegalArgumentException("冲突记录不存在: " + dto.getConflictId()));

        if (record.getStatus() != ConflictStatus.PENDING_CONFIRM) {
            throw new IllegalStateException("该冲突已处理，不可重复操作");
        }

        record.setStatus(dto.getStatus());
        record.setHandledBy(dto.getHandledBy());
        record.setHandledAt(LocalDateTime.now());
        record.setHandlingRemark(dto.getHandlingRemark());
        conflictRecordRepository.save(record);

        updateConflictAlerts(record.getParkingLotCode(), dto.getStatus());

        return convertToDTO(record);
    }

    private void updateConflictAlerts(String parkingLotCode, ConflictStatus status) {
        List<InspectionAlert> alerts = alertRepository
                .findByParkingLotCodeAndAlertType(parkingLotCode, AlertType.DATA_CONFLICT);
        for (InspectionAlert alert : alerts) {
            if (!alert.getIsManagerReviewed()) {
                alert.setIsManagerReviewed(true);
                alert.setReviewedAt(LocalDateTime.now());
                alert.setManagerReviewRemark("冲突已" +
                        (status == ConflictStatus.CONFIRMED ? "确认" : "驳回"));
            }
        }
        alertRepository.saveAll(alerts);
    }

    private ConflictDetectionDTO convertToDTO(ConflictRecord record) {
        ConflictDetectionDTO dto = new ConflictDetectionDTO();
        dto.setId(record.getId());
        dto.setParkingLotCode(record.getParkingLotCode());
        dto.setSafetyRadiusTableId(record.getSafetyRadiusTableId());
        dto.setCoordinateOriginSpecId(record.getCoordinateOriginSpecId());
        dto.setConflictDescription(record.getConflictDescription());
        dto.setConflictEvidences(record.getConflictEvidences());
        dto.setStatus(record.getStatus());
        dto.setDetectedBy(record.getDetectedBy());
        dto.setDetectedAt(record.getDetectedAt());

        if (record.getSafetyRadiusTableId() != null) {
            safetyRadiusRepository.findById(record.getSafetyRadiusTableId()).ifPresent(r -> {
                dto.setSafetyRadiusValue(r.getSafetyRadius());
                dto.setRadiusCoordinateReference(r.getCoordinateReference());
            });
        }
        if (record.getCoordinateOriginSpecId() != null) {
            coordinateOriginRepository.findById(record.getCoordinateOriginSpecId()).ifPresent(o -> {
                dto.setOriginPoint(o.getOriginPoint());
                dto.setOriginCoordinateSystem(o.getCoordinateSystem());
            });
        }

        return dto;
    }
}
