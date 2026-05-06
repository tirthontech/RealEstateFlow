import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Building2, GitBranch, UserCheck,
  Menu, BarChart3, MessageCircle, Plug2, Settings, Calculator,
  Calendar, Bell, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";

const mainNav = [
  { href: "/dashboard",    label: "Dashboard",  icon: LayoutDashboard },
  { href: "/leads",        label: "Leads",      icon: Users },
  { href: "/properties",   label: "Properties", icon: Building2 },
  { href: "/deals",        label: "Deals",      icon: GitBranch },
  { href: "/agents",       label: "Agents",     icon: UserCheck },
  { href: "/viewings",     label: "Viewings",   icon: Calendar },
];

const toolsNav = [
  { href: "/whatsapp",     label: "WhatsApp",   icon: MessageCircle },
  { href: "/analytics",    label: "Analytics",  icon: BarChart3 },
  { href: "/commission",   label: "Commission", icon: Calculator },
  { href: "/integrations", label: "Integrations", icon: Plug2 },
];

function NavSection({ label, items, location, onNav }: {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  location: string;
  onNav: () => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest px-3 mb-1.5">{label}</p>
      {items.map(({ href, label: itemLabel, icon: Icon }) => {
        const active = location.startsWith(href) || (href === "/dashboard" && location === "/");
        return (
          <Link
            key={href}
            href={href}
            data-testid={`nav-${itemLabel.toLowerCase()}`}
            onClick={onNav}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
    query: {
      queryKey: getGetRecentActivityQueryKey(),
      refetchInterval: 60_000,
    },
  });

  const items = activity ?? [];
  const unread = Math.min(items.length, 5);

  return (
    <div className="relative">
      <button
        data-testid="button-notifications"
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Recent Activity</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {items.slice(0, 8).map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <p className="text-xs font-medium text-foreground leading-snug">{item.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(item.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border px-4 py-2.5">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="text-xs text-primary font-medium hover:underline">
                View all activity →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-sidebar-primary">
            <Building2 className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <span className="text-sidebar-foreground font-bold text-sm tracking-tight block">EstateFlow</span>
            <span className="text-sidebar-foreground/40 text-[10px]">India's #1 Realty CRM</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <NavSection label="Main" items={mainNav} location={location} onNav={() => setOpen(false)} />
          <NavSection label="Tools" items={toolsNav} location={location} onNav={() => setOpen(false)} />
        </nav>

        {/* Settings at bottom */}
        <div className="px-3 pb-2">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location.startsWith("/settings")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />Settings
          </Link>
        </div>

        <div className="border-t border-sidebar-border px-5 py-3">
          <p className="text-[10px] text-sidebar-foreground/40">EstateFlow v1.0 · ₹12,000/yr</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5 bg-card">
          <div className="flex items-center gap-3 lg:hidden">
            <button data-testid="button-mobile-menu" onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-muted">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">EstateFlow</span>
            </div>
          </div>
          {/* Spacer so bell stays right on desktop too */}
          <div className="flex-1 hidden lg:block" />
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
