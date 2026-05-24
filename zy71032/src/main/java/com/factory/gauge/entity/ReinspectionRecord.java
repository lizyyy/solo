package com.factory.gauge.entity;

import com.factory.gauge.entity.enums.ReinspectionResult;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "reinspection_record", indexes = {
    @Index(name = "idx_reinspect_batch_id", columnList = "batchId"),
    @Index(name = "idx_reinspect_tool_id", columnList = "toolId"),
    @Index(name = "idx_reinspect_result", columnList = "result")
})
public class ReinspectionRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long batchId;

    @Column(length = 50)
    private String batchNo;

    @Column(nullable = false)
    private Long toolId;

    @Column(length = 50)
    private String toolNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReinspectionResult result;

    @Column(length = 2000)
    private String inspectionDetail;

    @Column(length = 500)
    private String defectDescription;

    @Column(nullable = false, length = 100)
    private String inspector;

    @Column(length = 100)
    private String correctedBy;

    private LocalDateTime correctionTime;

    @Column(length = 500)
    private String correctionRemark;

    @Column(nullable = false)
    private Boolean isCorrected = false;

    @Column(length = 500)
    private String remarks;

    @Column(length = 100)
    private String createdBy;

    @Column(length = 100)
    private String updatedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Integer version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getBatchId() { return batchId; }
    public void setBatchId(Long batchId) { this.batchId = batchId; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public Long getToolId() { return toolId; }
    public void setToolId(Long toolId) { this.toolId = toolId; }
    public String getToolNo() { return toolNo; }
    public void setToolNo(String toolNo) { this.toolNo = toolNo; }
    public ReinspectionResult getResult() { return result; }
    public void setResult(ReinspectionResult result) { this.result = result; }
    public String getInspectionDetail() { return inspectionDetail; }
    public void setInspectionDetail(String inspectionDetail) { this.inspectionDetail = inspectionDetail; }
    public String getDefectDescription() { return defectDescription; }
    public void setDefectDescription(String defectDescription) { this.defectDescription = defectDescription; }
    public String getInspector() { return inspector; }
    public void setInspector(String inspector) { this.inspector = inspector; }
    public String getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(String correctedBy) { this.correctedBy = correctedBy; }
    public LocalDateTime getCorrectionTime() { return correctionTime; }
    public void setCorrectionTime(LocalDateTime correctionTime) { this.correctionTime = correctionTime; }
    public String getCorrectionRemark() { return correctionRemark; }
    public void setCorrectionRemark(String correctionRemark) { this.correctionRemark = correctionRemark; }
    public Boolean getIsCorrected() { return isCorrected; }
    public void setIsCorrected(Boolean isCorrected) { this.isCorrected = isCorrected; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
}
