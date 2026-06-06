package com.pharmacy.coldchain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "cold_cabinets")
public class ColdCabinet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String cabinetCode;

    @Column(nullable = false)
    private String cabinetName;

    @Column(nullable = false)
    private String storeCode;

    private String cabinetModel;

    private BigDecimal minTemperature;

    private BigDecimal maxTemperature;

    @Column(nullable = false)
    private Boolean isActive = true;

    private LocalDateTime lastMaintenanceDate;

    @Column(nullable = false)
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
}
