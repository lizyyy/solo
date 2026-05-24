package com.bus.notify.entity;

import com.bus.notify.enums.StationStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "station_change")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class StationChange {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_change_id", nullable = false)
    @JsonIgnore
    private RouteChange routeChange;

    @Column(nullable = false, length = 100)
    private String stationName;

    @Column(length = 50)
    private String stationCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StationStatus status;

    @Column(length = 500)
    private String statusReason;

    @Column(nullable = false)
    private Boolean notified = false;

    @Column(length = 500)
    private String notifyDetail;

    private LocalDateTime notifiedAt;

    @Column(nullable = false)
    private Boolean isTemporary = false;

    @Column(nullable = false)
    private Boolean recoveryNotified = false;

    private LocalDateTime recoveryNotifiedAt;

    @Column(length = 1000)
    private String alternativeRoute;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public RouteChange getRouteChange() { return routeChange; }
    public void setRouteChange(RouteChange routeChange) { this.routeChange = routeChange; }
    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }
    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public StationStatus getStatus() { return status; }
    public void setStatus(StationStatus status) { this.status = status; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Boolean getNotified() { return notified; }
    public void setNotified(Boolean notified) { this.notified = notified; }
    public String getNotifyDetail() { return notifyDetail; }
    public void setNotifyDetail(String notifyDetail) { this.notifyDetail = notifyDetail; }
    public LocalDateTime getNotifiedAt() { return notifiedAt; }
    public void setNotifiedAt(LocalDateTime notifiedAt) { this.notifiedAt = notifiedAt; }
    public Boolean getIsTemporary() { return isTemporary; }
    public void setIsTemporary(Boolean isTemporary) { this.isTemporary = isTemporary; }
    public Boolean getRecoveryNotified() { return recoveryNotified; }
    public void setRecoveryNotified(Boolean recoveryNotified) { this.recoveryNotified = recoveryNotified; }
    public LocalDateTime getRecoveryNotifiedAt() { return recoveryNotifiedAt; }
    public void setRecoveryNotifiedAt(LocalDateTime recoveryNotifiedAt) { this.recoveryNotifiedAt = recoveryNotifiedAt; }
    public String getAlternativeRoute() { return alternativeRoute; }
    public void setAlternativeRoute(String alternativeRoute) { this.alternativeRoute = alternativeRoute; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
