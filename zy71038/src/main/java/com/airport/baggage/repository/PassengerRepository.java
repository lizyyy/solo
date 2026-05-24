package com.airport.baggage.repository;

import com.airport.baggage.entity.Passenger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PassengerRepository extends JpaRepository<Passenger, Long> {
    Optional<Passenger> findByPassengerId(String passengerId);
    Optional<Passenger> findByIdCard(String idCard);
    Optional<Passenger> findByPhone(String phone);
}
