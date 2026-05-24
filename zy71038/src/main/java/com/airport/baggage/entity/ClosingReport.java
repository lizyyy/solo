package com.airport.baggage.entity;

import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "closing_reports")
@EntityListeners(AuditingEntityListener.class)
public class ClosingReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compensation_order_id", nullable = false, unique = true)
    private CompensationOrder compensationOrder;

    @Column(nullable = false, length = 50)
    private String reportNo;

    @Column(precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(length = 1000)
    private String caseSummary;

    @Column(length = 500)
    private String disposalMeasure;

    @Column(length = 200)
    private String passengerFeedback;

    @Column(length = 200)
    private String closedBy;

    @Column(nullable = false)
    private LocalDateTime closedAt;

    @Column(length = 500)
    private String remark;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public CompensationOrder getCompensationOrder() { return compensationOrder; }
    public void setCompensationOrder(CompensationOrder compensationOrder) { this.compensationOrder = compensationOrder; }
    public String getReportNo() { return reportNo; }
    public void setReportNo(String reportNo) { this.reportNo = reportNo; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public String getCaseSummary() { return caseSummary; }
    public void setCaseSummary(String caseSummary) { this.caseSummary = caseSummary; }
    public String getDisposalMeasure() { return disposalMeasure; }
    public void setDisposalMeasure(String disposalMeasure) { this.disposalMeasure = disposalMeasure; }
    public String getPassengerFeedback() { return passengerFeedback; }
    public void setPassengerFeedback(String passengerFeedback) { this.passengerFeedback = passengerFeedback; }
    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String closedBy) { this.closedBy = closedBy; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
