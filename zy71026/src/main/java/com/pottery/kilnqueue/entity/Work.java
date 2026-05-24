package com.pottery.kilnqueue.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "works")
public class Work {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String workNo;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(nullable = false)
    private Boolean isThickBody = false;

    private BigDecimal width;

    private BigDecimal height;

    private BigDecimal depth;

    @Column(columnDefinition = "TEXT")
    private String glazeCodes;

    @Column(columnDefinition = "TEXT")
    private String description;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Transient
    public List<String> getGlazeCodeList() {
        List<String> list = new ArrayList<>();
        if (glazeCodes != null && !glazeCodes.isEmpty()) {
            String[] codes = glazeCodes.split(",");
            for (String code : codes) {
                list.add(code.trim());
            }
        }
        return list;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getWorkNo() { return workNo; }
    public void setWorkNo(String workNo) { this.workNo = workNo; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public Boolean getIsThickBody() { return isThickBody; }
    public void setIsThickBody(Boolean isThickBody) { this.isThickBody = isThickBody; }
    public BigDecimal getWidth() { return width; }
    public void setWidth(BigDecimal width) { this.width = width; }
    public BigDecimal getHeight() { return height; }
    public void setHeight(BigDecimal height) { this.height = height; }
    public BigDecimal getDepth() { return depth; }
    public void setDepth(BigDecimal depth) { this.depth = depth; }
    public String getGlazeCodes() { return glazeCodes; }
    public void setGlazeCodes(String glazeCodes) { this.glazeCodes = glazeCodes; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
