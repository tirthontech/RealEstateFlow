import { useState } from "react";
import { useGetLeads, useGetProperties, getGetLeadsQueryKey, getGetPropertiesQueryKey } from "@workspace/api-client-react";
import { MessageCircle, Send, Users, Home, CheckCheck, Clock, Search, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "site_visit",
    label: "Site Visit Invite",
    icon: "🏗️",
    body: `Hi {{name}}, this is {{agent}} from EstateFlow Realty.\n\nWe'd like to invite you for a site visit at *{{property}}* — one of our premium projects in your preferred location.\n\n📅 Available slots this weekend. Shall we confirm a time?\n\nReply YES to book your slot or call us directly.`,
  },
  {
    id: "new_launch",
    label: "New Launch Alert",
    icon: "🚀",
    body: `🎉 *New Launch Alert!*\n\nHi {{name}}, we're excited to announce the launch of *{{property}}*.\n\n✅ Ready-to-move units\n✅ Starting at {{price}}\n✅ RERA Approved\n\nLimited units available. Book your site visit today!\n\nReply INTERESTED to know more.`,
  },
  {
    id: "follow_up",
    label: "Follow-Up",
    icon: "🔔",
    body: `Hi {{name}}, hope you're doing well!\n\nThis is a gentle follow-up regarding your enquiry with EstateFlow Realty.\n\nHave you had a chance to review the property details we shared? We'd love to answer any questions.\n\nFeel free to call or reply here.`,
  },
  {
    id: "emi_offer",
    label: "EMI Offer",
    icon: "💰",
    body: `Hi {{name}},\n\n💸 *Special Offer!*\n\nBook *{{property}}* now with just ₹5L down payment and EMIs starting ₹32,000/month.\n\n🏦 Bank loans available\n✅ No pre-EMI till possession\n\nOffer valid till end of month. Want details?`,
  },
  {
    id: "document_request",
    label: "Document Request",
    icon: "📄",
    body: `Hi {{name}},\n\nThank you for your interest in {{property}}.\n\nTo proceed with your booking, we'll need the following documents:\n• PAN Card\n• Aadhaar Card\n• Bank Statement (3 months)\n• IT Returns (2 years)\n\nPlease share at your earliest convenience.`,
  },
  {
    id: "call_welcome",
    label: "Post-Call Welcome",
    icon: "👋",
    body: `Hi {{name}}, thank you for speaking with {{agent}} from EstateFlow Realty today!\n\nIt was great connecting with you. We're excited to help you find your dream property.\n\n🏡 Based on your interest, we'll send you curated options shortly.\n\nFeel free to reach out anytime — we're here to help!\n\nWarm regards,\nTeam EstateFlow`,
  },
];

type Campaign = {
  id: string;
  template: string;
  recipients: number;
  property?: string;
  sentAt: Date;
  delivered: number;
  read: number;
};

export default function WhatsAppPage() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [message, setMessage] = useState(TEMPLATES[0].body);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    { id: "c1", template: "Site Visit Invite", recipients: 45, property: "Belvedere Heights Estate", sentAt: new Date(Date.now() - 2 * 86400000), delivered: 43, read: 31 },
    { id: "c2", template: "New Launch Alert", recipients: 120, property: "Chelsea Penthouse", sentAt: new Date(Date.now() - 5 * 86400000), delivered: 118, read: 89 },
    { id: "c3", template: "EMI Offer", recipients: 67, sentAt: new Date(Date.now() - 8 * 86400000), delivered: 65, read: 52 },
  ]);
  const [sending, setSending] = useState(false);

  const { data: leads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey() } });
  const { data: properties } = useGetProperties({}, { query: { queryKey: getGetPropertiesQueryKey() } });

  const filteredLeads = (leads ?? []).filter(
    (l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
  );

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setSelectedTemplate(t);
    setMessage(t.body);
  }

  function toggleLead(id: number) {
    setSelectedLeads((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function selectAll() {
    setSelectedLeads(filteredLeads.map((l) => l.id));
  }

  function handleSend() {
    if (selectedLeads.length === 0) {
      toast({ title: "Select at least one recipient", variant: "destructive" });
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      const prop = (properties ?? []).find((p) => p.id === selectedProperty);
      setCampaigns((prev) => [
        {
          id: Date.now().toString(),
          template: selectedTemplate.label,
          recipients: selectedLeads.length,
          property: prop?.title,
          sentAt: new Date(),
          delivered: selectedLeads.length,
          read: 0,
        },
        ...prev,
      ]);
      setSelectedLeads([]);
      toast({ title: `Broadcast sent to ${selectedLeads.length} leads ✓` });
    }, 1800);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-500" />
            WhatsApp Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bulk property broadcasts, automated follow-ups, and personalized messaging</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-xs text-green-700 font-medium">
          WhatsApp Business API · Connected
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Templates */}
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Message Templates</h3>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  data-testid={`template-${t.id}`}
                  onClick={() => applyTemplate(t)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors",
                    selectedTemplate.id === t.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <span className="mr-2">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Property selector */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Home className="w-4 h-4 text-primary" />
              Attach Property
            </h3>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              <button
                onClick={() => setSelectedProperty(null)}
                className={cn("w-full text-left px-3 py-2 rounded text-xs transition-colors", !selectedProperty ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground")}
              >
                No property attached
              </button>
              {(properties ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProperty(p.id)}
                  className={cn("w-full text-left px-3 py-2 rounded text-xs transition-colors", selectedProperty === p.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground")}
                >
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-muted-foreground">{formatCurrency(p.price)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Compose */}
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Compose Message</h3>
            {/* WhatsApp preview */}
            <div className="bg-[#e5ddd5] rounded-lg p-3 mb-3 min-h-32">
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-xs text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                {message
                  .replace("{{name}}", "Rahul Sharma")
                  .replace("{{agent}}", "Priya Singh")
                  .replace("{{property}}", (properties ?? []).find((p) => p.id === selectedProperty)?.title ?? "Project Name")
                  .replace("{{price}}", formatCurrency((properties ?? []).find((p) => p.id === selectedProperty)?.price ?? 1000000))
                }
                <div className="text-right text-[9px] text-gray-400 mt-1 flex items-center justify-end gap-0.5">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  <CheckCheck className="w-3 h-3 text-blue-400" />
                </div>
              </div>
            </div>
            <Textarea
              data-testid="textarea-message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs font-mono resize-none"
              placeholder="Edit your message..."
            />
            <p className="text-xs text-muted-foreground mt-1">Variables: {"{{name}}"}, {"{{property}}"}, {"{{price}}"}, {"{{agent}}"}</p>
          </div>

          <Button
            data-testid="button-send-broadcast"
            onClick={handleSend}
            disabled={sending || selectedLeads.length === 0}
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {sending ? (
              <><Clock className="w-4 h-4 animate-spin" />Sending...</>
            ) : (
              <><Send className="w-4 h-4" />Send to {selectedLeads.length} Lead{selectedLeads.length !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>

        {/* Right: Recipients */}
        <div className="bg-card border border-card-border rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              Recipients
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={selectAll}>Select All</Button>
              {selectedLeads.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedLeads([])}>
                  <X className="w-3 h-3 mr-1" />{selectedLeads.length}
                </Button>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto max-h-80 space-y-1">
            {filteredLeads.map((lead) => {
              const checked = selectedLeads.includes(lead.id);
              return (
                <button
                  key={lead.id}
                  data-testid={`recipient-${lead.id}`}
                  onClick={() => toggleLead(lead.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-xs transition-colors",
                    checked ? "bg-green-50 border border-green-200" : "hover:bg-muted"
                  )}
                >
                  <div className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors", checked ? "bg-green-500 border-green-500" : "border-border")}>
                    {checked && <CheckCheck className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{lead.name}</div>
                    <div className="text-muted-foreground">{lead.phone ?? lead.email}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Campaign History */}
      <div className="bg-card border border-card-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Broadcast History</h3>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No campaigns sent yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Template</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Property</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sent</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Delivered</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Read</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden lg:table-cell">Read Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="py-3 font-medium text-foreground">{c.template}</td>
                    <td className="py-3 text-muted-foreground text-xs hidden md:table-cell">{c.property ?? "—"}</td>
                    <td className="py-3 text-right text-foreground">{c.recipients}</td>
                    <td className="py-3 text-right text-green-600 font-medium">{c.delivered}</td>
                    <td className="py-3 text-right text-blue-600 font-medium">{c.read}</td>
                    <td className="py-3 text-right hidden lg:table-cell">
                      <span className={cn("font-semibold", c.delivered > 0 && c.read / c.delivered > 0.6 ? "text-green-600" : "text-amber-600")}>
                        {c.delivered > 0 ? `${Math.round((c.read / c.delivered) * 100)}%` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
