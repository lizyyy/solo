package com.pharmacy.coldchain.entity;

import com.pharmacy.coldchain.entity.enums.TemperatureStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "temperature_records")
public class TemperatureRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String cabinetCode;

    @Column(nullable = false)
    private String storeCode;

    @Column(nullable = false)
    private BigDecimal temperature;

    @Column(nullable = false)
    private LocalDateTime recordTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TemperatureStatus status;

    private String probeCode;

    private Boolean isProbeAbnormal = false;

    private String remark;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
