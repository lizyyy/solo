package com.ski.rental.model;

import com.ski.rental.enums.DamageLevel;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "return_inspections")
public class ReturnInspection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "rental_order_id")
    private RentalOrder rentalOrder;

    @Enumerated(EnumType.STRING)
    private DamageLevel overallDamageLevel = DamageLevel.NONE;

    @ElementCollection
    @CollectionTable(name = "inspection_items", joinColumns = @JoinColumn(name = "inspection_id"))
    private List<InspectionItem> inspectionItems = new ArrayList<>();

    private BigDecimal estimatedDamageFee;
    private String inspectorNote;
    private String inspector;

    private Boolean reviewed = false;
    private String reviewer;
    private String reviewNote;
    private LocalDateTime reviewTime;
    private BigDecimal finalDamageFee;

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

    public RentalOrder getRentalOrder() {
        return rentalOrder;
    }

    public void setRentalOrder(RentalOrder rentalOrder) {
        this.rentalOrder = rentalOrder;
    }

    public DamageLevel getOverallDamageLevel() {
        return overallDamageLevel;
    }

    public void setOverallDamageLevel(DamageLevel overallDamageLevel) {
        this.overallDamageLevel = overallDamageLevel;
    }

    public List<InspectionItem> getInspectionItems() {
        return inspectionItems;
    }

    public void setInspectionItems(List<InspectionItem> inspectionItems) {
        this.inspectionItems = inspectionItems;
    }

    public BigDecimal getEstimatedDamageFee() {
        return estimatedDamageFee;
    }

    public void setEstimatedDamageFee(BigDecimal estimatedDamageFee) {
        this.estimatedDamageFee = estimatedDamageFee;
    }

    public String getInspectorNote() {
        return inspectorNote;
    }

    public void setInspectorNote(String inspectorNote) {
        this.inspectorNote = inspectorNote;
    }

    public String getInspector() {
        return inspector;
    }

    public void setInspector(String inspector) {
        this.inspector = inspector;
    }

    public Boolean getReviewed() {
        return reviewed;
    }

    public void setReviewed(Boolean reviewed) {
        this.reviewed = reviewed;
    }

    public String getReviewer() {
        return reviewer;
    }

    public void setReviewer(String reviewer) {
        this.reviewer = reviewer;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public LocalDateTime getReviewTime() {
        return reviewTime;
    }

    public void setReviewTime(LocalDateTime reviewTime) {
        this.reviewTime = reviewTime;
    }

    public BigDecimal getFinalDamageFee() {
        return finalDamageFee;
    }

    public void setFinalDamageFee(BigDecimal finalDamageFee) {
        this.finalDamageFee = finalDamageFee;
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
