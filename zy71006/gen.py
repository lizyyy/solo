import os
APP_DIR='app'
os.makedirs(f'{APP_DIR}/uploads', exist_ok=True)
os.makedirs(f'{APP_DIR}/exports', exist_ok=True)
open(f'{APP_DIR}/__init__.py','w').close()
print("dirs created")
