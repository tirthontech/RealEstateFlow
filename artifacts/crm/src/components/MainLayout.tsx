import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Building2, GitBranch, UserCheck,
  Menu, BarChart3, MessageCircle, Plug2, Settings, Calculator,
  Calendar, Bell, X, Search, ChevronRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useGetRecentActivity, useGetLeads, getGetRecentActivityQueryKey, getGetLeadsQueryKey } from "@workspace/api-client-react";

const mainNav = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/leads",        label: "Leads",        icon: Users },
  { href: "/properties",   label: "Properties",   icon: Building2 },
  { href: "/deals",        label: "Deals",        icon: GitBranch },
  { href: "/agents",       label: "Agents",       icon: UserCheck },
  { href: "/viewings",     label: "Viewings",     icon: Calendar },
];

const toolsNav = [
  { href: "/whatsapp",     label: "WhatsApp",     icon: MessageCircle },
  { href: "/analytics",    label: "Analytics",    icon: BarChart3 },
  { href: "/commission",   label: "Commission",   icon: Calculator },
  { href: "/integrations", label: "Integrations", icon: Plug2 },
];

function NavSection({ label, items, location, onNav }: {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  location: string;
  onNav: () => void;
}) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest px-3 mb-1">{label}</p>
      {items.map(({ href, label: itemLabel, icon: Icon }) => {
        const active = location.startsWith(href) || (href === "/dashboard" && location === "/");
        return (
          <Link key={href} href={href} data-testid={`nav-${itemLabel.toLowerCase()}`} onClick={onNav}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-100",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {itemLabel}
          </Link>
        );
      })}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: activity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey(), refetchInterval: 60_000 },
  });
  const items = activity ?? [];
  const unread = Math.min(items.length, 9);

  return (
    <div className="relative">
      <button data-testid="button-notifications" onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            {items.length === 0 ? (
              <div className="py-8 text-center"><Bell className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">All caught up!</p></div>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {items.slice(0, 8).map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-foreground leading-snug">{item.entityName} — {item.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(item.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {item.agentName && ` · ${item.agentName}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border px-4 py-2">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                View all activity <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const { data: leads } = useGetLeads(
    query.length >= 2 ? { search: query } : {},
    { query: { queryKey: getGetLeadsQueryKey(query.length >= 2 ? { search: query } : {}), enabled: open && query.length >= 2 } }
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const results = query.length >= 2 ? (leads ?? []).slice(0, 6) : [];

  function goTo(path: string) {
    setLocation(path);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        data-testid="button-global-search"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground text-sm transition-colors w-48 lg:w-64"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-xs flex-1 text-left">Search leads...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] border border-border rounded px-1 py-0.5 bg-background font-mono">
          ⌘K
        </kbd>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search leads by name, email, phone..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
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
              <span className="text-[10px] text-muted-foreground">↵ to open · Esc to close</span>
              <Link href="/leads" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">View all leads</Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary shadow-sm">
            <Building2 className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <span className="text-sidebar-foreground font-bold text-sm tracking-tight block">EstateFlow</span>
            <span className="text-sidebar-foreground/40 text-[10px]">India's #1 Realty CRM</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <NavSection label="Main" items={mainNav} location={location} onNav={() => setOpen(false)} />
          <NavSection label="Tools" items={toolsNav} location={location} onNav={() => setOpen(false)} />
        </nav>

        {/* Settings row */}
        <div className="px-3 pb-2">
          <Link href="/settings" onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location.startsWith("/settings")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />Settings
          </Link>
        </div>

        {/* User profile */}
        <div className="border-t border-sidebar-border px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-xs font-bold text-amber-900 flex-shrink-0">
            PS
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">Priya Singh</p>
            <p className="text-[10px] text-sidebar-foreground/40">Admin · ₹12,000/yr</p>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b border-border px-4 py-2 bg-card">
          {/* Mobile menu */}
          <button data-testid="button-mobile-menu" onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-muted lg:hidden flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden mr-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">EstateFlow</span>
          </div>
          {/* Global search */}
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
