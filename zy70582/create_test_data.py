import pyarrow as pa
import pyarrow.parquet as pq
import pandas as pd
import os

os.makedirs('test_data', exist_ok=True)

# v1: base schema
df1 = pd.DataFrame({
    'id': [1, 2, 3, 4, 5],
    'name': ['a', 'b', 'c', 'd', 'e'],
    'value': [10.5, 20.3, 30.1, 40.7, 50.2],
})
table1 = pa.Table.from_pandas(df1)
pq.write_table(table1, 'test_data/v1.parquet')

# v2: add nullable field
df2 = pd.DataFrame({
    'id': [1, 2, 3, 4, 5],
    'name': ['a', 'b', 'c', 'd', 'e'],
    'value': [10.5, 20.3, 30.1, 40.7, 50.2],
    'new_col': [None, 'x', 'y', None, 'z'],
})
table2 = pa.Table.from_pandas(df2)
pq.write_table(table2, 'test_data/v2.parquet')

# v3: type promotion (int -> int64 is okay, but let's add incompatible one)
df3 = pd.DataFrame({
    'id': [1, 2, 3, 4, 5],
    'name': ['a', 'b', 'c', 'd', 'e'],
    'value': ['10', '20', '30', '40', '50'],  # float -> string, incompatible
})
table3 = pa.Table.from_pandas(df3)
pq.write_table(table3, 'test_data/v3_incompatible.parquet')

print('✓ Test parquet files created in test_data/')
print('   - v1.parquet: base schema')
print('   - v2.parquet: adds new nullable field (backward compatible)')
print('   - v3_incompatible.parquet: type change (float -> string, incompatible)')
