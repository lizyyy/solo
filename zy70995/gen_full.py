import pathlib
p = pathlib.Path('app/main.py')
content = p.read_text()
content += chr(10) + 'class SS(BaseModel): batch_no:str;student_name:str'
p.write_text(content)
