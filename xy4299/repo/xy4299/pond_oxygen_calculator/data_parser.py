import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
from .config import DEFAULT_CONFIG


class DataValidationError(Exception):
    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__(f"Data validation failed with {len(errors)} errors")


class DataParser:
    REQUIRED_COLUMNS = [
        "timestamp",
        "pond_id",
        "temperature",
        "dissolved_oxygen",
        "fish_density",
        "feeding_rate",
        "weather",
    ]

    OPTIONAL_COLUMNS = [
        "pond_area",
        "water_depth",
        "aerator_count",
    ]

    WEATHER_TYPES = ["sunny", "cloudy", "rainy", "stormy", "foggy"]

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or DEFAULT_CONFIG
        self.validation_errors: List[str] = []
        self.warnings: List[str] = []

    def parse_csv(self, file_path: str) -> pd.DataFrame:
        try:
            df = pd.read_csv(file_path, parse_dates=["timestamp"])
        except Exception as e:
            raise DataValidationError([f"Failed to read CSV file: {str(e)}"])

        self._validate_columns(df)
        df = self._parse_and_convert(df)
        self._validate_ranges(df)
        df = self._handle_missing_values(df)

        if self.validation_errors:
            raise DataValidationError(self.validation_errors)

        return df

    def _validate_columns(self, df: pd.DataFrame) -> None:
        missing_columns = [
            col for col in self.REQUIRED_COLUMNS if col not in df.columns
        ]
        if missing_columns:
            self.validation_errors.append(
                f"Missing required columns: {', '.join(missing_columns)}"
            )

        extra_columns = [
            col
            for col in df.columns
            if col not in self.REQUIRED_COLUMNS and col not in self.OPTIONAL_COLUMNS
        ]
        if extra_columns:
            self.warnings.append(f"Unexpected columns will be ignored: {', '.join(extra_columns)}")

    def _parse_and_convert(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        invalid_timestamps = df["timestamp"].isna().sum()
        if invalid_timestamps > 0:
            self.validation_errors.append(
                f"Found {invalid_timestamps} invalid timestamp values"
            )

        numeric_columns = [
            "temperature",
            "dissolved_oxygen",
            "fish_density",
            "feeding_rate",
        ]
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        for col in self.OPTIONAL_COLUMNS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        if "weather" in df.columns:
            df["weather"] = df["weather"].str.lower().str.strip()
            invalid_weather = df[
                ~df["weather"].isin(self.WEATHER_TYPES) & df["weather"].notna()
            ]
            if len(invalid_weather) > 0:
                unique_invalid = invalid_weather["weather"].unique()
                self.validation_errors.append(
                    f"Invalid weather types: {', '.join(unique_invalid)}. "
                    f"Valid types: {', '.join(self.WEATHER_TYPES)}"
                )

        return df

    def _validate_ranges(self, df: pd.DataFrame) -> None:
        ranges = self.config["valid_ranges"]

        range_checks = [
            ("temperature", ranges["temperature"]),
            ("dissolved_oxygen", ranges["dissolved_oxygen"]),
            ("fish_density", ranges["fish_density"]),
            ("feeding_rate", ranges["feeding_rate"]),
        ]

        for col_name, range_config in range_checks:
            if col_name in df.columns:
                col = df[col_name]
                below_min = col < range_config["min"]
                above_max = col > range_config["max"]

                if below_min.any():
                    count = below_min.sum()
                    self.validation_errors.append(
                        f"{col_name}: {count} values below minimum ({range_config['min']})"
                    )

                if above_max.any():
                    count = above_max.sum()
                    self.validation_errors.append(
                        f"{col_name}: {count} values above maximum ({range_config['max']})"
                    )

    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        for col in df.columns:
            missing_count = df[col].isna().sum()
            if missing_count > 0 and col != "timestamp":
                self.warnings.append(
                    f"Found {missing_count} missing values in column '{col}'"
                )

        interpolation_method = self.config["interpolation"]["method"]
        max_gap = self.config["interpolation"]["max_gap_hours"]

        for pond_id in df["pond_id"].unique():
            pond_mask = df["pond_id"] == pond_id

            pond_df_sorted = df.loc[pond_mask].sort_values("timestamp").copy()
            original_indices = pond_df_sorted.index.tolist()

            numeric_cols = [
                "temperature",
                "dissolved_oxygen",
                "fish_density",
                "feeding_rate",
            ]

            for col in numeric_cols:
                if col in pond_df_sorted.columns:
                    if interpolation_method == "linear":
                        temp_df = pond_df_sorted.copy()
                        temp_df = temp_df.set_index("timestamp")
                        interpolated = temp_df[col].interpolate(
                            method="time",
                            limit=max_gap,
                            limit_direction="both",
                        )
                        interpolated = interpolated.reset_index(drop=True)
                        for idx, orig_idx in enumerate(original_indices):
                            df.loc[orig_idx, col] = interpolated.iloc[idx]
                    elif interpolation_method == "forward":
                        ffill_values = pond_df_sorted[col].ffill(limit=max_gap)
                        for idx, orig_idx in enumerate(original_indices):
                            df.loc[orig_idx, col] = ffill_values.iloc[idx]

            if "weather" in pond_df_sorted.columns:
                weather_values = pond_df_sorted["weather"].ffill().bfill()
                for idx, orig_idx in enumerate(original_indices):
                    df.loc[orig_idx, "weather"] = weather_values.iloc[idx]

        still_missing = df.isna().sum()
        for col, count in still_missing.items():
            if count > 0 and col != "timestamp":
                self.validation_errors.append(
                    f"Could not interpolate {count} missing values in column '{col}'"
                )

        return df

    def get_warnings(self) -> List[str]:
        return self.warnings.copy()

    @staticmethod
    def generate_sample_data(pond_count: int = 3, hours: int = 24) -> pd.DataFrame:
        np.random.seed(42)
        data = []

        base_time = pd.Timestamp.now().floor("H") - pd.Timedelta(hours=hours)

        for pond_id in range(1, pond_count + 1):
            base_temp = 25 + np.random.uniform(-2, 2)
            base_do = 6.5 + np.random.uniform(-1, 1)
            fish_density = 5000 + np.random.uniform(-1000, 1000)
            feeding_rate = 150 + np.random.uniform(-30, 30)

            for hour in range(hours):
                timestamp = base_time + pd.Timedelta(hours=hour)

                temp_variation = -3 * np.sin((hour + 6) * np.pi / 12)
                temperature = base_temp + temp_variation + np.random.normal(0, 0.5)

                do_variation = -2 * np.sin((hour + 6) * np.pi / 12)
                dissolved_oxygen = base_do + do_variation + np.random.normal(0, 0.3)

                hour_of_day = timestamp.hour
                if 6 <= hour_of_day < 10:
                    weather = "sunny" if np.random.random() > 0.3 else "cloudy"
                elif 10 <= hour_of_day < 16:
                    weather = "sunny" if np.random.random() > 0.5 else "cloudy"
                elif 16 <= hour_of_day < 20:
                    weather = "cloudy" if np.random.random() > 0.3 else "sunny"
                else:
                    weather = "cloudy"

                data.append({
                    "timestamp": timestamp,
                    "pond_id": f"P{pond_id:02d}",
                    "temperature": round(temperature, 1),
                    "dissolved_oxygen": round(dissolved_oxygen, 2),
                    "fish_density": round(fish_density, 0),
                    "feeding_rate": round(feeding_rate, 1),
                    "weather": weather,
                    "pond_area": 1.0,
                    "water_depth": 1.5,
                    "aerator_count": 4,
                })

        return pd.DataFrame(data)
