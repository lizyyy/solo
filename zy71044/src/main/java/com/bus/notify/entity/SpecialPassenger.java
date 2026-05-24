package com.bus.notify.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "special_passenger")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SpecialPassenger {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String passengerName;

    @Column(nullable = false, unique = true, length = 50)
    private String cardNo;

    @Column(nullable = false, length = 20)
    private String cardType;

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String address;

    @Column(length = 50)
    private String emergencyContact;

    @Column(length = 20)
    private String emergencyPhone;

    @Column(length = 100)
    private String commonRoute;

    @Column(length = 100)
    private String commonStation;

    @Column(nullable = false)
    private Boolean needPhoneCall = true;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(length = 500)
    private String remark;

    @OneToMany(mappedBy = "passenger", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<NotificationRecord> notifications = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPassengerName() { return passengerName; }
    public void setPassengerName(String passengerName) { this.passengerName = passengerName; }
    public String getCardNo() { return cardNo; }
    public void setCardNo(String cardNo) { this.cardNo = cardNo; }
    public String getCardType() { return cardType; }
    public void setCardType(String cardType) { this.cardType = cardType; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }
    public String getEmergencyPhone() { return emergencyPhone; }
    public void setEmergencyPhone(String emergencyPhone) { this.emergencyPhone = emergencyPhone; }
    public String getCommonRoute() { return commonRoute; }
    public void setCommonRoute(String commonRoute) { this.commonRoute = commonRoute; }
    public String getCommonStation() { return commonStation; }
    public void setCommonStation(String commonStation) { this.commonStation = commonStation; }
    public Boolean getNeedPhoneCall() { return needPhoneCall; }
    public void setNeedPhoneCall(Boolean needPhoneCall) { this.needPhoneCall = needPhoneCall; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public List<NotificationRecord> getNotifications() { return notifications; }
    public void setNotifications(List<NotificationRecord> notifications) { this.notifications = notifications; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
