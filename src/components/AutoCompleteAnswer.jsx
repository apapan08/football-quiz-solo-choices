import React, { useEffect, useState } from "react";
import { getCatalog, norm } from "../lib/catalogs";

export default function AutoCompleteAnswer({
  catalog,
  placeholder = "Άρχισε να πληκτρολογείς…",
  onSelect,
  onChangeText,
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0); // highlighted index

  useEffect(() => { onChangeText?.(q); }, [q, onChangeText]);

  useEffect(() => {
    let active = true;
    (async () => {
      const term = q.trim();
      const tnorm = norm(term);
      if (tnorm.length < 2) { setResults([]); setHi(0); return; }

      const { items, fuse } = await getCatalog(catalog);

      // generous prefix/substring + fuzzy, then dedupe
      const sub = items.filter(i => i._norm.startsWith(tnorm) || i._norm.includes(tnorm));
      const fuzzy = fuse.search(term).map(r => r.item);

      const seen = new Set();
      const out = [];
      for (const it of [...sub, ...fuzzy]) {
        if (!seen.has(it.id)) { seen.add(it.id); out.push(it); }
        if (out.length >= 10) break;
      }

      if (active) { setResults(out); setHi(0); }
    })();
    return () => { active = false; };
  }, [q, catalog]);

  const choose = (item) => {
    setQ(item.name);
    setOpen(false);
    onSelect?.(item);
  };

  function onKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      if (open && results[hi]) {
        e.preventDefault();
        choose(results[hi]);
      }
    }
  }

  return (
    <div className="relative z-40">
      <input
        className="w-full rounded-xl bg-slate-900/60 px-4 py-3 text-slate-100 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-pink-400"
        placeholder={placeholder}
        value={q}
        onChange={(e)=>{ setQ(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
        onBlur={()=>setTimeout(()=>setOpen(false),120)}
        onFocus={()=> q && setOpen(true)}
        autoComplete="off"
      />

      {open && (
        <div
          className="absolute z-50 mt-2 w-full rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: "var(--brand-card)",
            border: "1px solid var(--brand-border)",
            backdropFilter: "blur(6px)",
          }}
        >
          {results.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((r, i) => {
                const active = i === hi;
                return (
                  <li key={r.id}>
                    <button
                      className="group relative block w-full text-left px-4 py-2.5"
                      onMouseDown={(e)=>e.preventDefault()}
                      onMouseEnter={()=>setHi(i)}
                      onClick={()=>choose(r)}
                      style={{
                        color: "white",
                        background: active ? "rgba(241,20,103,0.14)" : "transparent",
                        borderLeft: active ? "3px solid var(--brand-accent)" : "3px solid transparent",
                      }}
                    >
                      <span className="text-sm font-semibold">{r.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              Δεν βρέθηκαν αποτελέσματα
            </div>
          )}
        </div>
      )}
    </div>
  );
}
