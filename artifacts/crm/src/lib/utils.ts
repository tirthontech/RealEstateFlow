import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}k`;
  return `₹${value.toFixed(0)}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
export const DEAL_STAGES = ["prospect", "viewing", "offer", "under_contract", "due_diligence", "closed_won", "closed_lost"] as const;
export const LEAD_SOURCES = ["99acres", "magicbricks", "housing", "facebook", "google", "whatsapp", "referral", "walk_in", "website", "phone", "email", "other"] as const;
export const PROPERTY_TYPES = ["residential", "commercial", "land", "rental"] as const;
export const PROPERTY_STATUSES = ["available", "under_offer", "sold", "withdrawn"] as const;
export const MARKETS = ["US", "UK", "AU", "NZ", "EU"] as const;
export const AGENT_ROLES = ["admin", "manager", "agent", "support"] as const;

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-purple-100 text-purple-700",
    qualified: "bg-amber-100 text-amber-700",
    proposal: "bg-orange-100 text-orange-700",
    negotiation: "bg-yellow-100 text-yellow-700",
    closed_won: "bg-green-100 text-green-700",
    closed_lost: "bg-red-100 text-red-700",
    prospect: "bg-slate-100 text-slate-600",
    viewing: "bg-blue-100 text-blue-700",
    offer: "bg-amber-100 text-amber-700",
    under_contract: "bg-orange-100 text-orange-700",
    due_diligence: "bg-purple-100 text-purple-700",
    available: "bg-green-100 text-green-700",
    under_offer: "bg-amber-100 text-amber-700",
    sold: "bg-slate-100 text-slate-600",
    withdrawn: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

export function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}
