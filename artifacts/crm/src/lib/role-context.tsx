import { createContext, useContext, useState, useMemo, useCallback } from "react";

export type UserRole = "owner" | "cfo" | "manager" | "sales" | "broker";

export const ROLE_PROFILES: { value: UserRole; label: string; description: string; avatar: string; name: string; color: string }[] = [
  { value: "owner",    label: "Owner / Promoter", description: "Full platform access, all approvals", avatar: "HJ", name: "Harsh Jain",   color: "bg-amber-500"  },
  { value: "cfo",      label: "CFO / Finance",    description: "Finance data entry and visibility",   avatar: "RK", name: "Rakesh Kumar", color: "bg-blue-600"   },
  { value: "manager",  label: "Manager",           description: "Team oversight, approval authority",  avatar: "SJ", name: "Sneha Joshi",  color: "bg-green-600"  },
  { value: "sales",    label: "Salesperson",       description: "Lead management, data entry",         avatar: "RS", name: "Riya Sharma",  color: "bg-purple-600" },
  { value: "broker",   label: "Broker / Agent",    description: "External broker — leads and deals",   avatar: "VB", name: "Vijay Broker", color: "bg-teal-600"   },
];

export const ROLE_NAV_ACCESS: Record<UserRole, string[]> = {
  owner:    ["dashboard", "leads", "properties", "deals", "agents", "viewings", "whatsapp", "analytics", "commission", "integrations", "settings", "approvals", "activities"],
  cfo:      ["dashboard", "analytics", "commission", "settings"],
  manager:  ["dashboard", "leads", "properties", "deals", "agents", "viewings", "whatsapp", "analytics", "commission", "settings", "approvals", "activities"],
  sales:    ["dashboard", "leads", "properties", "deals", "activities"],
  broker:   ["dashboard", "leads", "properties", "commission", "activities"],
};

const RoleContext = createContext<{
  role: UserRole;
  setRole: (r: UserRole) => void;
  profile: typeof ROLE_PROFILES[number];
  can: (page: string) => boolean;
}>({
  role: "owner",
  setRole: () => {},
  profile: ROLE_PROFILES[0],
  can: () => true,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => (localStorage.getItem("ef_role_v2") as UserRole) ?? "owner");

  const setRole = useCallback((r: UserRole) => {
    localStorage.setItem("ef_role_v2", r);
    setRoleState(r);
  }, []);

  const profile = useMemo(() => ROLE_PROFILES.find(r => r.value === role) ?? ROLE_PROFILES[0], [role]);
  const can = useCallback((page: string) => ROLE_NAV_ACCESS[role].includes(page), [role]);
  const value = useMemo(() => ({ role, setRole, profile, can }), [role, setRole, profile, can]);

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
