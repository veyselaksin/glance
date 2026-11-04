import {
  Activity, AlertCircle, AlignLeft, Box, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle,
  ClipboardPaste, Clock, Contrast, Cpu, Database, Eye, EyeOff, ExternalLink, FileText, FolderOpen,
  GitBranch, GitCommitHorizontal, Github, FolderGit2, HardDrive, Info, Key, KeyRound, LayoutDashboard, List, Loader2, Lock, LockOpen, LogOut,
  MemoryStick, Moon, Network, Palette, Pencil, Play, PlayCircle, Plus, PowerOff, Radio, RotateCcw,
  RotateCw, ScrollText, Server, Settings, Square, StopCircle, Sun, Terminal, Trash2, TriangleAlert, User,
  X, type LucideIcon,
} from 'lucide-react';

/**
 * Icon registry. Keys are the Material Symbols names the codebase used before
 * the switch to lucide, so call sites read the same; new code may use any key.
 */
const ICONS: Record<string, LucideIcon> = {
  account_tree: Network,
  activity: Activity,
  add: Plus,
  check_circle: CheckCircle2,
  chevron_right: ChevronRight,
  container: Box,
  contrast: Contrast,
  dark_mode: Moon,
  dashboard: LayoutDashboard,
  delete_forever: Trash2,
  description: FileText,
  dns: Server,
  edit: Pencil,
  error: AlertCircle,
  warning: TriangleAlert,
  expand_less: ChevronUp,
  expand_more: ChevronDown,
  folder: FolderOpen,
  github: Github,
  commit: GitCommitHorizontal,
  branch: GitBranch,
  repo: FolderGit2,
  close: X,
  info: Info,
  key: Key,
  light_mode: Sun,
  lock: Lock,
  lock_open: LockOpen,
  logout: LogOut,
  memory: Cpu,
  memory_alt: MemoryStick,
  monitoring: Activity,
  open_in_new: ExternalLink,
  palette: Palette,
  paste: ClipboardPaste,
  path: FolderOpen,
  person: User,
  play_arrow: Play,
  play_circle: PlayCircle,
  power_off: PowerOff,
  progress_activity: Loader2,
  receipt_long: ScrollText,
  refresh: RotateCw,
  restart_alt: RotateCcw,
  schedule: Clock,
  sensors: Radio,
  settings: Settings,
  settings_ethernet: Github,
  stop: Square,
  stop_circle: StopCircle,
  storage: HardDrive,
  subject: AlignLeft,
  terminal: Terminal,
  view_list: List,
  visibility: Eye,
  visibility_off: EyeOff,
  vpn_key: KeyRound,
  database: Database,
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/** Bundled SVG icon (works offline). `progress_activity` spins automatically. */
export function Icon({ name, size = 16, className = '', strokeWidth = 1.75 }: IconProps) {
  const Cmp = ICONS[name] ?? Circle;
  const spin = name === 'progress_activity' ? ' animate-spin' : '';
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={`shrink-0 inline-block align-middle ${className}${spin}`.trim()}
      aria-hidden="true"
    />
  );
}
