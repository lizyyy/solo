import { useEffect, useRef } from "react";
import katex from "katex";

interface Props {
  tex: string;
  display?: boolean;
  className?: string;
}

export default function KatexBlock({ tex, display = false, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, {
        throwOnError: false,
        displayMode: display,
        output: "html",
      });
    } catch (e) {
      ref.current.textContent = tex;
    }
  }, [tex, display]);
  return <span ref={ref} className={className} />;
}
