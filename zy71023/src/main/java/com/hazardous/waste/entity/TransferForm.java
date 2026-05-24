package com.hazardous.waste.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "transfer_form")
public class TransferForm {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String formNo;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double totalWeight;

    private String transporter;

    private String transportPlateNo;

    private String driver;

    private String receiver;

    private LocalDateTime receiveTime;

    private String receiverSignature;

    private LocalDateTime transferTime;

    @Column(nullable = false)
    private Boolean isUsed;

    @Column(nullable = false)
    private Boolean isSigned;

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_form_id")
    private List<WasteRecord> wasteRecords = new ArrayList<>();

    @Column(length = 2000)
    private String remark;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isUsed == null) isUsed = false;
        if (isSigned == null) isSigned = false;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
