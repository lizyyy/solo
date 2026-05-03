import numpy as np
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, field
from .config import DEFAULT_CONFIG


@dataclass
class FishSpeciesParams:
    name: str
    respiration_rate: float
    optimal_temp_range: tuple
    stress_temp_low: float
    stress_temp_high: float
    lethal_do_level: float


@dataclass
class WeatherParams:
    weather_type: str
    photosynthesis_factor: float
    reaeration_factor: float
    cloud_cover: float


FISH_SPECIES = {
    "tilapia": FishSpeciesParams(
        name="Tilapia",
        respiration_rate=0.045,
        optimal_temp_range=(24, 30),
        stress_temp_low=18,
        stress_temp_high=35,
        lethal_do_level=1.5,
    ),
    "carp": FishSpeciesParams(
        name="Carp",
        respiration_rate=0.04,
        optimal_temp_range=(20, 28),
        stress_temp_low=10,
        stress_temp_high=32,
        lethal_do_level=2.0,
    ),
    "catfish": FishSpeciesParams(
        name="Catfish",
        respiration_rate=0.035,
        optimal_temp_range=(25, 32),
        stress_temp_low=15,
        stress_temp_high=35,
        lethal_do_level=2.0,
    ),
    "shrimp": FishSpeciesParams(
        name="Shrimp",
        respiration_rate=0.06,
        optimal_temp_range=(26, 30),
        stress_temp_low=20,
        stress_temp_high=34,
        lethal_do_level=2.5,
    ),
}

WEATHER_PARAMS = {
    "sunny": WeatherParams(
        weather_type="sunny",
        photosynthesis_factor=1.0,
        reaeration_factor=1.0,
        cloud_cover=0.1,
    ),
    "cloudy": WeatherParams(
        weather_type="cloudy",
        photosynthesis_factor=0.5,
        reaeration_factor=0.9,
        cloud_cover=0.6,
    ),
    "rainy": WeatherParams(
        weather_type="rainy",
        photosynthesis_factor=0.2,
        reaeration_factor=1.2,
        cloud_cover=0.9,
    ),
    "stormy": WeatherParams(
        weather_type="stormy",
        photosynthesis_factor=0.1,
        reaeration_factor=1.5,
        cloud_cover=1.0,
    ),
    "foggy": WeatherParams(
        weather_type="foggy",
        photosynthesis_factor=0.3,
        reaeration_factor=0.7,
        cloud_cover=0.8,
    ),
}


class ModelParameters:
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or DEFAULT_CONFIG
        self._initialize_params()

    def _initialize_params(self) -> None:
        model_config = self.config["model"]
        self.fish_respiration_base = model_config.get("fish_respiration_rate", 0.05)
        self.phytoplankton_respiration = model_config.get(
            "phytoplankton_respiration", 0.02
        )
        self.sediment_oxygen_demand = model_config.get(
            "sediment_oxygen_demand", 0.01
        )
        self.reaeration_coefficient = model_config.get("reaeration_coefficient", 0.1)
        self.photosynthesis_rate = model_config.get("photosynthesis_rate", 0.03)

        oxygen_config = self.config["oxygen"]
        self.critical_do_level = oxygen_config.get("critical_level", 3.0)
        self.warning_do_level = oxygen_config.get("warning_level", 4.0)
        self.saturation_reference = oxygen_config.get("saturation_reference", 7.0)

    def get_fish_respiration_rate(
        self, temperature: float, fish_density: float, species: str = "tilapia"
    ) -> float:
        if species in FISH_SPECIES:
            species_params = FISH_SPECIES[species]
            base_rate = species_params.respiration_rate
        else:
            base_rate = self.fish_respiration_base

        temp_factor = self._get_temperature_factor(temperature, species)

        density_factor = 1.0 + (fish_density / 10000) * 0.2

        return base_rate * temp_factor * density_factor

    def _get_temperature_factor(
        self, temperature: float, species: str
    ) -> float:
        if species in FISH_SPECIES:
            species_params = FISH_SPECIES[species]
            opt_min, opt_max = species_params.optimal_temp_range

            if opt_min <= temperature <= opt_max:
                return 1.0
            elif temperature < opt_min:
                diff = opt_min - temperature
                return max(0.3, 1.0 - diff * 0.1)
            else:
                diff = temperature - opt_max
                return max(0.4, 1.0 - diff * 0.15)
        else:
            q10 = 2.0
            ref_temp = 25.0
            return q10 ** ((temperature - ref_temp) / 10)

    def get_photosynthesis_rate(
        self,
        hour_of_day: int,
        weather: str,
        temperature: float,
    ) -> float:
        weather_params = WEATHER_PARAMS.get(
            weather, WEATHER_PARAMS["cloudy"]
        )

        if 6 <= hour_of_day < 18:
            solar_angle = np.sin((hour_of_day - 6) * np.pi / 12)
        else:
            solar_angle = 0.0

        temp_factor = 1.0
        if temperature > 30:
            temp_factor = max(0.5, 1.0 - (temperature - 30) * 0.05)
        elif temperature < 15:
            temp_factor = max(0.3, 0.5 + (temperature - 15) * 0.03)

        return (
            self.photosynthesis_rate
            * solar_angle
            * weather_params.photosynthesis_factor
            * temp_factor
        )

    def get_reaeration_rate(
        self,
        dissolved_oxygen: float,
        temperature: float,
        weather: str,
        water_depth: float = 1.5,
    ) -> float:
        weather_params = WEATHER_PARAMS.get(
            weather, WEATHER_PARAMS["cloudy"]
        )

        saturation_do = self.calculate_saturation_do(temperature)
        deficit = saturation_do - dissolved_oxygen

        depth_factor = 1.0 / water_depth

        temp_factor = 1.024 ** (temperature - 20)

        return (
            self.reaeration_coefficient
            * deficit
            * weather_params.reaeration_factor
            * depth_factor
            * temp_factor
        )

    def calculate_saturation_do(self, temperature: float) -> float:
        STANDARD_DO_VALUES = {
            0: 14.6,
            5: 12.8,
            10: 11.3,
            15: 10.1,
            20: 9.1,
            25: 8.3,
            30: 7.6,
            35: 7.0,
            40: 6.5,
        }

        temp_clamped = max(0, min(40, temperature))

        temps = sorted(STANDARD_DO_VALUES.keys())

        if temp_clamped in temps:
            return STANDARD_DO_VALUES[temp_clamped]

        for i in range(len(temps) - 1):
            t1, t2 = temps[i], temps[i + 1]
            if t1 <= temp_clamped <= t2:
                do1 = STANDARD_DO_VALUES[t1]
                do2 = STANDARD_DO_VALUES[t2]
                ratio = (temp_clamped - t1) / (t2 - t1)
                return do1 + ratio * (do2 - do1)

        return 8.3

    def get_sediment_oxygen_demand(
        self, temperature: float, organic_load: float = 1.0
    ) -> float:
        temp_factor = 1.047 ** (temperature - 20)
        return self.sediment_oxygen_demand * temp_factor * organic_load

    def get_phytoplankton_respiration(
        self, temperature: float, biomass_factor: float = 1.0
    ) -> float:
        temp_factor = 1.045 ** (temperature - 20)
        return self.phytoplankton_respiration * temp_factor * biomass_factor

    def get_aeration_efficiency(
        self,
        aerator_power: float,
        water_depth: float,
        temperature: float,
    ) -> float:
        depth_factor = 1.0 + (water_depth - 1.5) * 0.1
        temp_factor = 1.0 - (temperature - 25) * 0.02
        temp_factor = max(0.7, temp_factor)

        base_efficiency = self.config["aerator"]["efficiency"]

        return base_efficiency * depth_factor * temp_factor

    def get_risk_level(self, dissolved_oxygen: float) -> str:
        if dissolved_oxygen < self.critical_do_level:
            return "critical"
        elif dissolved_oxygen < self.warning_do_level:
            return "warning"
        else:
            return "normal"

    def get_all_parameters(self) -> Dict[str, Any]:
        return {
            "fish_respiration_base": self.fish_respiration_base,
            "phytoplankton_respiration": self.phytoplankton_respiration,
            "sediment_oxygen_demand": self.sediment_oxygen_demand,
            "reaeration_coefficient": self.reaeration_coefficient,
            "photosynthesis_rate": self.photosynthesis_rate,
            "critical_do_level": self.critical_do_level,
            "warning_do_level": self.warning_do_level,
            "saturation_reference": self.saturation_reference,
            "fish_species": {k: v.__dict__ for k, v in FISH_SPECIES.items()},
            "weather_params": {k: v.__dict__ for k, v in WEATHER_PARAMS.items()},
        }
