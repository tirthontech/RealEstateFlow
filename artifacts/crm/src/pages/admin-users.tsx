import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Plus, Trash2, ShieldCheck, ShieldOff, Edit2, X, Eye, EyeOff, UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ROLE_PROFILES, type UserRole } from "@/lib/role-context";
import { AGENT_ROLES } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface PlatformUser {
  id: number;
  username: string;
  name: string;
  role: string;
  isAdmin: boolean;
  agentId: number | null;
  createdAt: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = ROLE_PROFILES.map(r => ({
  value: r.value,
  label: r.label,
}));

const ROLE_COLORS: Record<string, string> = {
  owner:   "bg-amber-100 text-amber-800",
  cfo:     "bg-blue-100 text-blue-800",
  manager: "bg-green-100 text-green-800",
  agent:   "bg-purple-100 text-purple-800",
  broker:  "bg-teal-100 text-teal-800",
};

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? "bg-muted text-muted-foreground";
}

function roleLabel(role: string) {
  return ROLE_PROFILES.find(r => r.value === role)?.label ?? role;
}

const EMPTY_FORM = { username: "", password: "", name: "", email: "", role: "agent" as UserRole, isAdmin: false };

export default function AdminUsersPage() {
  const { token, user: me } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (me && !me.isAdmin) setLocation("/dashboard");
  }, [me, setLocation]);

  async function apiFetch(path: string, opts: RequestInit = {}) {
    const res = await fetch(`/api${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/users");
      setUsers(data);
    } catch (e: any) {
      toast({ title: "Failed to load users", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!form.username || !form.password || !form.name || !form.role) {
      toast({ title: "All fields are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await apiFetch("/admin/users", { method: "POST", body: JSON.stringify(form) });
      toast({ title: `User "${form.username}" created` });
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      await loadUsers();
    } catch (e: any) {
      toast({ title: "Error creating user", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editUser) return;
    setSaving(true);
    try {
      const body: any = { name: form.name, role: form.role, isAdmin: form.isAdmin };
      if (form.password) body.password = form.password;
      await apiFetch(`/admin/users/${editUser.id}`, { method: "PUT", body: JSON.stringify(body) });
      toast({ title: "User updated" });
      setEditUser(null);
      await loadUsers();
    } catch (e: any) {
      toast({ title: "Error updating user", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(u: PlatformUser) {
    if (u.id === me?.id) {
      toast({ title: "Cannot delete yourself", variant: "destructive" }); return;
    }
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/admin/users/${u.id}`, { method: "DELETE" });
      toast({ title: "User deleted" });
      await loadUsers();
    } catch (e: any) {
      toast({ title: "Error deleting user", description: e.message, variant: "destructive" });
    }
  }

  function openEdit(u: PlatformUser) {
    setEditUser(u);
    setForm({ username: u.username, password: "", name: u.name, email: "", role: u.role as UserRole, isAdmin: u.isAdmin });
    setShowPw(false);
  }

  const isModal = showCreate || !!editUser;
  const modalTitle = editUser ? `Edit: ${editUser.username}` : "Create New User";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Admin only — create and manage platform user accounts</p>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM }); setShowPw(false); setShowCreate(true); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>

      {/* Users table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No users yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10">
              <tr>
                {["Name", "Username", "Role", "Agent Profile", "Admin", "Created", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{u.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">{u.username}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${roleColor(u.role)}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.agentId
                      ? <span className="flex items-center gap-1 text-xs text-green-700 font-medium"><UserCheck className="w-3.5 h-3.5" />Linked</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.isAdmin
                      ? <span className="flex items-center gap-1 text-xs text-primary font-medium"><ShieldCheck className="w-3.5 h-3.5" />Admin</span>
                      : <span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldOff className="w-3.5 h-3.5" />No</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {u.id !== me?.id && (
                        <button onClick={() => handleDelete(u)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      {isModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); setEditUser(null); }} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="font-semibold text-foreground">{modalTitle}</p>
              <button onClick={() => { setShowCreate(false); setEditUser(null); }} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Harsh Jain"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {!editUser && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Username *</label>
                    <input
                      value={form.username}
                      onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                      placeholder="harsh.jain"
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {editUser ? "New Password (leave blank to keep)" : "Password *"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={editUser ? "••••••••" : "Min 6 characters"}
                      className="w-full h-9 px-3 pr-9 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Role *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isAdmin}
                      onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-xs font-medium text-foreground">Grant Admin rights</span>
                  </label>
                </div>

                {/* Email — optional, shown for agent roles */}
                {!editUser && AGENT_ROLES.includes(form.role) && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Work Email <span className="text-[10px] text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="firstname.lastname@company.com"
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                )}
              </div>

              {!editUser && AGENT_ROLES.includes(form.role) && (
                <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  An agent profile will be created automatically and appear in the Agents section. Leads, deals and activities will be tracked under their profile.
                </p>
              )}
              {form.isAdmin && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Admin users can create, edit and delete all platform accounts.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20">
              <button onClick={() => { setShowCreate(false); setEditUser(null); }}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={editUser ? handleEdit : handleCreate}
                disabled={saving}
                className="text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-1.5 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : editUser ? "Save Changes" : "Create User"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
