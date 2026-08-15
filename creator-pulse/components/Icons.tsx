/**
 * Lucide-style strokes: 1.75, round caps and joins, currentColor. Icons are
 * functional here, never decorative — if one isn't earning its place, it's out.
 */
type Props = { size?: number; className?: string };

function Svg({ size = 14, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      {children}
    </svg>
  );
}

export const Heart = (p: Props) => (
  <Svg {...p}><path d="M19 14c1.5-1.5 2-3.3 2-5a5 5 0 0 0-9-3 5 5 0 0 0-9 3c0 1.7.5 3.5 2 5l7 7z" /></Svg>
);

export const Comment = (p: Props) => (
  <Svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" /></Svg>
);

export const Bookmark = (p: Props) => (
  <Svg {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></Svg>
);

export const Send = (p: Props) => (
  <Svg {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></Svg>
);

export const Eye = (p: Props) => (
  <Svg {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></Svg>
);

export const Play = (p: Props) => (
  <Svg {...p}><path d="m6 3 14 9-14 9z" /></Svg>
);

export const Layers = (p: Props) => (
  <Svg {...p}><path d="m12 2 9 5-9 5-9-5z" /><path d="m3 17 9 5 9-5" /><path d="m3 12 9 5 9-5" /></Svg>
);

export const Image = (p: Props) => (
  <Svg {...p}><rect x="3" y="3" width="18" height="18" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></Svg>
);

export const Users = (p: Props) => (
  <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></Svg>
);

export const Grid = (p: Props) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></Svg>
);

export const Refresh = (p: Props) => (
  <Svg {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></Svg>
);

export const Clock = (p: Props) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);

export const Calendar = (p: Props) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" /><path d="M16 3v4M8 3v4M3 11h18" /></Svg>
);

export const Info = (p: Props) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></Svg>
);

export const ChevronDown = (p: Props) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);

export const ChevronRight = (p: Props) => (
  <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
);

export const Instagram = (p: Props) => (
  <Svg {...p}><rect x="2" y="2" width="20" height="20" /><circle cx="12" cy="12" r="4.2" /><path d="M17.5 6.5h.01" /></Svg>
);

export const TikTok = (p: Props) => (
  <Svg {...p}><path d="M15 3v10.5a4 4 0 1 1-3.2-3.9" /><path d="M15 6.2A5.4 5.4 0 0 0 20 8.6" /></Svg>
);

export const ICONS = { Heart, Comment, Bookmark, Send, Eye, Play, Layers, Image };

export function PlatformIcon({ platform, size }: { platform: "instagram" | "tiktok"; size?: number }) {
  return platform === "instagram" ? <Instagram size={size} /> : <TikTok size={size} />;
}

export function FormatIcon({ format, size }: { format: string; size?: number }) {
  if (format === "carousel") return <Layers size={size} />;
  if (format === "photo") return <Image size={size} />;
  return <Play size={size} />;
}

export function KindIcon({ kind, size }: { kind: string; size?: number }) {
  if (kind === "comments") return <Comment size={size} />;
  if (kind === "saves") return <Bookmark size={size} />;
  if (kind === "shares") return <Send size={size} />;
  return <Heart size={size} />;
}
