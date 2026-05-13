package com.schema.approval.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "publish_record")
public class PublishRecord extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schema_version_id", nullable = false)
    private SchemaVersion schemaVersion;

    @Column(name = "publish_target", nullable = false)
    private String publishTarget;

    @Column(name = "publish_status", nullable = false)
    private String publishStatus;

    @Column(name = "publish_details", columnDefinition = "TEXT")
    private String publishDetails;

    @Column(name = "published_schema_id")
    private String publishedSchemaId;

    @Column(name = "rollback_available", nullable = false)
    private Boolean rollbackAvailable = true;
}
