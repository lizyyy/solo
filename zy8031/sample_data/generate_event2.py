import numpy as np
from datetime import datetime, timedelta
import os

base_dir = '/Users/lzy/pro/solocoder/pro/zy8031/repo/zy8031/sample_data'
os.makedirs(base_dir, exist_ok=True)

sampling_rate = 100.0
duration_before = 35.0
duration_after = 65.0
origin_time = datetime(2025, 5, 1, 14, 15, 0)

def create_waveform_csv(network, station, channel, travel_time_p, output_path):
    start_time = origin_time - timedelta(seconds=duration_before)
    n_samples = int((duration_before + duration_after) * sampling_rate)
    times = [start_time + timedelta(seconds=i/sampling_rate) for i in range(n_samples)]

    data = np.random.randn(n_samples) * 0.01

    p_arrival_sample = int(travel_time_p * sampling_rate)

    for i in range(max(0, p_arrival_sample - 50), min(n_samples, p_arrival_sample + 200)):
        t = (i - p_arrival_sample) / sampling_rate
        amp = 0.4 * np.exp(-abs(t) * 10) * np.sin(2 * np.pi * 5 * t)
        if 0 <= i < n_samples:
            data[i] += amp

    with open(output_path, 'w') as f:
        f.write('time,data\n')
        for t, d in zip(times, data):
            f.write(f'{t.isoformat()},{d:.6f}\n')

create_waveform_csv('HB', 'QISH', 'BHZ', 4.8, f'{base_dir}/HB.QISH.BHZ.csv')
create_waveform_csv('HB', 'QISH', 'BHN', 4.8, f'{base_dir}/HB.QISH.BHN.csv')
create_waveform_csv('HB', 'QISH', 'BHE', 4.8, f'{base_dir}/HB.QISH.BHE.csv')

create_waveform_csv('HB', 'WUHAN', 'BHZ', 10.2, f'{base_dir}/HB.WUHAN.BHZ.csv')
create_waveform_csv('HB', 'WUHAN', 'BHN', 10.2, f'{base_dir}/HB.WUHAN.BHN.csv')
create_waveform_csv('HB', 'WUHAN', 'BHE', 10.2, f'{base_dir}/HB.WUHAN.BHE.csv')

create_waveform_csv('SN', 'XIANGL', 'BHZ', 15.6, f'{base_dir}/SN.XIANGL.BHZ.csv')
create_waveform_csv('SN', 'XIANGL', 'BHN', 15.6, f'{base_dir}/SN.XIANGL.BHN.csv')
create_waveform_csv('SN', 'XIANGL', 'BHE', 15.6, f'{base_dir}/SN.XIANGL.BHE.csv')

print('Event 2 waveforms created')
