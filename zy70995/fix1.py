import pathlib
p = pathlib.Path('app/main.py')
content = p.read_text()
content = content.replace('message=f"classified: {cat}"', 'message=f"classified: {cat}" if t.state != "failed" else "processing failed"')
p.write_text(content)
