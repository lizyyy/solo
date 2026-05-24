package com.hospital.oxygen.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "occupancy_reports")
public class OccupancyReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String reportNumber;

    @Column(nullable = false)
    private String ward;

    private LocalDateTime reportDate;

    private Integer totalPorts;
    private Integer occupiedPorts;
    private Integer availablePorts;
    private Integer reservedPorts;
    private Integer maintenancePorts;

    private Integer totalEquipments;
    private Integer borrowedEquipments;
    private Integer overdueEquipments;

    private Integer pendingTransfers;
    private Integer completedTransfers;
    private Integer unreleasedTransfers;

    private Integer activeBookings;
    private Integer duplicateAttempts;

    private String remarks;
    private String generatedBy;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (reportDate == null) {
            reportDate = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getReportNumber() { return reportNumber; }
    public void setReportNumber(String reportNumber) { this.reportNumber = reportNumber; }
    public String getWard() { return ward; }
    public void setWard(String ward) { this.ward = ward; }
    public LocalDateTime getReportDate() { return reportDate; }
    public void setReportDate(LocalDateTime reportDate) { this.reportDate = reportDate; }
    public Integer getTotalPorts() { return totalPorts; }
    public void setTotalPorts(Integer totalPorts) { this.totalPorts = totalPorts; }
    public Integer getOccupiedPorts() { return occupiedPorts; }
    public void setOccupiedPorts(Integer occupiedPorts) { this.occupiedPorts = occupiedPorts; }
    public Integer getAvailablePorts() { return availablePorts; }
    public void setAvailablePorts(Integer availablePorts) { this.availablePorts = availablePorts; }
    public Integer getReservedPorts() { return reservedPorts; }
    public void setReservedPorts(Integer reservedPorts) { this.reservedPorts = reservedPorts; }
    public Integer getMaintenancePorts() { return maintenancePorts; }
    public void setMaintenancePorts(Integer maintenancePorts) { this.maintenancePorts = maintenancePorts; }
    public Integer getTotalEquipments() { return totalEquipments; }
    public void setTotalEquipments(Integer totalEquipments) { this.totalEquipments = totalEquipments; }
    public Integer getBorrowedEquipments() { return borrowedEquipments; }
    public void setBorrowedEquipments(Integer borrowedEquipments) { this.borrowedEquipments = borrowedEquipments; }
    public Integer getOverdueEquipments() { return overdueEquipments; }
    public void setOverdueEquipments(Integer overdueEquipments) { this.overdueEquipments = overdueEquipments; }
    public Integer getPendingTransfers() { return pendingTransfers; }
    public void setPendingTransfers(Integer pendingTransfers) { this.pendingTransfers = pendingTransfers; }
    public Integer getCompletedTransfers() { return completedTransfers; }
    public void setCompletedTransfers(Integer completedTransfers) { this.completedTransfers = completedTransfers; }
    public Integer getUnreleasedTransfers() { return unreleasedTransfers; }
    public void setUnreleasedTransfers(Integer unreleasedTransfers) { this.unreleasedTransfers = unreleasedTransfers; }
    public Integer getActiveBookings() { return activeBookings; }
    public void setActiveBookings(Integer activeBookings) { this.activeBookings = activeBookings; }
    public Integer getDuplicateAttempts() { return duplicateAttempts; }
    public void setDuplicateAttempts(Integer duplicateAttempts) { this.duplicateAttempts = duplicateAttempts; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(String generatedBy) { this.generatedBy = generatedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
