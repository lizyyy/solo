package com.hospital.oxygen.repository;

import com.hospital.oxygen.entity.EquipmentBorrow;
import com.hospital.oxygen.enums.BorrowStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface EquipmentBorrowRepository extends JpaRepository<EquipmentBorrow, Long> {
    Optional<EquipmentBorrow> findByBorrowNumber(String borrowNumber);
    List<EquipmentBorrow> findByEquipmentCode(String equipmentCode);
    List<EquipmentBorrow> findByPatientId(String patientId);
    List<EquipmentBorrow> findByStatus(BorrowStatus status);
    List<EquipmentBorrow> findByBorrowWard(String ward);

    @Query("SELECT eb FROM EquipmentBorrow eb WHERE eb.equipmentCode = :equipmentCode AND eb.status IN :statuses")
    List<EquipmentBorrow> findActiveBorrowsByEquipment(@Param("equipmentCode") String equipmentCode, @Param("statuses") List<BorrowStatus> statuses);

    @Query("SELECT eb FROM EquipmentBorrow eb WHERE eb.expectedReturnTime < :now AND eb.status = 'BORROWED'")
    List<EquipmentBorrow> findOverdueBorrows(@Param("now") LocalDateTime now);

    @Query("SELECT COUNT(eb) FROM EquipmentBorrow eb WHERE eb.equipmentCode = :equipmentCode AND eb.patientId = :patientId AND eb.status IN :statuses")
    long countDuplicateBorrowAttempts(@Param("equipmentCode") String equipmentCode, @Param("patientId") String patientId, @Param("statuses") List<BorrowStatus> statuses);
}
