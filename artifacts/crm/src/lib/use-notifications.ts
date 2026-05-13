import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

export interface AppNotification {
  id: number;
  type: string; // "portal_lead" | "lead_assigned"
  title: string;
  message: string | null;
  leadId: number | null;
  targetRole: string | null;
  targetUserId: number | null;
  isRead: boolean;
  createdAt: string;
}

async function apiFetch(path: string, token: string, method = "GET") {
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export function useNotifications() {
  const { token } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<AppNotification[]>({
    queryKey: ["notifications"],
    queryFn: () =>
      token ? apiFetch("/api/notifications", token) ?? Promise.resolve([]) : Promise.resolve([]),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const data = query.data ?? [];
  const unreadCount = data.filter(n => !n.isRead).length;

  async function markRead(id: number) {
    if (!token) return;
    await apiFetch(`/api/notifications/${id}/read`, token, "PATCH");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAllRead() {
    if (!token) return;
    await apiFetch("/api/notifications/read-all", token, "PATCH");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return { data, unreadCount, markRead, markAllRead, isLoading: query.isLoading };
}
