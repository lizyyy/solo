package com.encryption.rotation.model.entity;

import com.encryption.rotation.model.enums.KeyStatus;
import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "key_versions", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenantId", "version"})
})
public class KeyVersion {
    @Id
    @GeneratedValue(generator = "uuid")
    @org.hibernate.annotations.GenericGenerator(name = "uuid", strategy = "org.hibernate.id.UUIDGenerator")
    private String id;

    @Column(nullable = false)
    private String tenantId;

    @Column(nullable = false)
    private Integer version;

    @Column(nullable = false)
    private String keyReference;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private KeyStatus status = KeyStatus.PENDING_ACTIVATION;

    private LocalDateTime activatedAt;

    private LocalDateTime deprecatedAt;

    private LocalDateTime retiredAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
