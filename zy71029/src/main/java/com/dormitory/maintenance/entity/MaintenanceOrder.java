package com.dormitory.maintenance.entity;

import com.dormitory.maintenance.enums.MaintenanceStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "maintenance_order")
public class MaintenanceOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String orderNo;

    private String batchNo;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "building_id", nullable = false)
    private DormBuilding building;

    private String roomNo;

    private String location;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "team_id")
    private ConstructionTeam team;

    @Column(nullable = false)
    private LocalDateTime scheduledStartTime;

    @Column(nullable = false)
    private LocalDateTime scheduledEndTime;

    private LocalDateTime actualStartTime;

    private LocalDateTime actualEndTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MaintenanceStatus status = MaintenanceStatus.PENDING_SUBMIT;

    private String priority;

    private String category;

    private Boolean isEmergency = false;

    private String applicant;

    private String applicantPhone;

    private String auditor;

    private LocalDateTime auditTime;

    private String auditRemark;

    @Column(length = 1000)
    private String validationResult;

    private Boolean hasConflict = false;

    @Column(length = 2000)
    private String conflictDetail;

    @Column(length = 500)
    private String remark;

    private Boolean overTimeRequested = false;

    @Column(length = 500)
    private String overTimeReason;

    private Boolean overTimeApproved;

    private String overTimeApprover;

    private LocalDateTime overTimeApproveTime;

    @Column(length = 500)
    private String overTimeApproveRemark;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public DormBuilding getBuilding() { return building; }
    public void setBuilding(DormBuilding building) { this.building = building; }
    public String getRoomNo() { return roomNo; }
    public void setRoomNo(String roomNo) { this.roomNo = roomNo; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public ConstructionTeam getTeam() { return team; }
    public void setTeam(ConstructionTeam team) { this.team = team; }
    public LocalDateTime getScheduledStartTime() { return scheduledStartTime; }
    public void setScheduledStartTime(LocalDateTime scheduledStartTime) { this.scheduledStartTime = scheduledStartTime; }
    public LocalDateTime getScheduledEndTime() { return scheduledEndTime; }
    public void setScheduledEndTime(LocalDateTime scheduledEndTime) { this.scheduledEndTime = scheduledEndTime; }
    public LocalDateTime getActualStartTime() { return actualStartTime; }
    public void setActualStartTime(LocalDateTime actualStartTime) { this.actualStartTime = actualStartTime; }
    public LocalDateTime getActualEndTime() { return actualEndTime; }
    public void setActualEndTime(LocalDateTime actualEndTime) { this.actualEndTime = actualEndTime; }
    public MaintenanceStatus getStatus() { return status; }
    public void setStatus(MaintenanceStatus status) { this.status = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Boolean getIsEmergency() { return isEmergency; }
    public void setIsEmergency(Boolean isEmergency) { this.isEmergency = isEmergency; }
    public String getApplicant() { return applicant; }
    public void setApplicant(String applicant) { this.applicant = applicant; }
    public String getApplicantPhone() { return applicantPhone; }
    public void setApplicantPhone(String applicantPhone) { this.applicantPhone = applicantPhone; }
    public String getAuditor() { return auditor; }
    public void setAuditor(String auditor) { this.auditor = auditor; }
    public LocalDateTime getAuditTime() { return auditTime; }
    public void setAuditTime(LocalDateTime auditTime) { this.auditTime = auditTime; }
    public String getAuditRemark() { return auditRemark; }
    public void setAuditRemark(String auditRemark) { this.auditRemark = auditRemark; }
    public String getValidationResult() { return validationResult; }
    public void setValidationResult(String validationResult) { this.validationResult = validationResult; }
    public Boolean getHasConflict() { return hasConflict; }
    public void setHasConflict(Boolean hasConflict) { this.hasConflict = hasConflict; }
    public String getConflictDetail() { return conflictDetail; }
    public void setConflictDetail(String conflictDetail) { this.conflictDetail = conflictDetail; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public Boolean getOverTimeRequested() { return overTimeRequested; }
    public void setOverTimeRequested(Boolean overTimeRequested) { this.overTimeRequested = overTimeRequested; }
    public String getOverTimeReason() { return overTimeReason; }
    public void setOverTimeReason(String overTimeReason) { this.overTimeReason = overTimeReason; }
    public Boolean getOverTimeApproved() { return overTimeApproved; }
    public void setOverTimeApproved(Boolean overTimeApproved) { this.overTimeApproved = overTimeApproved; }
    public String getOverTimeApprover() { return overTimeApprover; }
    public void setOverTimeApprover(String overTimeApprover) { this.overTimeApprover = overTimeApprover; }
    public LocalDateTime getOverTimeApproveTime() { return overTimeApproveTime; }
    public void setOverTimeApproveTime(LocalDateTime overTimeApproveTime) { this.overTimeApproveTime = overTimeApproveTime; }
    public String getOverTimeApproveRemark() { return overTimeApproveRemark; }
    public void setOverTimeApproveRemark(String overTimeApproveRemark) { this.overTimeApproveRemark = overTimeApproveRemark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
