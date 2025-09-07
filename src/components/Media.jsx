import React from "react";

const Media = React.memo(function Media({ media }) {
  if (!media || !media.kind) return null;

  if (media.kind === "image") {
    return (
      <img
        src={media.src}
        alt={media.alt || ""}
        loading="lazy"
        className="max-h-96 w-auto mx-auto rounded-xl"
      />
    );
  }

  if (media.kind === "audio") {
    return (
      <audio
        controls
        preload="metadata"
        playsInline
        className="w-full mt-2"
        src={media.src}
        style={{ minHeight: 44 }}
      >
        <source src={media.src} type="audio/mpeg" />
        Το πρόγραμμα περιήγησής σου δεν μπορεί να αναπαράγει αυτό το ηχητικό.
      </audio>
    );
  }

  if (media.kind === "video") {
    return (
      <video
        controls
        preload="metadata"
        playsInline
        poster={media.poster}
        className="w-full max-h-[70vh] rounded-xl"
      >
        <source src={media.src} type={media.type || "video/mp4"} />
        Το πρόγραμμα περιήγησής σου δεν μπορεί να αναπαράγει αυτό το βίντεο.
      </video>
    );
  }

  return null;
});

export default Media;
