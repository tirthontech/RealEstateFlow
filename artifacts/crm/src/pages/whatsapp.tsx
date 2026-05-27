import { useState, useMemo } from "react";
import { useGetLeads, getGetLeadsQueryKey } from "@workspace/api-client-react";
import { MessageCircle, Send, Users, Search, X, CheckSquare, Square, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn, stageLabel } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "follow_up",
    label: "Follow-up",
    text: "Hi {name}, this is a follow-up from RealtySell regarding your property enquiry. Would you be available for a quick call today? Please let us know a convenient time.",
  },
  {
    id: "site_visit",
    label: "Site Visit Reminder",
    text: "Hi {name}, just a reminder for your site visit scheduled. Please carry a valid ID. Our executive will meet you at the project entrance. For queries, feel free to reply here.",
  },
  {
    id: "new_launch",
    label: "New Launch",
    text: "Hi {name}, exciting news! We have a new project launch with special pre-launch pricing. Limited units available. Interested? Reply YES to know more or call us directly.",
  },
  {
    id: "offer",
    label: "Special Offer",
    text: "Hi {name}, we have an exclusive offer for our valued customers. Get special pricing on select units this month only. Reply to this message or call us to avail the offer.",
  },
  {
    id: "custom",
    label: "Custom",
    text: "",
  },
];

export default function WhatsAppPage() {
  const { toast } = useToast();
  const { data: leads = [], isLoading } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey() } });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [templateId, setTemplateId] = useState("follow_up");
  const [customText, setCustomText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());

  const withPhone = useMemo(() =>
    leads.filter(l => l.phone && l.phone.trim()),
    [leads]
  );

  const filtered = useMemo(() => {
    let list = withPhone;
    if (filterStatus !== "all") list = list.filter(l => l.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.name.toLowerCase().includes(q) || (l.phone ?? "").includes(q));
    }
    return list;
  }, [withPhone, search, filterStatus]);

  const template = TEMPLATES.find(t => t.id === templateId)!;
  const messageText = templateId === "custom" ? customText : template.text;

  function toggleSelect(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function selectAll() { setSelected(new Set(filtered.map(l => l.id))); }
  function clearAll() { setSelected(new Set()); }

  function buildMessage(name: string) {
    return messageText.replace(/\{name\}/g, name.split(" ")[0]);
  }

  function sendSelected() {
    const toSend = filtered.filter(l => selected.has(l.id));
    if (!messageText.trim()) { toast({ title: "Please write or select a message template", variant: "destructive" }); return; }
    if (toSend.length === 0) { toast({ title: "Please select at least one lead", variant: "destructive" }); return; }

    toSend.forEach(lead => {
      const phone = (lead.phone ?? "").replace(/\D/g, "");
      const msg = encodeURIComponent(buildMessage(lead.name));
      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    });

    setSentIds(prev => new Set([...prev, ...toSend.map(l => l.id)]));
    toast({ title: `Opening WhatsApp for ${toSend.length} lead${toSend.length > 1 ? "s" : ""}`, description: "Messages will open in new tabs." });
  }

  const statuses = ["all", "new", "contacted", "qualified", "proposal", "negotiation"];

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-green-600" />WhatsApp Broadcast
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Select leads and send personalised WhatsApp messages</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — lead selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Select Leads ({selected.size} selected)</p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-primary hover:underline">All</button>
              {selected.size > 0 && <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
            </div>
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all capitalize",
                  filterStatus === s ? "bg-green-600 text-white border-green-600" : "border-border text-muted-foreground hover:border-green-400")}>
                {s === "all" ? "All" : stageLabel(s)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
          </div>

          {/* Lead list */}
          <div className="border border-card-border rounded-xl overflow-hidden bg-card max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No leads with phone numbers found</div>
            ) : (
              <div className="divide-y divide-card-border">
                {filtered.map(lead => {
                  const isSelected = selected.has(lead.id);
                  const wasSent = sentIds.has(lead.id);
                  return (
                    <div key={lead.id} onClick={() => toggleSelect(lead.id)}
                      className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                        isSelected ? "bg-green-50" : "hover:bg-muted/30")}>
                      {isSelected ? <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                          {wasSent && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded">Sent</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{lead.phone}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize flex-shrink-0">{stageLabel(lead.status)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Showing {filtered.length} leads with phone numbers</p>
        </div>

        {/* Right — message composer */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Compose Message</p>

          {/* Templates */}
          <div className="grid grid-cols-2 gap-1.5">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => setTemplateId(t.id)}
                className={cn("px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all",
                  templateId === t.id ? "bg-green-600 text-white border-green-600" : "border-border text-muted-foreground hover:border-green-400")}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Message preview / editor */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Message <span className="text-[10px]">(use &#123;name&#125; for personalisation)</span></label>
            <textarea
              rows={7}
              value={templateId === "custom" ? customText : template.text}
              onChange={e => { if (templateId === "custom") setCustomText(e.target.value); }}
              readOnly={templateId !== "custom"}
              placeholder={templateId === "custom" ? "Type your message here... Use {name} for personalisation." : ""}
              className={cn("w-full text-sm border border-border rounded-xl px-3.5 py-3 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition leading-relaxed",
                templateId !== "custom" && "opacity-80 cursor-default")}
            />
          </div>

          {/* Preview */}
          {selected.size > 0 && messageText && (() => {
            const sampleLead = filtered.find(l => selected.has(l.id));
            if (!sampleLead) return null;
            return (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-[10px] text-green-700 font-semibold mb-1">Preview for {sampleLead.name.split(" ")[0]}</p>
                <p className="text-xs text-green-900 leading-relaxed whitespace-pre-wrap">{buildMessage(sampleLead.name)}</p>
              </div>
            );
          })()}

          {/* Send button */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
            onClick={sendSelected}
            disabled={selected.size === 0 || !messageText.trim()}
          >
            <Send className="w-4 h-4" />
            Send to {selected.size || "selected"} lead{selected.size !== 1 ? "s" : ""} via WhatsApp
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Opens individual WhatsApp chats in new tabs — no API needed
          </p>
        </div>
      </div>
    </div>
  );
}
