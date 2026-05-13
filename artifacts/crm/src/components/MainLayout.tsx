import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Building2, GitBranch, UserCheck,
  Menu, BarChart3, MessageCircle, Plug2, Settings, Calculator,
  Calendar, Bell, X, Search, ChevronRight, ChevronDown,
  CheckSquare, CalendarCheck, Zap, LogOut, ShieldCheck,
  UserPlus, CheckCheck,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import {
  useGetLeads, useUpdateLead, useGetAgents,
  getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/lib/use-notifications";
import { useToast } from "@/hooks/use-toast";

/* ─── Nav definitions ──────────────────────────────────────────────────── */
const ALL_NAV = [
  { id: "dashboard",    href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { id: "leads",        href: "/leads",        label: "Leads",        icon: Users },
  { id: "properties",   href: "/properties",   label: "Properties",   icon: Building2 },
  { id: "deals",        href: "/deals",        label: "Deals",        icon: GitBranch },
  { id: "agents",       href: "/agents",       label: "Agents",       icon: UserCheck },
  { id: "viewings",     href: "/viewings",     label: "Viewings",     icon: Calendar },
  { id: "activities",   href: "/activities",   label: "Activities",   icon: CalendarCheck },
] as const;

const ALL_TOOLS = [
  { id: "whatsapp",     href: "/whatsapp",     label: "WhatsApp",     icon: MessageCircle },
  { id: "analytics",    href: "/analytics",    label: "Analytics",    icon: BarChart3 },
  { id: "commission",   href: "/commission",   label: "Commission",   icon: Calculator },
  { id: "integrations", href: "/integrations", label: "Integrations", icon: Plug2 },
] as const;

/* ─── Nav item ─────────────────────────────────────────────────────────── */
function NavItem({ href, label, icon: Icon, active, onNav, badge }: {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>;
  active: boolean; onNav: () => void; badge?: number;
}) {
  return (
    <Link href={href} data-testid={`nav-${label.toLowerCase()}`} onClick={onNav}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-100 relative",
        active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

/* ─── User profile + logout ─────────────────────────────────────────────── */
function UserProfile() {
  const { profile } = useRole();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    logout();
    setLocation("/login");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-accent/50 transition-colors"
      >
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0", profile.color)}>
          {profile.avatar}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-sidebar-foreground truncate">{profile.name}</p>
          <p className="text-[10px] text-sidebar-foreground/45 truncate">{profile.label}</p>
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-sidebar-foreground/40 transition-transform flex-shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden mx-2">
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-xs font-semibold text-foreground">{profile.name}</p>
              <p className="text-[10px] text-muted-foreground">{user?.username} · {profile.label}</p>
            </div>
            {user?.isAdmin && (
              <Link
                href="/admin/users"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-xs font-medium text-foreground"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Manage Users
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-destructive/5 transition-colors text-xs font-medium text-destructive"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Notification bell ────────────────────────────────────────────────── */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data, unreadCount, markRead, markAllRead } = useNotifications();
  const { toast } = useToast();
  const mountedRef = useRef(false);
  const prevIdsRef = useRef(new Set<number>());

  // Toast popup when new portal_lead notifications arrive (after initial mount)
  useEffect(() => {
    if (!data.length && !mountedRef.current) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevIdsRef.current = new Set(data.map(n => n.id));
      return;
    }
    const newPortalLeads = data.filter(
      n => !n.isRead && n.type === "portal_lead" && !prevIdsRef.current.has(n.id),
    );
    if (newPortalLeads.length > 0) {
      toast({
        title: `${newPortalLeads.length} new portal lead${newPortalLeads.length > 1 ? "s" : ""} received`,
        description: newPortalLeads[0].message ?? "New unassigned leads need your attention.",
      });
    }
    prevIdsRef.current = new Set(data.map(n => n.id));
  }, [data, toast]);

  function handleOpen() {
    setOpen(o => !o);
  }

  function handleNotificationClick(n: typeof data[0]) {
    markRead(n.id);
    setOpen(false);
    if (n.leadId) setLocation("/leads");
  }

  const typeIcon = (type: string) =>
    type === "portal_lead"
      ? <UserPlus className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
      : <Bell className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />;

  return (
    <div className="relative">
      <button data-testid="button-notifications" onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{unreadCount} new</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={() => markAllRead()} title="Mark all read"
                    className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded">
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {data.map((n) => (
                  <div key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer",
                      !n.isRead && "bg-primary/[0.03]",
                    )}>
                    <div className="flex items-start gap-2.5">
                      {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                      {n.isRead && <div className="w-1.5 h-1.5 mt-1.5 flex-shrink-0" />}
                      {typeIcon(n.type)}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs leading-snug", n.isRead ? "text-muted-foreground" : "font-medium text-foreground")}>{n.title}</p>
                        {n.message && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>}
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {new Date(n.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border px-4 py-2">
              <Link href="/leads" onClick={() => setOpen(false)} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                View all leads <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Global search ────────────────────────────────────────────────────── */
function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const searchParams = debouncedQuery.length >= 2 ? { search: debouncedQuery } : {};
  const { data: leads } = useGetLeads(
    searchParams,
    { query: { queryKey: getGetLeadsQueryKey(searchParams), enabled: open && debouncedQuery.length >= 2 } }
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const results = debouncedQuery.length >= 2 ? (leads ?? []).slice(0, 6) : [];

  const goTo = useCallback((path: string) => { setLocation(path); setOpen(false); setQuery(""); }, [setLocation]);

  return (
    <>
      <button
        data-testid="button-global-search"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground text-sm transition-colors w-48 lg:w-64"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-xs flex-1 text-left">Search leads...</span>
        <kbd className="hidden sm:inline-flex items-center text-[10px] border border-border rounded px-1 py-0.5 bg-background font-mono">⌘K</kbd>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search leads by name, email, phone..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query && <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
            </div>
            {query.length < 2 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">Type at least 2 characters to search</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">No leads found for "{query}"</div>
            ) : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {results.map((lead) => (
                  <li key={lead.id}>
                    <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left transition-colors" onClick={() => goTo(`/leads/${lead.id}`)}>
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {lead.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{lead.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.email} · {lead.phone ?? "—"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{lead.status.replace("_", " ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-border px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">↵ open · Esc close</span>
              <Link href="/leads" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">View all leads</Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ─── Unassigned Leads Alert (owner + manager only) ────────────────── */
function OnlineEnquiryAlert() {
  const { role } = useRole();
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: leads } = useGetLeads(
    {},
    { query: { queryKey: getGetLeadsQueryKey(), refetchInterval: 30_000 } }
  );
  const { data: agents } = useGetAgents();

  const updateLead = useUpdateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
      },
    },
  });

  // Show all unassigned leads regardless of source
  const newOnlineLeads = (leads ?? []).filter(l =>
    l.status === "unassigned" &&
    !dismissed.includes(l.id)
  );

  if ((role !== "owner" && role !== "manager") || newOnlineLeads.length === 0) return null;

  async function handleAssign() {
    setSaving(true);
    await Promise.all(
      newOnlineLeads
        .filter(l => assignments[l.id])
        .map(l => updateLead.mutateAsync({ id: l.id, data: { assignedTo: Number(assignments[l.id]) } }))
    );
    setSaving(false);
    setDismissed(prev => [...prev, ...newOnlineLeads.map(l => l.id)]);
    setShowModal(false);
  }

  return (
    <>
      <div className="mx-4 mt-3 mb-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Zap className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800">
            {newOnlineLeads.length} unassigned {newOnlineLeads.length === 1 ? "lead" : "leads"}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5 leading-snug">
            {newOnlineLeads.slice(0, 2).map(l => l.name).join(", ")}
            {newOnlineLeads.length > 2 ? ` +${newOnlineLeads.length - 2} more` : ""} — needs assignment
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => { setAssignments({}); setShowModal(true); }}
              className="text-[11px] font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded-md transition-colors"
            >
              Assign Now
            </button>
            <button
              onClick={() => setDismissed(prev => [...prev, ...newOnlineLeads.map(l => l.id)])}
              className="text-[11px] text-amber-600 hover:text-amber-800 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-semibold text-foreground">Assign Unassigned Leads</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-80 overflow-y-auto">
              {newOnlineLeads.map(lead => (
                <div key={lead.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{lead.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{lead.source} · {lead.phone ?? lead.email ?? "—"}</p>
                    </div>
                  </div>
                  <select
                    value={assignments[lead.id] ?? ""}
                    onChange={e => setAssignments(prev => ({ ...prev, [lead.id]: e.target.value }))}
                    className="w-full text-xs border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— Select agent —</option>
                    {(agents ?? []).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20">
              <button onClick={() => setShowModal(false)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={saving || newOnlineLeads.every(l => !assignments[l.id])}
                className="text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-1.5 rounded-lg transition-colors"
              >
                {saving ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ─── Main Layout ──────────────────────────────────────────────────── */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { can, role } = useRole();
  const { user } = useAuth();

  const approvalsBadge = 0;

  const mainNav = ALL_NAV.filter(n => can(n.id));
  const toolsNav = ALL_TOOLS.filter(n => can(n.id));
  const showSettings = can("settings");
  const showApprovals = can("approvals");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-sidebar-border">
          <img src="/logo.png" alt="EstateFlow" className="h-9 w-auto object-contain" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {mainNav.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest px-3 mb-1">Main</p>
              {mainNav.map(({ id, href, label, icon }) => (
                <NavItem key={id} href={href} label={label} icon={icon} active={location.startsWith(href) || (href === "/dashboard" && location === "/")} onNav={() => setOpen(false)} />
              ))}
            </div>
          )}

          {toolsNav.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest px-3 mb-1">Tools</p>
              {toolsNav.map(({ id, href, label, icon }) => (
                <NavItem key={id} href={href} label={label} icon={icon} active={location.startsWith(href)} onNav={() => setOpen(false)} />
              ))}
            </div>
          )}

          {showApprovals && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest px-3 mb-1">Workflow</p>
              <NavItem href="/approvals" label="Approvals" icon={CheckSquare} active={location.startsWith("/approvals")} onNav={() => setOpen(false)} badge={approvalsBadge} />
            </div>
          )}

          {user?.isAdmin && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest px-3 mb-1">Admin</p>
              <NavItem href="/admin/users" label="Manage Users" icon={ShieldCheck} active={location.startsWith("/admin/users")} onNav={() => setOpen(false)} />
            </div>
          )}
        </nav>

        {/* Settings */}
        {showSettings && (
          <div className="px-3 pb-2">
            <NavItem href="/settings" label="Settings" icon={Settings} active={location.startsWith("/settings")} onNav={() => setOpen(false)} />
          </div>
        )}

        {/* Online enquiry alert */}
        <OnlineEnquiryAlert />

        {/* User profile / logout */}
        <div className="border-t border-sidebar-border mt-2">
          <UserProfile />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b border-border px-4 py-2 bg-card">
          <button data-testid="button-mobile-menu" onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-muted lg:hidden flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center lg:hidden mr-2">
            <img src="/logo.png" alt="EstateFlow" className="h-7 w-auto object-contain" />
          </div>
          <div className="flex-1 flex justify-center lg:justify-start">
            <GlobalSearch />
          </div>
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
