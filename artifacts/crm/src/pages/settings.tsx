import { useState, useRef } from "react";
import { Building2, CreditCard, Bell, Shield, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const AGENCY_KEY = "ef_agency_settings";
const NOTIF_KEY  = "ef_notif_prefs";
const LOGO_KEY   = "ef_agency_logo";

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

const TABS = [
  { id: "agency", label: "Agency Profile", icon: Building2 },
  { id: "billing", label: "Billing & Plan", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Data & Privacy", icon: Shield },
] as const;

type TabId = typeof TABS[number]["id"];

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn("relative w-10 h-5 rounded-full transition-colors flex-shrink-0", checked ? "bg-primary" : "bg-muted")}
      >
        <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
      </button>
    </div>
  );
}

const AGENCY_DEFAULTS = {
  name: "RealtySell Realty Pvt. Ltd.",
  rera: "RERA/KA/AGENT/2024/001234",
  gst: "29AABCE1234F1Z5",
  address: "42 MG Road, Indiranagar, Bengaluru - 560038",
  phone: "+91 80 4567 8901",
  email: "admin@realtysell.in",
  website: "https://realtysell.in",
  timezone: "Asia/Kolkata",
};

function AgencyTab() {
  const { toast } = useToast();
  const [form, setForm] = useState(() => readLS(AGENCY_KEY, AGENCY_DEFAULTS));
  const [logoUrl, setLogoUrl] = useState<string>(() => localStorage.getItem(LOGO_KEY) ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo must be under 2 MB", variant: "destructive" }); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      localStorage.setItem(LOGO_KEY, url);
      setLogoUrl(url);
      toast({ title: "Logo uploaded ✓" });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="Agency Details" subtitle="Your brokerage's registered information" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Agency / Firm Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="RERA Registration Number">
            <Input value={form.rera} onChange={(e) => setForm({ ...form, rera: e.target.value })} />
          </Field>
          <Field label="GST Number">
            <Input value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} />
          </Field>
          <Field label="Office Phone" required>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Official Email" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Registered Address" required>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="Branding" subtitle="Customise how your CRM looks to your team" />
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground overflow-hidden flex-shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt="Agency logo" className="w-full h-full object-cover" />
              : <Building2 className="w-7 h-7" />}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />Upload Logo
              </Button>
              {logoUrl && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs"
                  onClick={() => { localStorage.removeItem(LOGO_KEY); setLogoUrl(""); toast({ title: "Logo removed" }); }}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">PNG, SVG, JPG or WebP · 400×400px recommended · Max 2 MB</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => {
          localStorage.setItem(AGENCY_KEY, JSON.stringify(form));
          toast({ title: "Agency profile saved ✓" });
        }}>Save Changes</Button>
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-card-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full mb-2">
              <Check className="w-3 h-3" />Current Plan
            </span>
            <h3 className="text-xl font-bold text-foreground">Growth Plan</h3>
            <p className="text-sm text-muted-foreground">₹12,000 / year · Renews on 1 Apr 2027</p>
          </div>
          <Button variant="outline" size="sm">Upgrade Plan</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
          {[["Agents", "10 / 10"], ["Leads", "Unlimited"], ["Properties", "Unlimited"], ["Portals", "5 connected"]].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="Compare Plans" subtitle="Upgrade to unlock advanced features" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: "Starter", price: "₹6,000", period: "/yr", agents: "3", features: ["5 portals", "Basic analytics", "Email support"] },
            { name: "Growth", price: "₹12,000", period: "/yr", agents: "10", features: ["All portals", "Advanced analytics", "WhatsApp API", "Priority support"], current: true },
            { name: "Enterprise", price: "Custom", period: "", agents: "Unlimited", features: ["Multi-branch", "White label", "Dedicated CSM", "SLA", "API access"] },
          ].map((plan) => (
            <div key={plan.name} className={cn("border rounded-lg p-4", plan.current ? "border-primary bg-primary/5" : "border-border")}>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-foreground">{plan.name}</h4>
                {plan.current && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">CURRENT</span>}
              </div>
              <p className="text-xl font-bold text-foreground">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.period}</span></p>
              <p className="text-xs text-muted-foreground mb-3">Up to {plan.agents} agents</p>
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-foreground">
                    <Check className="w-3 h-3 text-green-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              {!plan.current && (
                <Button size="sm" className="w-full mt-4" variant={plan.name === "Enterprise" ? "outline" : "default"}>
                  {plan.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="Payment History" />
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">
            <th className="text-left py-2 text-xs text-muted-foreground font-semibold uppercase">Date</th>
            <th className="text-left py-2 text-xs text-muted-foreground font-semibold uppercase">Description</th>
            <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase">Amount</th>
            <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {[
              { date: "1 Apr 2026", desc: "Growth Plan — Annual Renewal", amount: "₹12,000", status: "Paid" },
              { date: "1 Apr 2025", desc: "Growth Plan — Annual Renewal", amount: "₹12,000", status: "Paid" },
              { date: "1 Apr 2024", desc: "Starter Plan — Annual", amount: "₹6,000", status: "Paid" },
            ].map((row) => (
              <tr key={row.date} className="hover:bg-muted/20">
                <td className="py-2.5 text-muted-foreground">{row.date}</td>
                <td className="py-2.5 text-foreground">{row.desc}</td>
                <td className="py-2.5 text-right font-medium text-foreground">{row.amount}</td>
                <td className="py-2.5 text-right"><span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full">{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const NOTIF_DEFAULTS = {
  newLead: true, dealUpdate: true, agentActivity: false, portalSync: true,
  weeklyDigest: true, whatsappAlerts: false, smsAlerts: true, browserPush: true,
};

function NotificationsTab() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState(() => readLS(NOTIF_KEY, NOTIF_DEFAULTS));

  type PrefKey = keyof typeof prefs;
  const toggle = (key: PrefKey) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-6">
      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="In-App Alerts" subtitle="Shown inside RealtySell as you work" />
        <Toggle label="New lead assigned" description="Alert when a new lead is routed to you or your team" checked={prefs.newLead} onChange={() => toggle("newLead")} />
        <Toggle label="Deal stage change" description="When a deal moves to a new stage" checked={prefs.dealUpdate} onChange={() => toggle("dealUpdate")} />
        <Toggle label="Team activity" description="When your agents log calls, viewings, or notes" checked={prefs.agentActivity} onChange={() => toggle("agentActivity")} />
        <Toggle label="Portal sync" description="When leads are imported from 99acres, MagicBricks, etc." checked={prefs.portalSync} onChange={() => toggle("portalSync")} />
      </div>
      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="Email Notifications" subtitle="Sent to your registered agency email" />
        <Toggle label="Weekly digest" description="Summary of leads, deals, and team activity every Monday" checked={prefs.weeklyDigest} onChange={() => toggle("weeklyDigest")} />
      </div>
      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="Mobile Alerts" subtitle="Push and SMS notifications" />
        <Toggle label="SMS alerts" description="Critical alerts via SMS to your registered mobile" checked={prefs.smsAlerts} onChange={() => toggle("smsAlerts")} />
        <Toggle label="WhatsApp notifications" description="High-priority alerts via WhatsApp Business" checked={prefs.whatsappAlerts} onChange={() => toggle("whatsappAlerts")} />
        <Toggle label="Browser push" description="Desktop notifications in your browser" checked={prefs.browserPush} onChange={() => toggle("browserPush")} />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => {
          localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
          toast({ title: "Notification preferences saved ✓" });
        }}>Save Preferences</Button>
      </div>
    </div>
  );
}

function PrivacyTab() {
  const { toast } = useToast();
  return (
    <div className="space-y-6">
      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="Data Retention" subtitle="How long RealtySell retains your data" />
        <div className="space-y-3">
          {[
            { label: "Lead data", value: "5 years (per RERA guidelines)" },
            { label: "Call recordings", value: "2 years" },
            { label: "Communication logs", value: "3 years" },
            { label: "Transaction records", value: "7 years (tax compliance)" },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-foreground">{label}</span>
              <span className="text-sm text-muted-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-6">
        <SectionHeader title="Data Export" subtitle="Download a copy of all your CRM data" />
        <div className="space-y-3">
          {[["All Leads (CSV)", "Export all leads with full details"], ["Properties (CSV)", "Export property listings"], ["Deals & Transactions (CSV)", "Full deal history"], ["Complete Data Package (ZIP)", "All data including documents"]].map(([label, desc]) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => toast({ title: `Exporting ${label}...` })}>
                Export
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-6">
        <SectionHeader title="Danger Zone" subtitle="Irreversible actions — proceed with caution" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Delete Agency Account</p>
            <p className="text-xs text-muted-foreground">Permanently deletes all data. This cannot be undone.</p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => toast({ title: "Contact support to delete your account", variant: "destructive" })}>
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("agency");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your agency profile, billing, and preferences</p>
      </div>

      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-testid={`tab-settings-${id}`}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div>
        {activeTab === "agency" && <AgencyTab />}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "privacy" && <PrivacyTab />}
      </div>
    </div>
  );
}
