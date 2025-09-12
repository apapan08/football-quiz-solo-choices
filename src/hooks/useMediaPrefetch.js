// src/hooks/useMediaPrefetch.js
import { useEffect } from "react";

/**
 * Prefetch next questions' media to warm the cache.
 * - Images: instantiate Image() (full fetch).
 * - Videos/Audio: off-DOM element with preload="metadata" (light).
 * Cleans up on index change.
 */
export function useMediaPrefetch(questions, currentIndex, lookahead = 2) {
  useEffect(() => {
    if (!Array.isArray(questions) || questions.length === 0) return;

    const cleaners = [];
    const seen = new Set();

    for (let step = 1; step <= lookahead; step++) {
      const q = questions[currentIndex + step];
      if (!q || !q.media) continue;

      const m = q.media;
      if (!m.src || seen.has(m.src)) continue;
      seen.add(m.src);

      // ---- Images ----
      if (m.kind === "image") {
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.src = m.src;

        // Hint (cheap)
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = m.src;
        document.head.appendChild(link);
        cleaners.push(() => {
          try { document.head.removeChild(link); } catch {}
        });
      }

      // ---- Videos ----
      else if (m.kind === "video") {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.muted = true;
        v.playsInline = true;
        v.src = m.src;
        try { v.load(); } catch {}

        cleaners.push(() => {
          try { v.pause(); } catch {}
          v.removeAttribute("src");
          try { v.load(); } catch {}
        });

        // Low-priority preload hint
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "video";
        link.href = m.src;
        link.setAttribute("fetchpriority", "low");
        document.head.appendChild(link);
        cleaners.push(() => {
          try { document.head.removeChild(link); } catch {}
        });

        // Optional: warm poster too
        if (m.poster) {
          const poster = document.createElement("link");
          poster.rel = "preload";
          poster.as = "image";
          poster.href = m.poster;
          document.head.appendChild(poster);
          cleaners.push(() => {
            try { document.head.removeChild(poster); } catch {}
          });
        }
      }

      // ---- Audio (if used) ----
      else if (m.kind === "audio") {
        const a = document.createElement("audio");
        a.preload = "metadata";
        a.src = m.src;
        try { a.load(); } catch {}

        cleaners.push(() => {
          a.removeAttribute("src");
          try { a.load(); } catch {}
        });

        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "audio";
        link.href = m.src;
        document.head.appendChild(link);
        cleaners.push(() => {
          try { document.head.removeChild(link); } catch {}
        });
      }
    }

    return () => {
      cleaners.forEach((fn) => fn());
    };
  }, [questions, currentIndex, lookahead]);
}
