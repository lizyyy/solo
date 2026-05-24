package com.airport.baggage.entity;

import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "baggage_arrivals")
@EntityListeners(AuditingEntityListener.class)
public class BaggageArrival {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compensation_order_id", nullable = false)
    private CompensationOrder compensationOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "baggage_id", nullable = false)
    private BaggageTag baggage;

    @Column(nullable = false)
    private LocalDateTime arrivalTime;

    @Column(length = 200)
    private String arrivalLocation;

    @Column(length = 200)
    private String transportFlight;

    @Column(length = 500)
    private String remark;

    @Column(length = 100)
    private String recordedBy;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public CompensationOrder getCompensationOrder() { return compensationOrder; }
    public void setCompensationOrder(CompensationOrder compensationOrder) { this.compensationOrder = compensationOrder; }
    public BaggageTag getBaggage() { return baggage; }
    public void setBaggage(BaggageTag baggage) { this.baggage = baggage; }
    public LocalDateTime getArrivalTime() { return arrivalTime; }
    public void setArrivalTime(LocalDateTime arrivalTime) { this.arrivalTime = arrivalTime; }
    public String getArrivalLocation() { return arrivalLocation; }
    public void setArrivalLocation(String arrivalLocation) { this.arrivalLocation = arrivalLocation; }
    public String getTransportFlight() { return transportFlight; }
    public void setTransportFlight(String transportFlight) { this.transportFlight = transportFlight; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String recordedBy) { this.recordedBy = recordedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
