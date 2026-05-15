package com.object.lifecycle.entity;

import com.object.lifecycle.common.BaseEntity;
import javax.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "audit_log")
@Getter
@Setter
public class AuditLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String entityType;

    @Column(nullable = false)
    private String entityId;

    @Column(nullable = false)
    private String action;

    private String fieldName;

    private String oldValue;

    private String newValue;

    private String operator;

    private String clientIp;

    private String userAgent;

    @Lob
    private String requestDetails;
}
