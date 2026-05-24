package com.ortho.rework.dto;

import com.ortho.rework.entity.ReworkOrder;
import com.ortho.rework.enums.ReworkStatus;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ReworkDetailDTO {
    private String reworkNo;
    private String patientNo;
    private String patientName;
    private String batchNo;
    private String impressionType;
    private ReworkStatus status;
    private String statusDescription;
    private String reworkReason;
    private String technicianNote;
    private LocalDateTime technicianNoteTime;
    private String technicianName;
    private String doctorConfirmation;
    private LocalDateTime doctorConfirmationTime;
    private String doctorName;
    private LocalDateTime receivedTime;
    private String receivedBy;
    private LocalDateTime inspectionTime;
    private String inspectionResult;
    private String inspectionRemark;
    private LocalDateTime reviewTime;
    private String reviewResult;
    private LocalDateTime shippedTime;
    private String expressNo;
    private LocalDateTime closedTime;
    private String closeReason;
    private Integer reworkCount;
    private Boolean isDuplicate;
    private List<AuditLogDTO> auditLogs;

    public static ReworkDetailDTO fromEntity(ReworkOrder order) {
        ReworkDetailDTO dto = new ReworkDetailDTO();
        dto.setReworkNo(order.getReworkNo());
        dto.setPatientNo(order.getPatient().getPatientNo());
        dto.setPatientName(order.getPatient().getName());
        dto.setBatchNo(order.getBatch().getBatchNo());
        dto.setImpressionType(order.getBatch().getImpressionType());
        dto.setStatus(order.getStatus());
        dto.setStatusDescription(order.getStatus().getDescription());
        dto.setReworkReason(order.getReworkReason());
        dto.setTechnicianNote(order.getTechnicianNote());
        dto.setTechnicianNoteTime(order.getTechnicianNoteTime());
        dto.setTechnicianName(order.getTechnicianName());
        dto.setDoctorConfirmation(order.getDoctorConfirmation());
        dto.setDoctorConfirmationTime(order.getDoctorConfirmationTime());
        dto.setDoctorName(order.getDoctorName());
        dto.setReceivedTime(order.getReceivedTime());
        dto.setReceivedBy(order.getReceivedBy());
        dto.setInspectionTime(order.getInspectionTime());
        dto.setInspectionResult(order.getInspectionResult());
        dto.setInspectionRemark(order.getInspectionRemark());
        dto.setReviewTime(order.getReviewTime());
        dto.setReviewResult(order.getReviewResult());
        dto.setShippedTime(order.getShippedTime());
        dto.setClosedTime(order.getClosedTime());
        dto.setCloseReason(order.getCloseReason());
        dto.setReworkCount(order.getBatch().getReworkCount());
        dto.setIsDuplicate(order.getIsDuplicate());
        return dto;
    }
}
