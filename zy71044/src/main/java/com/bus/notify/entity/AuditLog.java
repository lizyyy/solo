package com.bus.notify.entity;

import com.bus.notify.enums.RouteChangeStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_log")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_change_id", nullable = false)
    @JsonIgnore
    private RouteChange routeChange;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(length = 500)
    private String actionReason;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private RouteChangeStatus oldStatus;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private RouteChangeStatus newStatus;

    @Column(length = 2000)
    private String oldConclusion;

    @Column(length = 2000)
    private String newConclusion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operator_id")
    private Operator operator;

    @Column(length = 500)
    private String remark;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public RouteChange getRouteChange() { return routeChange; }
    public void setRouteChange(RouteChange routeChange) { this.routeChange = routeChange; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getActionReason() { return actionReason; }
    public void setActionReason(String actionReason) { this.actionReason = actionReason; }
    public RouteChangeStatus getOldStatus() { return oldStatus; }
    public void setOldStatus(RouteChangeStatus oldStatus) { this.oldStatus = oldStatus; }
    public RouteChangeStatus getNewStatus() { return newStatus; }
    public void setNewStatus(RouteChangeStatus newStatus) { this.newStatus = newStatus; }
    public String getOldConclusion() { return oldConclusion; }
    public void setOldConclusion(String oldConclusion) { this.oldConclusion = oldConclusion; }
    public String getNewConclusion() { return newConclusion; }
    public void setNewConclusion(String newConclusion) { this.newConclusion = newConclusion; }
    public Operator getOperator() { return operator; }
    public void setOperator(Operator operator) { this.operator = operator; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
