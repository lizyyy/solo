package com.agri.dronespray.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "permission")
public class Permission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String permissionNo;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private PermissionStatus status;

    private String operationType;

    private LocalDateTime plannedStartTime;

    private LocalDateTime plannedEndTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pilot_id")
    private Pilot pilot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "drone_id")
    private Drone drone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "weather_window_id")
    private WeatherWindow weatherWindow;

    private String finalConclusion;

    private String conclusionRemark;

    private LocalDateTime concludedAt;

    private String concludedBy;

    @OneToMany(mappedBy = "permission", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PermissionItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "permission", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CheckRecord> checkRecords = new ArrayList<>();

    @OneToMany(mappedBy = "permission", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProcessingRecord> processingRecords = new ArrayList<>();

    @OneToMany(mappedBy = "permission", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AmendmentHistory> amendmentHistories = new ArrayList<>();

    @OneToOne(mappedBy = "permission", cascade = CascadeType.ALL)
    private OperationReport operationReport;

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

    public String getPermissionNo() {
        return permissionNo;
    }

    public void setPermissionNo(String permissionNo) {
        this.permissionNo = permissionNo;
    }

    public PermissionStatus getStatus() {
        return status;
    }

    public void setStatus(PermissionStatus status) {
        this.status = status;
    }

    public String getOperationType() {
        return operationType;
    }

    public void setOperationType(String operationType) {
        this.operationType = operationType;
    }

    public LocalDateTime getPlannedStartTime() {
        return plannedStartTime;
    }

    public void setPlannedStartTime(LocalDateTime plannedStartTime) {
        this.plannedStartTime = plannedStartTime;
    }

    public LocalDateTime getPlannedEndTime() {
        return plannedEndTime;
    }

    public void setPlannedEndTime(LocalDateTime plannedEndTime) {
        this.plannedEndTime = plannedEndTime;
    }

    public Pilot getPilot() {
        return pilot;
    }

    public void setPilot(Pilot pilot) {
        this.pilot = pilot;
    }

    public Drone getDrone() {
        return drone;
    }

    public void setDrone(Drone drone) {
        this.drone = drone;
    }

    public WeatherWindow getWeatherWindow() {
        return weatherWindow;
    }

    public void setWeatherWindow(WeatherWindow weatherWindow) {
        this.weatherWindow = weatherWindow;
    }

    public String getFinalConclusion() {
        return finalConclusion;
    }

    public void setFinalConclusion(String finalConclusion) {
        this.finalConclusion = finalConclusion;
    }

    public String getConclusionRemark() {
        return conclusionRemark;
    }

    public void setConclusionRemark(String conclusionRemark) {
        this.conclusionRemark = conclusionRemark;
    }

    public LocalDateTime getConcludedAt() {
        return concludedAt;
    }

    public void setConcludedAt(LocalDateTime concludedAt) {
        this.concludedAt = concludedAt;
    }

    public String getConcludedBy() {
        return concludedBy;
    }

    public void setConcludedBy(String concludedBy) {
        this.concludedBy = concludedBy;
    }

    public List<PermissionItem> getItems() {
        return items;
    }

    public void setItems(List<PermissionItem> items) {
        this.items = items;
    }

    public List<CheckRecord> getCheckRecords() {
        return checkRecords;
    }

    public void setCheckRecords(List<CheckRecord> checkRecords) {
        this.checkRecords = checkRecords;
    }

    public List<ProcessingRecord> getProcessingRecords() {
        return processingRecords;
    }

    public void setProcessingRecords(List<ProcessingRecord> processingRecords) {
        this.processingRecords = processingRecords;
    }

    public List<AmendmentHistory> getAmendmentHistories() {
        return amendmentHistories;
    }

    public void setAmendmentHistories(List<AmendmentHistory> amendmentHistories) {
        this.amendmentHistories = amendmentHistories;
    }

    public OperationReport getOperationReport() {
        return operationReport;
    }

    public void setOperationReport(OperationReport operationReport) {
        this.operationReport = operationReport;
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
        status = PermissionStatus.DRAFT;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addItem(PermissionItem item) {
        items.add(item);
        item.setPermission(this);
    }

    public void addCheckRecord(CheckRecord record) {
        checkRecords.add(record);
        record.setPermission(this);
    }

    public void addProcessingRecord(ProcessingRecord record) {
        processingRecords.add(record);
        record.setPermission(this);
    }

    public void addAmendmentHistory(AmendmentHistory history) {
        amendmentHistories.add(history);
        history.setPermission(this);
    }
}
