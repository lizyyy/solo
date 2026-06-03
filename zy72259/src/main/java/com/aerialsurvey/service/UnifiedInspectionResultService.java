package com.aerialsurvey.service;

import com.aerialsurvey.dto.InspectionResultDTO;
import com.aerialsurvey.entity.InspectionAlert;
import com.aerialsurvey.entity.ParkingSlopeInspection;
import com.aerialsurvey.enums.AlertType;
import com.aerialsurvey.repository.InspectionAlertRepository;
import com.aerialsurvey.repository.ParkingSlopeInspectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UnifiedInspectionResultService {

    private static final Logger log = LoggerFactory.getLogger(UnifiedInspectionResultService.class);

    private final ParkingSlopeInspectionRepository inspectionRepository;
    private final InspectionAlertRepository alertRepository;

    public UnifiedInspectionResultService(ParkingSlopeInspectionRepository inspectionRepository,
                                          InspectionAlertRepository alertRepository) {
        this.inspectionRepository = inspectionRepository;
        this.alertRepository = alertRepository;
    }

    @Transactional(readOnly = true)
    public List<InspectionResultDTO> getUnifiedResults(String parkingLotCode) {
        log.debug("获取停车楼{}的统一检查结果", parkingLotCode);
        List<ParkingSlopeInspection> inspections = inspectionRepository.findByParkingLotCode(parkingLotCode);
        return inspections.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public InspectionResultDTO getUnifiedResultById(Long inspectionId) {
        log.debug("获取检查记录{}的统一结果", inspectionId);
        ParkingSlopeInspection inspection = inspectionRepository.findById(inspectionId)
                .orElseThrow(() -> new IllegalArgumentException("检查记录不存在: " + inspectionId));
        return convertToDTO(inspection);
    }

    @Transactional(readOnly = true)
    public List<InspectionResultDTO> getResultsRequiringManagerReview(String parkingLotCode) {
        log.debug("获取停车楼{}需要施工经理复核的记录", parkingLotCode);
        List<ParkingSlopeInspection> blockedInspections =
                inspectionRepository.findByParkingLotCodeAndIsScreenshotBlockedTrue(parkingLotCode);
        return blockedInspections.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private InspectionResultDTO convertToDTO(ParkingSlopeInspection inspection) {
        InspectionResultDTO dto = new InspectionResultDTO();
        dto.setId(inspection.getId());
        dto.setParkingLotCode(inspection.getParkingLotCode());
        dto.setParkingSpaceNo(inspection.getParkingSpaceNo());
        dto.setSlopeValue(inspection.getSlopeValue());
        dto.setMaxAllowedSlope(inspection.getMaxAllowedSlope());
        dto.setActualSafeDistance(inspection.getActualSafeDistance());
        dto.setCalculatedSafeDistance(inspection.getCalculatedSafeDistance());
        dto.setCoordinateX(inspection.getCoordinateX());
        dto.setCoordinateY(inspection.getCoordinateY());
        dto.setStatus(inspection.getStatus());
        dto.setRemark(inspection.getRemark());
        dto.setScreenshotPath(inspection.getScreenshotPath());
        dto.setIsScreenshotBlocked(inspection.getIsScreenshotBlocked());
        dto.setReviewedBy(inspection.getReviewedBy());
        dto.setReviewedAt(inspection.getReviewedAt());
        dto.setSupplementedBy(inspection.getSupplementedBy());
        dto.setSupplementedAt(inspection.getSupplementedAt());
        dto.setCreatedBy(inspection.getCreatedBy());
        dto.setCreatedAt(inspection.getCreatedAt());

        List<String> alertMessages = new ArrayList<>();
        List<InspectionAlert> alerts = alertRepository.findByInspectionId(inspection.getId());
        boolean requiresReview = false;

        for (InspectionAlert alert : alerts) {
            alertMessages.add(alert.getAlertMessage());
            if (alert.getAlertType() == AlertType.SCREENSHOT_BLOCKED && !alert.getIsManagerReviewed()) {
                requiresReview = true;
            }
            if (alert.getAlertType() == AlertType.DATA_CONFLICT && !alert.getIsManagerReviewed()) {
                requiresReview = true;
            }
        }

        if (Boolean.TRUE.equals(inspection.getIsScreenshotBlocked())) {
            requiresReview = true;
        }

        dto.setAlertMessages(alertMessages);
        dto.setRequiresManagerReview(requiresReview);

        return dto;
    }
}
