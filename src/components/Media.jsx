// src/components/Media.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

const Media = React.memo(function Media({ media }) {
  if (!media || !media.kind) return null;

  if (media.kind === "image") return <OptimizedImage media={media} />;
  if (media.kind === "audio") return <OptimizedAudio media={media} />;
  if (media.kind === "video") return <OptimizedVideo media={media} />;

  return null;
});

export default Media;

/* -------------------- Image -------------------- */
function OptimizedImage({ media }) {
  const { src, alt = "", priority = false, webp, avif } = media;
  const [loaded, setLoaded] = useState(false);

  // Only include alternative sources if you actually provide them.
  // (No 404s or extra requests if you don't.)
  const sources = useMemo(
    () => ({
      avif: typeof avif === "string" ? avif : null,
      webp: typeof webp === "string" ? webp : null,
    }),
    [avif, webp]
  );

  return (
    <picture>
      {sources.avif && <source srcSet={sources.avif} type="image/avif" />}
      {sources.webp && <source srcSet={sources.webp} type="image/webp" />}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={priority ? "high" : "auto"}
        className={[
          "mx-auto rounded-xl object-contain",
          "w-full max-h-96",
          "transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onLoad={() => setLoaded(true)}
      />
    </picture>
  );
}

/* -------------------- Video -------------------- */

// Light hook: becomes true when the element is near the viewport
function useInView(ref, rootMargin = "300px") {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setInView(true);
        });
      },
      { root: null, rootMargin, threshold: 0.01 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

function OptimizedVideo({ media }) {
  const { src, type = "video/mp4", poster } = media;
  const vRef = useRef(null);
  const inView = useInView(vRef, "1000px");   // broaden rootMargin for earlier loading
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (inView && vRef.current) {
      vRef.current.preload = "auto";
    }
  }, [inView]);

  return (
    <video
      ref={vRef}
      controls
      preload="metadata"
      playsInline
      poster={poster}
      className={`w-full rounded-md bg-black/5 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
      onCanPlay={() => setReady(true)}
    >
      <source src={src} type={type} />
      Το πρόγραμμα περιήγησής σου δεν μπορεί να αναπαράγει αυτό το βίντεο.
    </video>
  );
}


/* -------------------- Audio -------------------- */
function OptimizedAudio({ media }) {
  const { src } = media;
  return (
    <audio
      controls
      preload="metadata"
      playsInline
      className="w-full mt-2"
      style={{ minHeight: 44 }}
    >
      <source src={src} type="audio/mpeg" />
      Το πρόγραμμα περιήγησής σου δεν μπορεί να αναπαράγει αυτό το ηχητικό.
    </audio>
  );
}
