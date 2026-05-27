import { createContext, useContext, useMemo, useCallback } from "react";
import { useAuth } from "./auth-context";

export type UserRole = "owner" | "cfo" | "manager" | "agent" | "broker";

// Role metadata (colors, labels) — name/avatar override comes from auth user
export const ROLE_PROFILES: {
  value: UserRole;
  label: string;
  description: string;
  avatar: string;
  name: string;
  color: string;
}[] = [
  { value: "owner",   label: "Owner / Promoter", description: "Full platform access, all approvals",        avatar: "HJ", name: "Harsh Jain",   color: "bg-amber-500"  },
  { value: "cfo",     label: "CFO / Finance",    description: "Finance data entry and visibility",           avatar: "RK", name: "Rakesh Kumar", color: "bg-blue-600"   },
  { value: "manager", label: "Manager",           description: "Team oversight, approval authority",          avatar: "SJ", name: "Sneha Joshi",  color: "bg-green-600"  },
  { value: "agent",   label: "In-House Sales Agent",      description: "In-house sales — leads, deals, follow-ups",      avatar: "RS", name: "Riya Sharma",  color: "bg-purple-600" },
  { value: "broker",  label: "External Channel Partner", description: "Channel partner — referrals and commission",    avatar: "VB", name: "Vijay Broker", color: "bg-teal-600"   },
];

export const ROLE_NAV_ACCESS: Record<UserRole, string[]> = {
  owner:   ["dashboard", "leads", "properties", "deals", "agents", "viewings", "commission", "payment-plans", "ad-spend", "whatsapp", "settings", "approvals", "activities"],
  cfo:     ["dashboard", "commission", "payment-plans", "ad-spend", "settings"],
  manager: ["dashboard", "leads", "properties", "deals", "agents", "viewings", "commission", "payment-plans", "ad-spend", "whatsapp", "settings", "approvals", "activities"],
  agent:   ["dashboard", "leads", "properties", "deals", "viewings", "whatsapp", "settings", "activities"],
  broker:  ["dashboard", "leads", "properties", "deals", "viewings", "commission", "whatsapp", "settings", "activities"],
};

const RoleContext = createContext<{
  role: UserRole;
  profile: typeof ROLE_PROFILES[number];
  can: (page: string) => boolean;
}>({
  role: "agent",
  profile: ROLE_PROFILES.find(r => r.value === "agent")!,
  can: () => false,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const role = (user?.role ?? "agent") as UserRole;

  const profile = useMemo(() => {
    const base = ROLE_PROFILES.find(r => r.value === role) ?? ROLE_PROFILES[3];
    if (!user) return base;

    // Override name and avatar with the real logged-in user's details
    const parts = user.name.trim().split(/\s+/);
    const avatar = parts.map(p => p[0]).join("").slice(0, 2).toUpperCase();
    return { ...base, name: user.name, avatar };
  }, [role, user]);

  const can = useCallback(
    (page: string) => ROLE_NAV_ACCESS[role]?.includes(page) ?? false,
    [role],
  );

  const value = useMemo(() => ({ role, profile, can }), [role, profile, can]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
