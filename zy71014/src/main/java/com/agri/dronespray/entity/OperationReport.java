package com.agri.dronespray.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "operation_report")
public class OperationReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "permission_id", nullable = false, unique = true)
    private Permission permission;

    @Column(nullable = false)
    private String reportNo;

    private LocalDateTime actualStartTime;

    private LocalDateTime actualEndTime;

    private Double totalArea;

    private Double totalPesticideUsed;

    private Integer flightSorties;

    private Double totalFlightTime;

    @Column(length = 2000)
    private String operationSummary;

    @Column(length = 2000)
    private String issuesEncountered;

    @Column(length = 2000)
    private String solutions;

    @Column(length = 2000)
    private String operatorSignature;

    @Column(length = 2000)
    private String qualityInspector;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String createdBy;

    private LocalDateTime updatedAt;

    private String updatedBy;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Permission getPermission() {
        return permission;
    }

    public void setPermission(Permission permission) {
        this.permission = permission;
    }

    public String getReportNo() {
        return reportNo;
    }

    public void setReportNo(String reportNo) {
        this.reportNo = reportNo;
    }

    public LocalDateTime getActualStartTime() {
        return actualStartTime;
    }

    public void setActualStartTime(LocalDateTime actualStartTime) {
        this.actualStartTime = actualStartTime;
    }

    public LocalDateTime getActualEndTime() {
        return actualEndTime;
    }

    public void setActualEndTime(LocalDateTime actualEndTime) {
        this.actualEndTime = actualEndTime;
    }

    public Double getTotalArea() {
        return totalArea;
    }

    public void setTotalArea(Double totalArea) {
        this.totalArea = totalArea;
    }

    public Double getTotalPesticideUsed() {
        return totalPesticideUsed;
    }

    public void setTotalPesticideUsed(Double totalPesticideUsed) {
        this.totalPesticideUsed = totalPesticideUsed;
    }

    public Integer getFlightSorties() {
        return flightSorties;
    }

    public void setFlightSorties(Integer flightSorties) {
        this.flightSorties = flightSorties;
    }

    public Double getTotalFlightTime() {
        return totalFlightTime;
    }

    public void setTotalFlightTime(Double totalFlightTime) {
        this.totalFlightTime = totalFlightTime;
    }

    public String getOperationSummary() {
        return operationSummary;
    }

    public void setOperationSummary(String operationSummary) {
        this.operationSummary = operationSummary;
    }

    public String getIssuesEncountered() {
        return issuesEncountered;
    }

    public void setIssuesEncountered(String issuesEncountered) {
        this.issuesEncountered = issuesEncountered;
    }

    public String getSolutions() {
        return solutions;
    }

    public void setSolutions(String solutions) {
        this.solutions = solutions;
    }

    public String getOperatorSignature() {
        return operatorSignature;
    }

    public void setOperatorSignature(String operatorSignature) {
        this.operatorSignature = operatorSignature;
    }

    public String getQualityInspector() {
        return qualityInspector;
    }

    public void setQualityInspector(String qualityInspector) {
        this.qualityInspector = qualityInspector;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
