from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
import json
import numpy as np

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.ticker import FuncFormatter

    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

from .models import IndexPoint, ProcessingResult, AuctionRecord


class IndexVisualizer:
    def __init__(self, style: str = "seaborn-v0_8", dpi: int = 150):
        self.style = style
        self.dpi = dpi
        if MATPLOTLIB_AVAILABLE:
            try:
                plt.style.use(style)
            except:
                pass

    def _format_currency(self, x, pos):
        if x >= 1e6:
            return f"${x/1e6:.1f}M"
        elif x >= 1e3:
            return f"${x/1e3:.0f}K"
        else:
            return f"${x:.0f}"

    def plot_index_trend(
        self,
        index_series: List[IndexPoint],
        output_path: str,
        title: str = "艺术品价格指数",
    ) -> bool:
        if not MATPLOTLIB_AVAILABLE or not index_series:
            return False

        dates = [p.period_start for p in index_series]
        values = [p.index_value for p in index_series]
        record_counts = [p.record_count for p in index_series]

        fig, ax1 = plt.subplots(figsize=(12, 6))

        ax1.plot(
            dates,
            values,
            "b-",
            linewidth=2,
            marker="o",
            markersize=4,
            label="价格指数",
        )
        ax1.fill_between(dates, values, alpha=0.15, color="blue")

        ax1.set_xlabel("时间")
        ax1.set_ylabel("指数值 (基期=100)", color="blue")
        ax1.tick_params(axis="y", labelcolor="blue")
        ax1.grid(True, alpha=0.3)

        ax2 = ax1.twinx()
        ax2.bar(
            dates,
            record_counts,
            alpha=0.3,
            color="gray",
            width=20,
            label="成交量",
        )
        ax2.set_ylabel("成交量", color="gray")
        ax2.tick_params(axis="y", labelcolor="gray")

        plt.title(title, fontsize=14, fontweight="bold", pad=20)

        ax1.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
        fig.autofmt_xdate()

        lines1, labels1 = ax1.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left")

        plt.tight_layout()
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_path, dpi=self.dpi, bbox_inches="tight")
        plt.close()

        return True

    def plot_price_distribution(
        self,
        records: List[AuctionRecord],
        output_path: str,
        title: str = "成交价格分布",
    ) -> bool:
        if not MATPLOTLIB_AVAILABLE:
            return False

        valid_prices = [
            r.usd_price
            for r in records
            if r.usd_price is not None and not r.is_outlier and r.duplicate_of is None
        ]

        if not valid_prices:
            return False

        prices_array = np.array(valid_prices)
        log_prices = np.log1p(prices_array)

        fig, axes = plt.subplots(1, 2, figsize=(14, 5))

        axes[0].hist(prices_array, bins=50, color="skyblue", edgecolor="black", alpha=0.7)
        axes[0].set_xlabel("价格 (USD)")
        axes[0].set_ylabel("频次")
        axes[0].set_title("原始价格分布")
        axes[0].xaxis.set_major_formatter(FuncFormatter(self._format_currency))
        axes[0].grid(True, alpha=0.3)

        axes[1].hist(log_prices, bins=50, color="lightgreen", edgecolor="black", alpha=0.7)
        axes[1].set_xlabel("对数价格 (log(1+价格))")
        axes[1].set_ylabel("频次")
        axes[1].set_title("对数价格分布")
        axes[1].grid(True, alpha=0.3)

        plt.suptitle(title, fontsize=14, fontweight="bold")
        plt.tight_layout()

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_path, dpi=self.dpi, bbox_inches="tight")
        plt.close()

        return True

    def plot_by_medium(
        self,
        records: List[AuctionRecord],
        output_path: str,
        top_n: int = 10,
        title: str = "各媒介价格对比",
    ) -> bool:
        if not MATPLOTLIB_AVAILABLE:
            return False

        medium_prices: Dict[str, List[float]] = {}
        for record in records:
            if (
                record.usd_price is not None
                and record.medium_name
                and not record.is_outlier
                and record.duplicate_of is None
            ):
                if record.medium_name not in medium_prices:
                    medium_prices[record.medium_name] = []
                medium_prices[record.medium_name].append(record.usd_price)

        if not medium_prices:
            return False

        sorted_media = sorted(
            medium_prices.keys(), key=lambda m: len(medium_prices[m]), reverse=True
        )[:top_n]

        data = [medium_prices[m] for m in sorted_media]

        fig, ax = plt.subplots(figsize=(12, 6))
        bp = ax.boxplot(data, labels=sorted_media, patch_artist=True)

        colors = plt.cm.Set3(np.linspace(0, 1, len(sorted_media)))
        for patch, color in zip(bp["boxes"], colors):
            patch.set_facecolor(color)
            patch.set_alpha(0.7)

        ax.set_ylabel("价格 (USD)")
        ax.set_title(title, fontsize=14, fontweight="bold")
        ax.yaxis.set_major_formatter(FuncFormatter(self._format_currency))
        ax.grid(True, alpha=0.3, axis="y")
        plt.xticks(rotation=45, ha="right")

        plt.tight_layout()
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_path, dpi=self.dpi, bbox_inches="tight")
        plt.close()

        return True

    def plot_by_artist(
        self,
        records: List[AuctionRecord],
        output_path: str,
        top_n: int = 15,
        title: str = "主要艺术家成交均价",
    ) -> bool:
        if not MATPLOTLIB_AVAILABLE:
            return False

        artist_stats: Dict[str, Dict[str, float]] = {}
        for record in records:
            if (
                record.usd_price is not None
                and record.artist_name
                and not record.is_outlier
                and record.duplicate_of is None
            ):
                name = record.artist_name
                if name not in artist_stats:
                    artist_stats[name] = {"sum": 0, "count": 0, "prices": []}
                artist_stats[name]["sum"] += record.usd_price
                artist_stats[name]["count"] += 1
                artist_stats[name]["prices"].append(record.usd_price)

        if not artist_stats:
            return False

        sorted_artists = sorted(
            artist_stats.items(),
            key=lambda x: x[1]["sum"] / x[1]["count"],
            reverse=True,
        )[:top_n]

        names = [a[0] for a in sorted_artists]
        avg_prices = [a[1]["sum"] / a[1]["count"] for a in sorted_artists]
        counts = [a[1]["count"] for a in sorted_artists]

        fig, ax1 = plt.subplots(figsize=(14, 7))

        bars = ax1.bar(names, avg_prices, color="coral", alpha=0.7)
        ax1.set_ylabel("平均价格 (USD)")
        ax1.set_title(title, fontsize=14, fontweight="bold")
        ax1.yaxis.set_major_formatter(FuncFormatter(self._format_currency))
        plt.xticks(rotation=45, ha="right")

        for bar, count in zip(bars, counts):
            height = bar.get_height()
            ax1.text(
                bar.get_x() + bar.get_width() / 2.0,
                height,
                f"n={count}",
                ha="center",
                va="bottom",
                fontsize=8,
            )

        plt.tight_layout()
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_path, dpi=self.dpi, bbox_inches="tight")
        plt.close()

        return True

    def generate_all_charts(
        self, result: ProcessingResult, output_dir: str
    ) -> Dict[str, str]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        charts = {}

        if result.index_series:
            trend_path = str(output_path / "index_trend.png")
            if self.plot_index_trend(result.index_series, trend_path):
                charts["index_trend"] = trend_path

        if result.records:
            dist_path = str(output_path / "price_distribution.png")
            if self.plot_price_distribution(result.records, dist_path):
                charts["price_distribution"] = dist_path

            medium_path = str(output_path / "price_by_medium.png")
            if self.plot_by_medium(result.records, medium_path):
                charts["price_by_medium"] = medium_path

            artist_path = str(output_path / "price_by_artist.png")
            if self.plot_by_artist(result.records, artist_path):
                charts["price_by_artist"] = artist_path

        return charts
