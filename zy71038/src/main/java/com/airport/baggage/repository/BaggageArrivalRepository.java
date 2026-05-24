package com.airport.baggage.repository;

import com.airport.baggage.entity.BaggageArrival;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BaggageArrivalRepository extends JpaRepository<BaggageArrival, Long> {
    List<BaggageArrival> findByCompensationOrderId(Long compensationOrderId);
    List<BaggageArrival> findByBaggageId(Long baggageId);
    Optional<BaggageArrival> findFirstByBaggageIdOrderByArrivalTimeDesc(Long baggageId);
}
