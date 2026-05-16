package com.connector.ratelimit.model.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "supplier_account")
public class SupplierAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String accountCode;

    @Column(nullable = false)
    private String supplierName;

    @Column(nullable = false)
    private String supplierCode;

    private String apiKey;

    private String apiSecret;

    private String endpoint;

    private Integer dailyLimit;

    private Integer hourlyLimit;

    private Integer qpsLimit;

    private Boolean enabled = true;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
