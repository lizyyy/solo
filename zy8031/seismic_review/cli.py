import os
import sys
import click
from pathlib import Path
from typing import Optional

from .data_loader import load_stations, load_events, load_waveforms
from .signal_processing import process_waveform
from .picker import STA_LTA_Picker, pick_arrivals, compare_arrivals
from .report import ReportGenerator, plot_waveform_preview


@click.group()
@click.version_option(version="0.1.0")
def main():
    pass


@main.command()
@click.option(
    "--station-csv",
    "-s",
    required=True,
    type=click.Path(exists=True),
    help="Path to station CSV file"
)
@click.option(
    "--events-json",
    "-e",
    required=True,
    type=click.Path(exists=True),
    help="Path to events JSON file"
)
@click.option(
    "--waveform-dir",
    "-w",
    required=True,
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    help="Directory containing waveform CSV files"
)
@click.option(
    "--output-dir",
    "-o",
    default="out",
    type=click.Path(file_okay=False, dir_okay=True),
    help="Output directory for reports and figures"
)
@click.option(
    "--window-before",
    default=30.0,
    type=float,
    help="Window before event origin time (seconds)"
)
@click.option(
    "--window-after",
    default=60.0,
    type=float,
    help="Window after event origin time (seconds)"
)
@click.option(
    "--lowcut",
    default=1.0,
    type=float,
    help="Bandpass low frequency (Hz)"
)
@click.option(
    "--highcut",
    default=20.0,
    type=float,
    help="Bandpass high frequency (Hz)"
)
@click.option(
    "--sta-length",
    default=1.0,
    type=float,
    help="STA window length (seconds)"
)
@click.option(
    "--lta-length",
    default=15.0,
    type=float,
    help="LTA window length (seconds)"
)
@click.option(
    "--threshold-on",
    default=3.0,
    type=float,
    help="STA/LTA trigger on threshold"
)
@click.option(
    "--threshold-off",
    default=1.5,
    type=float,
    help="STA/LTA trigger off threshold"
)
@click.option(
    "--tolerance",
    default=2.0,
    type=float,
    help="Arrival time comparison tolerance (seconds)"
)
@click.option(
    "--common-sr",
    default=None,
    type=float,
    help="Common sampling rate for resampling (Hz). If not set, uses native rates"
)
@click.option(
    "--generate-png/--no-png",
    default=False,
    help="Generate PNG waveform previews"
)
@click.option(
    "--event-id",
    default=None,
    type=str,
    help="Process only specific event ID"
)
def review(
    station_csv: str,
    events_json: str,
    waveform_dir: str,
    output_dir: str,
    window_before: float,
    window_after: float,
    lowcut: float,
    highcut: float,
    sta_length: float,
    lta_length: float,
    threshold_on: float,
    threshold_off: float,
    tolerance: float,
    common_sr: Optional[float],
    generate_png: bool,
    event_id: Optional[str]
):
    click.echo("=" * 60)
    click.echo("地震波形复核工具 v0.1.0")
    click.echo("=" * 60)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    click.echo("\n[1/6] 加载台站数据...")
    stations = load_stations(station_csv)
    click.echo(f"  加载 {len(stations)} 个台站")

    click.echo("\n[2/6] 加载事件数据...")
    events = load_events(events_json)
    click.echo(f"  加载 {len(events)} 个事件")

    if event_id:
        events = [e for e in events if e.event_id == event_id]
        if not events:
            click.echo(f"错误: 未找到事件 {event_id}", err=True)
            sys.exit(1)
        click.echo(f"  筛选事件: {event_id}")

    picker = STA_LTA_Picker(
        sta_length=sta_length,
        lta_length=lta_length,
        threshold_on=threshold_on,
        threshold_off=threshold_off
    )

    all_anomalies = []

    click.echo("\n[3/6] 处理波形数据...")
    for idx, event in enumerate(events, 1):
        click.echo(f"\n  处理事件 {idx}/{len(events)}: {event.event_id}")

        try:
            waveforms = load_waveforms(
                waveform_dir,
                stations,
                event,
                window_before=window_before,
                window_after=window_after,
                common_sampling_rate=common_sr
            )
        except FileNotFoundError as e:
            click.echo(f"    警告: {e}", err=True)
            continue

        station_count = len(waveforms)
        click.echo(f"    加载 {station_count} 个台站波形")

        stations_with_gaps = []
        for sta_key, ch_data in waveforms.items():
            for ch, wv in ch_data.items():
                if wv.has_gap:
                    stations_with_gaps.append(sta_key)
                    click.echo(f"    台站 {sta_key} 检测到波形缺段")

        click.echo("\n[4/6] STA/LTA 拾取...")
        picks = pick_arrivals(waveforms, event, picker)

        total_picks = sum(len(p) for p_list in picks.values() for p in p_list.values())
        click.echo(f"    共拾取 {total_picks} 个到时")

        click.echo("\n[5/6] 与人工到时表比对...")
        anomalies, matched_stations = compare_arrivals(picks, event, tolerance=tolerance)

        click.echo(f"    异常台站: {len(anomalies)}")
        for a in anomalies:
            click.echo(f"      - {a['station']}: {a['reason']}")

        all_anomalies.extend([
            {**a, "event_id": event.event_id} for a in anomalies
        ])

        click.echo("\n[6/6] 生成报告...")
        gen = ReportGenerator(str(output_path / f"event_{event.event_id}"))

        report_path = gen.generate_event_report(
            event, anomalies, matched_stations,
            waveform_previews=waveforms if generate_png else None
        )
        click.echo(f"    Markdown 报告: {report_path}")

        anomalies_csv = gen.generate_anomalies_csv(anomalies, event)
        click.echo(f"    异常台站 CSV: {anomalies_csv}")

        if generate_png:
            png_dir = output_path / f"event_{event.event_id}" / "waveforms"
            png_dir.mkdir(parents=True, exist_ok=True)

            import dateutil.parser
            event_origin = dateutil.parser.parse(event.origin_time).timestamp()

            for sta_key, ch_data in waveforms.items():
                for ch, wv in ch_data.items():
                    if ch in picks.get(sta_key, {}):
                        sta_picks = picks[sta_key][ch]
                    else:
                        sta_picks = []
                    png_path = png_dir / f"{sta_key}_{ch}.png"
                    plot_waveform_preview(
                        wv, sta_picks, event_origin,
                        str(png_path),
                        title=f"{sta_key} {ch}",
                        duration=window_before + window_after
                    )
            click.echo(f"    PNG 预览: {png_dir}")

    all_anomalies_csv = output_path / "all_anomalies.csv"
    if all_anomalies:
        with open(all_anomalies_csv, "w", encoding="utf-8", newline="") as f:
            f.write("station,network,event_id,anomaly_reason,details\n")
            for a in all_anomalies:
                station = a.get("station", "")
                parts = station.split(".")
                net = parts[0] if len(parts) > 1 else ""
                sta = parts[1] if len(parts) > 1 else station
                reason = a.get("reason", "unknown")
                details = str(a.get("details", "")).replace(",", ";").replace("\n", " ")
                f.write(f"{sta},{net},{a.get('event_id', '')},{reason},{details}\n")
        click.echo(f"\n汇总异常台站 CSV: {all_anomalies_csv}")

    click.echo("\n" + "=" * 60)
    click.echo("复核完成!")
    click.echo("=" * 60)


if __name__ == "__main__":
    main()
