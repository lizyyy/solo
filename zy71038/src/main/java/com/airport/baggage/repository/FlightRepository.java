package com.airport.baggage.repository;

import com.airport.baggage.entity.Flight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FlightRepository extends JpaRepository<Flight, Long> {
    Optional<Flight> findByFlightNoAndScheduledDeparture(String flightNo, LocalDateTime scheduledDeparture);
    List<Flight> findByFlightNoContaining(String flightNo);
}
