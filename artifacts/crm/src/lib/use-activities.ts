import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

export interface ScheduledActivity {
  id: number;
  activityType: string;
  customer: string;
  phone: string | null;
  employeeName: string | null;
  agentId: number | null;
  source: string | null;
  project: string | null;
  propertyId: number | null;
  leadId: number | null;
  activityDate: string;
  activityTime: string | null;
  lastRemark: string | null;
  status: string;
  budget: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityInput {
  activityType: string;
  customer: string;
  phone?: string | null;
  employeeName?: string | null;
  agentId?: number | null;
  source?: string | null;
  project?: string | null;
  propertyId?: number | null;
  leadId?: number | null;
  activityDate: string;
  activityTime?: string | null;
  lastRemark?: string | null;
  budget?: number | null;
}

export interface UpdateActivityInput {
  lastRemark?: string | null;
  status?: string;
  activityType?: string;
  customer?: string;
  phone?: string | null;
  source?: string | null;
  project?: string | null;
  activityDate?: string;
  activityTime?: string | null;
  budget?: number | null;
}

async function apiFetch<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T | null> {
  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) return null;
  if (res.status === 204) return null;
  return res.json();
}

export const ACTIVITIES_QUERY_KEY = ["activities"] as const;

export function useActivities() {
  const { token } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<ScheduledActivity[]>({
    queryKey: ACTIVITIES_QUERY_KEY,
    queryFn: () =>
      token ? apiFetch<ScheduledActivity[]>("/api/activities", token).then(d => d ?? []) : Promise.resolve([]),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const create = useMutation({
    mutationFn: (input: CreateActivityInput) =>
      apiFetch<ScheduledActivity>("/api/activities", token!, "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: UpdateActivityInput & { id: number }) =>
      apiFetch<ScheduledActivity>(`/api/activities/${id}`, token!, "PUT", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/activities/${id}`, token!, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY }),
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}
