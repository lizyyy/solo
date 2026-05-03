from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass
import math

from ..models import (
    PondConfig,
    PondState,
    WaterQualityParams,
    SimulationParams,
    Scenario,
    WaterChangePlan,
    AerationPlan,
    ProbioticsPlan,
)


@dataclass
class WaterQualityState:
    timestamp: datetime
    temperature: float
    ph: float
    ammonia_nitrogen: float
    nitrite: float
    nitrate: float
    salinity: float
    dissolved_oxygen: float
    turbidity: Optional[float] = None
    alkalinity: Optional[float] = None
    hardness: Optional[float] = None


class WaterQualityModel:
    def __init__(self, pond_config: PondConfig):
        self.pond_config = pond_config
        self._nitrification_rate_base = 0.05
        self._denitrification_rate_base = 0.02
        self._ammonia_from_feed = 0.03
        self._do_consumption_rate = 0.5

    def calculate_nitrification_rate(
        self,
        ammonia: float,
        temperature: float,
        ph: float,
        dissolved_oxygen: float,
    ) -> float:
        temp_factor = math.exp(0.069 * (temperature - 20))
        ph_factor = 1.0 / (1 + math.pow(10, 7.8 - ph))
        do_factor = dissolved_oxygen / (dissolved_oxygen + 0.5) if dissolved_oxygen > 0 else 0
        substrate_factor = ammonia / (ammonia + 1.0) if ammonia > 0 else 0

        rate = (
            self._nitrification_rate_base
            * temp_factor
            * ph_factor
            * do_factor
            * substrate_factor
        )
        return max(0, rate)

    def calculate_denitrification_rate(
        self,
        nitrate: float,
        temperature: float,
        dissolved_oxygen: float,
    ) -> float:
        if dissolved_oxygen > 0.5:
            return 0.0

        temp_factor = math.exp(0.06 * (temperature - 20))
        do_inhibition = 1.0 - min(1.0, dissolved_oxygen / 0.5)
        substrate_factor = nitrate / (nitrate + 2.0) if nitrate > 0 else 0

        rate = (
            self._denitrification_rate_base
            * temp_factor
            * do_inhibition
            * substrate_factor
        )
        return max(0, rate)

    def calculate_ammonia_from_feed(
        self,
        feed_rate_kg_hour: float,
        protein_content: float,
        pond_volume_m3: float,
    ) -> float:
        nitrogen_in_feed = feed_rate_kg_hour * (protein_content / 100) * 0.16
        ammonia_excreted = nitrogen_in_feed * self._ammonia_from_feed
        ammonia_mg_per_l = (ammonia_excreted * 1000) / (pond_volume_m3 * 1000)
        return ammonia_mg_per_l

    def calculate_do_consumption(
        self,
        ammonia: float,
        nitrite: float,
        temperature: float,
        biomass_kg: float,
        pond_volume_m3: float,
    ) -> float:
        nitrification_do = 4.57 * ammonia + 1.14 * nitrite
        temp_factor = math.exp(0.05 * (temperature - 20))
        respiration_do = (biomass_kg * 0.001 * temp_factor) / (pond_volume_m3 * 1000) * 1000
        total_do = nitrification_do + respiration_do
        return max(0, total_do)

    def calculate_ph_change(
        self,
        ammonia: float,
        temperature: float,
        co2_production: float = 0.0,
    ) -> float:
        nh3_ratio = 1.0 / (1 + math.pow(10, (0.09018 + 2729.92 / (temperature + 273.15)) - 7.5))
        nh3_concentration = ammonia * nh3_ratio
        ph_effect = nh3_concentration * 0.1
        co2_effect = -co2_production * 0.05
        return ph_effect + co2_effect

    def calculate_probiotics_effect(
        self,
        ammonia: float,
        nitrite: float,
        probiotics_dosage: float,
        efficiency: float,
        hours_since_application: float,
    ) -> Tuple[float, float]:
        decay_factor = math.exp(-hours_since_application / 48)
        effective_efficiency = efficiency * decay_factor

        ammonia_reduction = ammonia * effective_efficiency * 0.05
        nitrite_reduction = nitrite * effective_efficiency * 0.03

        return ammonia_reduction, nitrite_reduction

    def calculate_water_exchange_effect(
        self,
        current_value: float,
        source_value: float,
        exchange_rate: float,
    ) -> float:
        new_value = current_value * (1 - exchange_rate) + source_value * exchange_rate
        return new_value

    def calculate_aeration_effect(
        self,
        current_do: float,
        saturation_do: float,
        aeration_rate: float,
        time_step_hours: float,
    ) -> float:
        deficit = saturation_do - current_do
        if deficit <= 0:
            return current_do

        do_increase = deficit * (1 - math.exp(-aeration_rate * time_step_hours))
        return current_do + do_increase

    def calculate_do_saturation(self, temperature: float, salinity: float = 0) -> float:
        t = temperature
        s = salinity
        ln_do = (
            -139.34411
            + (1.575701e5 / (t + 273.15))
            - (6.642308e7 / (t + 273.15) ** 2)
            + (1.243800e10 / (t + 273.15) ** 3)
            - (8.621949e11 / (t + 273.15) ** 4)
            - s * (
                0.017674
                - 10.754 / (t + 273.15)
                + 2140.7 / (t + 273.15) ** 2
            )
        )
        return math.exp(ln_do)

    def step(
        self,
        current_state: WaterQualityState,
        simulation_params: SimulationParams,
        time_step_hours: float,
        active_actions: Dict[str, Any],
    ) -> WaterQualityState:
        new_state = WaterQualityState(
            timestamp=current_state.timestamp + timedelta(hours=time_step_hours),
            temperature=current_state.temperature,
            ph=current_state.ph,
            ammonia_nitrogen=current_state.ammonia_nitrogen,
            nitrite=current_state.nitrite,
            nitrate=current_state.nitrate,
            salinity=current_state.salinity,
            dissolved_oxygen=current_state.dissolved_oxygen,
            turbidity=current_state.turbidity,
            alkalinity=current_state.alkalinity,
            hardness=current_state.hardness,
        )

        if simulation_params.temperature_variation != 0:
            temp_change_per_hour = simulation_params.temperature_variation / 24
            new_state.temperature += temp_change_per_hour * time_step_hours
            new_state.temperature = max(0, min(40, new_state.temperature))

        if simulation_params.feed_rate > 0:
            ammonia_increase = self.calculate_ammonia_from_feed(
                simulation_params.feed_rate,
                simulation_params.feed_protein_content,
                self.pond_config.volume,
            ) * time_step_hours
            new_state.ammonia_nitrogen += ammonia_increase

        if simulation_params.use_nitrification:
            nitrification_rate = self.calculate_nitrification_rate(
                new_state.ammonia_nitrogen,
                new_state.temperature,
                new_state.ph,
                new_state.dissolved_oxygen,
            )
            ammonia_to_nitrite = nitrification_rate * new_state.ammonia_nitrogen * time_step_hours
            new_state.ammonia_nitrogen -= ammonia_to_nitrite
            new_state.nitrite += ammonia_to_nitrite

            nitrite_oxidation_rate = nitrification_rate * 0.8
            nitrite_to_nitrate = nitrite_oxidation_rate * new_state.nitrite * time_step_hours
            new_state.nitrite -= nitrite_to_nitrate
            new_state.nitrate += nitrite_to_nitrate

        if simulation_params.use_denitrification:
            denitrification_rate = self.calculate_denitrification_rate(
                new_state.nitrate,
                new_state.temperature,
                new_state.dissolved_oxygen,
            )
            nitrate_reduction = denitrification_rate * new_state.nitrate * time_step_hours
            new_state.nitrate -= nitrate_reduction

        water_exchange = active_actions.get("water_exchange", {})
        if water_exchange.get("rate", 0) > 0:
            exchange_rate = water_exchange["rate"] * time_step_hours
            new_state.ammonia_nitrogen = self.calculate_water_exchange_effect(
                new_state.ammonia_nitrogen,
                simulation_params.source_water_ammonia,
                exchange_rate,
            )
            new_state.nitrite = self.calculate_water_exchange_effect(
                new_state.nitrite,
                simulation_params.source_water_nitrite,
                exchange_rate,
            )
            new_state.salinity = self.calculate_water_exchange_effect(
                new_state.salinity,
                simulation_params.source_water_salinity,
                exchange_rate,
            )
            new_state.ph = self.calculate_water_exchange_effect(
                new_state.ph,
                simulation_params.source_water_ph,
                exchange_rate,
            )

        probiotics = active_actions.get("probiotics", {})
        if probiotics.get("dosage", 0) > 0:
            ammonia_red, nitrite_red = self.calculate_probiotics_effect(
                new_state.ammonia_nitrogen,
                new_state.nitrite,
                probiotics["dosage"],
                probiotics.get("efficiency", 0.3),
                probiotics.get("hours_since_apply", 0),
            )
            new_state.ammonia_nitrogen -= ammonia_red * time_step_hours
            new_state.nitrite -= nitrite_red * time_step_hours

        aeration = active_actions.get("aeration", {})
        if aeration.get("rate", 0) > 0:
            saturation_do = self.calculate_do_saturation(
                new_state.temperature,
                new_state.salinity,
            )
            new_state.dissolved_oxygen = self.calculate_aeration_effect(
                new_state.dissolved_oxygen,
                saturation_do,
                aeration["rate"],
                time_step_hours,
            )

        do_consumption = self.calculate_do_consumption(
            new_state.ammonia_nitrogen,
            new_state.nitrite,
            new_state.temperature,
            self.pond_config.stocking_density * self.pond_config.volume * 0.01,
            self.pond_config.volume,
        ) * time_step_hours
        new_state.dissolved_oxygen -= do_consumption
        new_state.dissolved_oxygen = max(0, new_state.dissolved_oxygen)

        ph_change = self.calculate_ph_change(
            new_state.ammonia_nitrogen,
            new_state.temperature,
        ) * time_step_hours
        new_state.ph += ph_change
        new_state.ph = max(0, min(14, new_state.ph))

        new_state.ammonia_nitrogen = max(0, new_state.ammonia_nitrogen)
        new_state.nitrite = max(0, new_state.nitrite)
        new_state.nitrate = max(0, new_state.nitrate)

        return new_state
