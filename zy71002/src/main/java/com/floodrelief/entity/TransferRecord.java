package com.floodrelief.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "transfer_record")
public class TransferRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long shelterId;

    @Column(nullable = false)
    private Integer totalCount;

    private Integer elderlyCount;

    private Integer childrenCount;

    private Integer disabledCount;

    private String reporter;

    @Column(length = 1000)
    private String remark;

    private Boolean manualCorrection = false;

    private String correctedBy;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getShelterId() { return shelterId; }
    public void setShelterId(Long shelterId) { this.shelterId = shelterId; }
    public Integer getTotalCount() { return totalCount; }
    public void setTotalCount(Integer totalCount) { this.totalCount = totalCount; }
    public Integer getElderlyCount() { return elderlyCount; }
    public void setElderlyCount(Integer elderlyCount) { this.elderlyCount = elderlyCount; }
    public Integer getChildrenCount() { return childrenCount; }
    public void setChildrenCount(Integer childrenCount) { this.childrenCount = childrenCount; }
    public Integer getDisabledCount() { return disabledCount; }
    public void setDisabledCount(Integer disabledCount) { this.disabledCount = disabledCount; }
    public String getReporter() { return reporter; }
    public void setReporter(String reporter) { this.reporter = reporter; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public Boolean getManualCorrection() { return manualCorrection; }
    public void setManualCorrection(Boolean manualCorrection) { this.manualCorrection = manualCorrection; }
    public String getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(String correctedBy) { this.correctedBy = correctedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
