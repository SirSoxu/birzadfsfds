import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Camera,
  Code2,
  Gamepad2,
  GraduationCap,
  Megaphone,
  Music,
  Palette,
  PenLine,
  Video,
} from "lucide-react";
import type { SectionIconName } from "../lib/format";

const MAP: Record<SectionIconName, LucideIcon> = {
  palette: Palette,
  code: Code2,
  bot: Bot,
  megaphone: Megaphone,
  video: Video,
  pen: PenLine,
  camera: Camera,
  graduation: GraduationCap,
  gamepad: Gamepad2,
  music: Music,
};

export function SectionGlyph({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = MAP[name as SectionIconName] ?? Palette;
  return <Icon className={className} aria-hidden />;
}
