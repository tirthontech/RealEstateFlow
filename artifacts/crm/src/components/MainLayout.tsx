import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Building2, GitBranch, UserCheck,
  Menu, BarChart3, MessageCircle, Plug2
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/deals", label: "Deals", icon: GitBranch },
  { href: "/agents", label: "Agents", icon: UserCheck },
];

const toolsNav = [
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Plug2 },
];

function NavSection({ label, items, location, onNav }: {
  label: string;
  items: typeof mainNav;
  location: string;
  onNav: () => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-widest px-3 mb-1.5">{label}</p>
      {items.map(({ href, label: itemLabel, icon: Icon }) => {
        const active = location.startsWith(href) || (href === "/dashboard" && location === "/");
        return (
          <Link
            key={href}
            href={href}
            data-testid={`nav-${itemLabel.toLowerCase()}`}
            onClick={onNav}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
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

        <div className="border-t border-sidebar-border px-5 py-3">
          <p className="text-[10px] text-sidebar-foreground/40">EstateFlow v1.0 · ₹12,000/yr</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b border-border px-4 py-3 bg-card lg:hidden">
          <button data-testid="button-mobile-menu" onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">EstateFlow</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
