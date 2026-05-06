import { useState } from "react";
import { CheckCircle2, XCircle, Copy, RefreshCw, ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Portal = {
  id: string;
  name: string;
  logo: string;
  category: string;
  description: string;
  leadsThisMonth: number;
  totalLeads: number;
  connected: boolean;
  color: string;
  webhookPath: string;
};

const PORTALS: Portal[] = [
  { id: "99acres", name: "99acres", logo: "🏠", category: "Real Estate Portal", description: "India's largest property portal. Auto-import leads from property listings.", leadsThisMonth: 34, totalLeads: 212, connected: true, color: "bg-red-50 border-red-200", webhookPath: "/api/webhooks/99acres" },
  { id: "magicbricks", name: "MagicBricks", logo: "🧱", category: "Real Estate Portal", description: "Premium listings and verified leads from MagicBricks platform.", leadsThisMonth: 28, totalLeads: 178, connected: true, color: "bg-orange-50 border-orange-200", webhookPath: "/api/webhooks/magicbricks" },
  { id: "housing", name: "Housing.com", logo: "🏡", category: "Real Estate Portal", description: "NoBroker-acquired platform with high-intent buyer leads.", leadsThisMonth: 19, totalLeads: 134, connected: false, color: "bg-blue-50 border-blue-200", webhookPath: "/api/webhooks/housing" },
  { id: "facebook", name: "Facebook Ads", logo: "📘", category: "Paid Marketing", description: "Meta Lead Ads integration — leads sync instantly from your Facebook campaigns.", leadsThisMonth: 52, totalLeads: 389, connected: true, color: "bg-indigo-50 border-indigo-200", webhookPath: "/api/webhooks/facebook" },
  { id: "google", name: "Google Ads", logo: "🔍", category: "Paid Marketing", description: "Google Lead Form Extensions — capture leads from search and display campaigns.", leadsThisMonth: 41, totalLeads: 267, connected: true, color: "bg-yellow-50 border-yellow-200", webhookPath: "/api/webhooks/google" },
  { id: "whatsapp", name: "WhatsApp Business", logo: "💬", category: "Messaging", description: "Official WhatsApp Business API for bulk messaging and automated replies.", leadsThisMonth: 23, totalLeads: 98, connected: true, color: "bg-green-50 border-green-200", webhookPath: "/api/webhooks/whatsapp" },
  { id: "sulekha", name: "Sulekha", logo: "🔶", category: "Real Estate Portal", description: "Tier-2 city focused listings with strong regional lead volume.", leadsThisMonth: 8, totalLeads: 62, connected: false, color: "bg-amber-50 border-amber-200", webhookPath: "/api/webhooks/sulekha" },
  { id: "commonfloor", name: "CommonFloor", logo: "🏢", category: "Real Estate Portal", description: "Apartment-focused listing platform popular in metros.", leadsThisMonth: 0, totalLeads: 0, connected: false, color: "bg-slate-50 border-slate-200", webhookPath: "/api/webhooks/commonfloor" },
];

const BASE_URL = "https://your-domain.estateflow.in";

function PortalCard({ portal, onToggle }: { portal: Portal; onToggle: (id: string) => void }) {
  const { toast } = useToast();

  function copyWebhook() {
    navigator.clipboard.writeText(`${BASE_URL}${portal.webhookPath}`);
    toast({ title: "Webhook URL copied!" });
  }

  return (
    <div data-testid={`card-integration-${portal.id}`} className={cn("border rounded-lg p-5 transition-all", portal.color)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-border flex items-center justify-center text-xl shadow-sm">
            {portal.logo}
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">{portal.name}</h3>
            <span className="text-xs text-muted-foreground">{portal.category}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {portal.connected ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <XCircle className="w-3 h-3" />Not Connected
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{portal.description}</p>

      {portal.connected && (
        <div className="flex gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">This month</p>
            <p className="text-lg font-bold text-foreground">{portal.leadsThisMonth} <span className="text-xs font-normal text-muted-foreground">leads</span></p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">All time</p>
            <p className="text-lg font-bold text-foreground">{portal.totalLeads} <span className="text-xs font-normal text-muted-foreground">leads</span></p>
          </div>
        </div>
      )}

      {portal.connected ? (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input
              readOnly
              value={`${BASE_URL}${portal.webhookPath}`}
              className="h-7 text-xs font-mono bg-white/70 border-border/50"
            />
            <Button size="sm" variant="outline" className="h-7 px-2 flex-shrink-0" onClick={copyWebhook}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1" onClick={() => toast({ title: "Syncing leads..." })}>
              <RefreshCw className="w-3 h-3" />Sync Now
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => onToggle(portal.id)}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <Button
          data-testid={`button-connect-${portal.id}`}
          className="w-full h-8 text-xs gap-2"
          onClick={() => onToggle(portal.id)}
        >
          <Zap className="w-3.5 h-3.5" />Connect {portal.name}
        </Button>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const [portals, setPortals] = useState(PORTALS);
  const { toast } = useToast();
  const [category, setCategory] = useState("all");

  function togglePortal(id: string) {
    setPortals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nowConnected = !p.connected;
        toast({ title: nowConnected ? `${p.name} connected ✓` : `${p.name} disconnected` });
        return { ...p, connected: nowConnected };
      })
    );
  }

  const categories = ["all", ...Array.from(new Set(PORTALS.map((p) => p.category)))];
  const filtered = portals.filter((p) => category === "all" || p.category === category);
  const connectedCount = portals.filter((p) => p.connected).length;
  const totalLeadsThisMonth = portals.filter((p) => p.connected).reduce((s, p) => s + p.leadsThisMonth, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Connect lead sources from Indian real estate portals, ad platforms, and messaging tools</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-card border border-card-border rounded-lg px-4 py-2 text-center">
            <p className="text-lg font-bold text-primary">{connectedCount}</p>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg px-4 py-2 text-center">
            <p className="text-lg font-bold text-green-600">{totalLeadsThisMonth}</p>
            <p className="text-xs text-muted-foreground">Leads This Month</p>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
              category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Portals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((portal) => (
          <PortalCard key={portal.id} portal={portal} onToggle={togglePortal} />
        ))}
      </div>

      {/* Webhook docs */}
      <div className="bg-muted/50 border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-primary" />
          Custom Webhook Integration
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Send a POST request to your unique webhook URL to import leads from any source. Our API auto-parses and assigns leads to agents based on routing rules.
        </p>
        <pre className="bg-card border border-border rounded p-3 text-xs font-mono overflow-x-auto text-foreground">
{`POST ${BASE_URL}/api/webhooks/custom
Content-Type: application/json

{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "+91 98765 43210",
  "source": "custom",
  "budget": 5000000,
  "propertyType": "residential"
}`}
        </pre>
      </div>
    </div>
  );
}
