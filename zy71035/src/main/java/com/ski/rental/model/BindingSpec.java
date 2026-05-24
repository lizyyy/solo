package com.ski.rental.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "binding_specs")
public class BindingSpec {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String bindingModel;
    private BigDecimal minReleaseValue;
    private BigDecimal maxReleaseValue;
    private Integer minBootSize;
    private Integer maxBootSize;
    private BigDecimal recommendedHeightMin;
    private BigDecimal recommendedHeightMax;
    private BigDecimal recommendedWeightMin;
    private BigDecimal recommendedWeightMax;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBindingModel() {
        return bindingModel;
    }

    public void setBindingModel(String bindingModel) {
        this.bindingModel = bindingModel;
    }

    public BigDecimal getMinReleaseValue() {
        return minReleaseValue;
    }

    public void setMinReleaseValue(BigDecimal minReleaseValue) {
        this.minReleaseValue = minReleaseValue;
    }

    public BigDecimal getMaxReleaseValue() {
        return maxReleaseValue;
    }

    public void setMaxReleaseValue(BigDecimal maxReleaseValue) {
        this.maxReleaseValue = maxReleaseValue;
    }

    public Integer getMinBootSize() {
        return minBootSize;
    }

    public void setMinBootSize(Integer minBootSize) {
        this.minBootSize = minBootSize;
    }

    public Integer getMaxBootSize() {
        return maxBootSize;
    }

    public void setMaxBootSize(Integer maxBootSize) {
        this.maxBootSize = maxBootSize;
    }

    public BigDecimal getRecommendedHeightMin() {
        return recommendedHeightMin;
    }

    public void setRecommendedHeightMin(BigDecimal recommendedHeightMin) {
        this.recommendedHeightMin = recommendedHeightMin;
    }

    public BigDecimal getRecommendedHeightMax() {
        return recommendedHeightMax;
    }

    public void setRecommendedHeightMax(BigDecimal recommendedHeightMax) {
        this.recommendedHeightMax = recommendedHeightMax;
    }

    public BigDecimal getRecommendedWeightMin() {
        return recommendedWeightMin;
    }

    public void setRecommendedWeightMin(BigDecimal recommendedWeightMin) {
        this.recommendedWeightMin = recommendedWeightMin;
    }

    public BigDecimal getRecommendedWeightMax() {
        return recommendedWeightMax;
    }

    public void setRecommendedWeightMax(BigDecimal recommendedWeightMax) {
        this.recommendedWeightMax = recommendedWeightMax;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
