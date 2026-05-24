package com.bus.notify.entity;

import com.bus.notify.enums.RouteChangeStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "route_change")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class RouteChange {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String changeNo;

    @Column(nullable = false, length = 100)
    private String routeName;

    @Column(nullable = false, length = 50)
    private String routeNo;

    @Column(nullable = false, length = 200)
    private String changeReason;

    @Column(length = 1000)
    private String changeDetail;

    @Column(nullable = false)
    private LocalDate effectiveDate;

    private LocalDate expectedEndDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private RouteChangeStatus status;

    @Column(length = 500)
    private String statusReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id")
    private Operator creator;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_handler_id")
    private Operator currentHandler;

    @OneToMany(mappedBy = "routeChange", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StationChange> stationChanges = new ArrayList<>();

    @OneToMany(mappedBy = "routeChange", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<NotificationRecord> notifications = new ArrayList<>();

    @OneToMany(mappedBy = "routeChange", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AuditLog> auditLogs = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    private LocalDateTime completedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getChangeNo() { return changeNo; }
    public void setChangeNo(String changeNo) { this.changeNo = changeNo; }
    public String getRouteName() { return routeName; }
    public void setRouteName(String routeName) { this.routeName = routeName; }
    public String getRouteNo() { return routeNo; }
    public void setRouteNo(String routeNo) { this.routeNo = routeNo; }
    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }
    public String getChangeDetail() { return changeDetail; }
    public void setChangeDetail(String changeDetail) { this.changeDetail = changeDetail; }
    public LocalDate getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(LocalDate effectiveDate) { this.effectiveDate = effectiveDate; }
    public LocalDate getExpectedEndDate() { return expectedEndDate; }
    public void setExpectedEndDate(LocalDate expectedEndDate) { this.expectedEndDate = expectedEndDate; }
    public RouteChangeStatus getStatus() { return status; }
    public void setStatus(RouteChangeStatus status) { this.status = status; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Operator getCreator() { return creator; }
    public void setCreator(Operator creator) { this.creator = creator; }
    public Operator getCurrentHandler() { return currentHandler; }
    public void setCurrentHandler(Operator currentHandler) { this.currentHandler = currentHandler; }
    public List<StationChange> getStationChanges() { return stationChanges; }
    public void setStationChanges(List<StationChange> stationChanges) { this.stationChanges = stationChanges; }
    public List<NotificationRecord> getNotifications() { return notifications; }
    public void setNotifications(List<NotificationRecord> notifications) { this.notifications = notifications; }
    public List<AuditLog> getAuditLogs() { return auditLogs; }
    public void setAuditLogs(List<AuditLog> auditLogs) { this.auditLogs = auditLogs; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
