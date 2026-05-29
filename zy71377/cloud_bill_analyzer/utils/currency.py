from typing import Optional, Tuple
from ..core.models import CURRENCY_MAP
from ..core.config import Config


def normalize_currency_code(currency: str) -> str:
    if not currency:
        return ""
    currency_upper = currency.strip().upper()
    if currency_upper in CURRENCY_MAP:
        return CURRENCY_MAP[currency_upper]
    return currency_upper


def convert_currency(
    amount: float,
    from_currency: str,
    to_currency: str,
    config: Config,
) -> Tuple[float, float]:
    from_norm = normalize_currency_code(from_currency)
    to_norm = normalize_currency_code(to_currency)

    if from_norm == to_norm:
        return amount, 1.0

    if from_norm not in config.exchange_rates:
        raise ValueError(f"Unsupported currency: {from_currency} (normalized: {from_norm})")
    if to_norm not in config.exchange_rates:
        raise ValueError(f"Unsupported target currency: {to_currency} (normalized: {to_norm})")

    from_rate = config.exchange_rates[from_norm]
    to_rate = config.exchange_rates[to_norm]

    exchange_rate = from_rate / to_rate
    converted = amount * exchange_rate

    return converted, exchange_rate
