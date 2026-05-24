package com.ski.rental.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "safety_reports")
public class SafetyReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String reportNo;

    @OneToOne
    @JoinColumn(name = "rental_order_id")
    private RentalOrder rentalOrder;

    private Boolean paramsCompliant;
    private String paramsCheckSummary;

    private Boolean returnInspectionComplete;
    private String returnInspectionSummary;

    private Boolean feeCleared;
    private String feeSummary;

    private String overallStatus;
    private String reportSummary;

    private String generatedBy;
    private LocalDateTime generatedAt;

    @PrePersist
    protected void onCreate() {
        generatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getReportNo() {
        return reportNo;
    }

    public void setReportNo(String reportNo) {
        this.reportNo = reportNo;
    }

    public RentalOrder getRentalOrder() {
        return rentalOrder;
    }

    public void setRentalOrder(RentalOrder rentalOrder) {
        this.rentalOrder = rentalOrder;
    }

    public Boolean getParamsCompliant() {
        return paramsCompliant;
    }

    public void setParamsCompliant(Boolean paramsCompliant) {
        this.paramsCompliant = paramsCompliant;
    }

    public String getParamsCheckSummary() {
        return paramsCheckSummary;
    }

    public void setParamsCheckSummary(String paramsCheckSummary) {
        this.paramsCheckSummary = paramsCheckSummary;
    }

    public Boolean getReturnInspectionComplete() {
        return returnInspectionComplete;
    }

    public void setReturnInspectionComplete(Boolean returnInspectionComplete) {
        this.returnInspectionComplete = returnInspectionComplete;
    }

    public String getReturnInspectionSummary() {
        return returnInspectionSummary;
    }

    public void setReturnInspectionSummary(String returnInspectionSummary) {
        this.returnInspectionSummary = returnInspectionSummary;
    }

    public Boolean getFeeCleared() {
        return feeCleared;
    }

    public void setFeeCleared(Boolean feeCleared) {
        this.feeCleared = feeCleared;
    }

    public String getFeeSummary() {
        return feeSummary;
    }

    public void setFeeSummary(String feeSummary) {
        this.feeSummary = feeSummary;
    }

    public String getOverallStatus() {
        return overallStatus;
    }

    public void setOverallStatus(String overallStatus) {
        this.overallStatus = overallStatus;
    }

    public String getReportSummary() {
        return reportSummary;
    }

    public void setReportSummary(String reportSummary) {
        this.reportSummary = reportSummary;
    }

    public String getGeneratedBy() {
        return generatedBy;
    }

    public void setGeneratedBy(String generatedBy) {
        this.generatedBy = generatedBy;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }
}
