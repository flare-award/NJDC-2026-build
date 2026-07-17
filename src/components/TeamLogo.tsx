interface Props {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}

export default function TeamLogo({ src, alt, size = 56, className = "" }: Props) {
  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-full bg-zinc-900 border border-white/10 text-zinc-500 font-display font-bold ${className}`}
      >
        {alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      style={{ width: size, height: size }}
      className={`rounded-full object-cover bg-black border border-white/10 ${className}`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
