// PROTOTYPE: floating variant switcher for throwaway UI prototypes. Not production code.
import { useEffect } from "react";
import { useSearchParams } from "react-router";

export function PrototypeSwitcher({
  variants,
  status,
}: {
  variants: { key: string; name: string }[];
  status?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get("variant") ?? variants[0].key;
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  );

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    const params = new URLSearchParams(searchParams);
    params.set("variant", next.key);
    setSearchParams(params, { replace: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-2xl ring-2 ring-yellow-400">
      <button onClick={() => go(-1)} className="px-1 hover:text-yellow-300">
        ←
      </button>
      <span className="font-mono">
        {variants[index].key} ({variants[index].name})
      </span>
      <button onClick={() => go(1)} className="px-1 hover:text-yellow-300">
        →
      </button>
      {status && (
        <span className="border-l border-white/30 pl-3 font-mono text-xs text-white/70">
          {status}
        </span>
      )}
    </div>
  );
}
