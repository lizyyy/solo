package com.hazardous.waste.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "storage_bucket")
public class StorageBucket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String bucketCode;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double maxCapacity;

    @Column(nullable = false)
    private Double currentCapacity;

    @Column(nullable = false)
    private Boolean isActive;

    private String location;

    private String remark;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isActive == null) isActive = true;
        if (currentCapacity == null) currentCapacity = 0.0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBucketCode() { return bucketCode; }
    public void setBucketCode(String bucketCode) { this.bucketCode = bucketCode; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Double getMaxCapacity() { return maxCapacity; }
    public void setMaxCapacity(Double maxCapacity) { this.maxCapacity = maxCapacity; }
    public Double getCurrentCapacity() { return currentCapacity; }
    public void setCurrentCapacity(Double currentCapacity) { this.currentCapacity = currentCapacity; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
