package com.pottery.kilnqueue.entity;

import com.pottery.kilnqueue.enums.BatchStatus;
import com.pottery.kilnqueue.enums.FiringType;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "kiln_batches")
public class KilnBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String batchNo;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FiringType firingType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BatchStatus status;

    private Integer targetTemp;

    private LocalDateTime scheduledTime;

    private LocalDateTime actualStartTime;

    private LocalDateTime actualEndTime;

    private BigDecimal maxWidth;

    private BigDecimal maxHeight;

    private BigDecimal maxDepth;

    private Integer maxWorks;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public FiringType getFiringType() { return firingType; }
    public void setFiringType(FiringType firingType) { this.firingType = firingType; }
    public BatchStatus getStatus() { return status; }
    public void setStatus(BatchStatus status) { this.status = status; }
    public Integer getTargetTemp() { return targetTemp; }
    public void setTargetTemp(Integer targetTemp) { this.targetTemp = targetTemp; }
    public LocalDateTime getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(LocalDateTime scheduledTime) { this.scheduledTime = scheduledTime; }
    public LocalDateTime getActualStartTime() { return actualStartTime; }
    public void setActualStartTime(LocalDateTime actualStartTime) { this.actualStartTime = actualStartTime; }
    public LocalDateTime getActualEndTime() { return actualEndTime; }
    public void setActualEndTime(LocalDateTime actualEndTime) { this.actualEndTime = actualEndTime; }
    public BigDecimal getMaxWidth() { return maxWidth; }
    public void setMaxWidth(BigDecimal maxWidth) { this.maxWidth = maxWidth; }
    public BigDecimal getMaxHeight() { return maxHeight; }
    public void setMaxHeight(BigDecimal maxHeight) { this.maxHeight = maxHeight; }
    public BigDecimal getMaxDepth() { return maxDepth; }
    public void setMaxDepth(BigDecimal maxDepth) { this.maxDepth = maxDepth; }
    public Integer getMaxWorks() { return maxWorks; }
    public void setMaxWorks(Integer maxWorks) { this.maxWorks = maxWorks; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
