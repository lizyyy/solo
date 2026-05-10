from datetime import datetime
import random
import string


class IdGenerator:
    _COUNTERS = {}

    @classmethod
    def _get_counter(cls, prefix: str) -> int:
        today = datetime.now().strftime("%Y%m%d")
        key = f"{prefix}_{today}"
        if key not in cls._COUNTERS:
            cls._COUNTERS[key] = 0
        cls._COUNTERS[key] += 1
        return cls._COUNTERS[key]

    @classmethod
    def _random_suffix(cls, length: int = 4) -> str:
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))

    @classmethod
    def generate(cls, prefix: str) -> str:
        now = datetime.now()
        date_part = now.strftime("%Y%m%d")
        counter = cls._get_counter(prefix)
        return f"{prefix}{date_part}{counter:04d}{cls._random_suffix(2)}"

    @classmethod
    def deposit_order_no(cls) -> str:
        return cls.generate("DP")

    @classmethod
    def consume_order_no(cls) -> str:
        return cls.generate("CO")

    @classmethod
    def refund_request_no(cls) -> str:
        return cls.generate("RR")

    @classmethod
    def refund_order_no(cls) -> str:
        return cls.generate("RF")

    @classmethod
    def settlement_no(cls) -> str:
        return cls.generate("ST")

    @classmethod
    def journal_no(cls) -> str:
        return cls.generate("JL")

    @classmethod
    def account_no(cls) -> str:
        return cls.generate("AC")
