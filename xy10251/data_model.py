import pandas as pd
from datetime import datetime, timedelta
from config import CAPACITY_L, BINS_META


class BinManager:
    def __init__(self):
        self.bins_df = pd.DataFrame(BINS_META)
        self.bins_df['capacity'] = self.bins_df['model'].map(CAPACITY_L)
        self.bins_df['last_clean'] = pd.to_datetime(self.bins_df['last_clean'])

    def get_bin(self, bin_id):
        row = self.bins_df[self.bins_df['bin_id'] == bin_id]
        if len(row) == 0:
            return None
        return row.iloc[0]

    def get_all_bins(self):
        return self.bins_df

    def update_last_clean(self, bin_id, clean_date):
        idx = self.bins_df[self.bins_df['bin_id'] == bin_id].index
        if len(idx) > 0:
            self.bins_df.loc[idx, 'last_clean'] = pd.to_datetime(clean_date)


class DropRecord:
    def __init__(self):
        self.columns = [
            'record_id', 'bin_id', 'drop_time', 'volume_l',
            'source', 'submitter', 'submit_time', 'status'
        ]
        self.allowed_status = ['valid', 'duplicate', 'conflict', 'missing']
        self.df = pd.DataFrame(columns=self.columns)

    def add_record(self, record_dict):
        for col in self.columns:
            if col not in record_dict:
                record_dict[col] = None

        if 'status' not in record_dict or record_dict['status'] not in self.allowed_status:
            record_dict['status'] = 'valid'

        new_row = pd.DataFrame([record_dict])
        self.df = pd.concat([self.df, new_row], ignore_index=True)
        return len(self.df) - 1

    def get_records(self, bin_id=None, start_date=None, end_date=None, status=None):
        df = self.df.copy()

        if bin_id:
            df = df[df['bin_id'] == bin_id]
        if start_date:
            df = df[df['drop_time'] >= pd.to_datetime(start_date)]
        if end_date:
            df = df[df['drop_time'] <= pd.to_datetime(end_date)]
        if status:
            df = df[df['status'] == status]

        return df

    def set_status(self, record_id, status):
        if status not in self.allowed_status:
            raise ValueError(f'Invalid status')

        idx = self.df[self.df['record_id'] == record_id].index
        if len(idx) > 0:
            self.df.loc[idx, 'status'] = status
            return True
        return False

    def load_from_csv(self, file_path):
        df = pd.read_csv(file_path)
        df['drop_time'] = pd.to_datetime(df['drop_time'])
        if 'submit_time' in df.columns:
            df['submit_time'] = pd.to_datetime(df['submit_time'])
        self.df = df
        return len(df)
