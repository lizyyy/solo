import pathlib,base64,sys
B=pathlib.Path(".")
def w(r,c):(B/r).parent.mkdir(parents=True,exist_ok=True);(B/r).write_bytes(base64.b64decode(c));print("wrote",r)
def w2(r,c):(B/r).parent.mkdir(parents=True,exist_ok=True);(B/r).write_text(c,encoding="utf-8");print("wrote",r)
args=sys.argv[1:]
while args: r=args.pop(0); k=args.pop(0); c=args.pop(0); (w if k=="b64" else w2)(r,c)
