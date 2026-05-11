// Centralized query key factory for non-generated (custom) API endpoints.
// Generated endpoints already export getGet*QueryKey from @workspace/api-client-react.
export const viewingKeys = {
  all:    () => ["/api/viewings"] as const,
  detail: (id: number) => ["/api/viewings", id] as const,
} as const;
