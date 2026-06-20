export function Seq({ sub }: { sub: string | number }) {
  return (
    <span className="font-mono">
      a<sub className="text-[0.72em]">{sub}</sub>
    </span>
  );
}
