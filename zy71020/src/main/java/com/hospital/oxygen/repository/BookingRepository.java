package com.hospital.oxygen.repository;

import com.hospital.oxygen.entity.Booking;
import com.hospital.oxygen.enums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    Optional<Booking> findByBookingNumber(String bookingNumber);
    List<Booking> findByPatientId(String patientId);
    List<Booking> findByWard(String ward);
    List<Booking> findByOxygenPortCode(String portCode);
    List<Booking> findByStatus(BookingStatus status);

    @Query("SELECT b FROM Booking b WHERE b.oxygenPortCode = :portCode AND b.status IN :statuses")
    List<Booking> findActiveBookingsByPort(@Param("portCode") String portCode, @Param("statuses") List<BookingStatus> statuses);

    @Query("SELECT b FROM Booking b WHERE b.oxygenPortCode = :portCode AND b.status IN :statuses AND b.startTime <= :endTime AND b.expectedEndTime >= :startTime")
    List<Booking> findOverlappingBookings(@Param("portCode") String portCode, @Param("statuses") List<BookingStatus> statuses, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.patientId = :patientId AND b.oxygenPortCode = :portCode AND b.status IN :statuses")
    long countDuplicateBookings(@Param("patientId") String patientId, @Param("portCode") String portCode, @Param("statuses") List<BookingStatus> statuses);

    @Query("SELECT b FROM Booking b WHERE b.status IN :statuses")
    List<Booking> findByStatusIn(@Param("statuses") List<BookingStatus> statuses);
}
