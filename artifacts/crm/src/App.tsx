import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { RoleProvider } from "@/lib/role-context";
import MainLayout from "@/components/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import LeadsPage from "@/pages/leads";
import LeadDetailPage from "@/pages/lead-detail";
import PropertiesPage from "@/pages/properties";
import PropertyDetailPage from "@/pages/property-detail";
import DealsPage from "@/pages/deals";
import AgentsPage from "@/pages/agents";
import AgentDetailPage from "@/pages/agent-detail";
import AnalyticsPage from "@/pages/analytics";
import WhatsAppPage from "@/pages/whatsapp";
import IntegrationsPage from "@/pages/integrations";
import SettingsPage from "@/pages/settings";
import CommissionPage from "@/pages/commission";
import ViewingsPage from "@/pages/viewings";
import ApprovalsPage from "@/pages/approvals";
import ActivitiesPage from "@/pages/activities";
import AdminUsersPage from "@/pages/admin-users";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
});

// Redirects to /login when not authenticated; renders children otherwise
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/login" component={LoginPage} />

      {/* Protected — everything inside MainLayout requires auth */}
      <Route>
        <ProtectedRoute>
          <RoleProvider>
            <MainLayout>
              <Switch>
                <Route path="/"><Redirect to="/dashboard" /></Route>
                <Route path="/dashboard"       component={DashboardPage} />
                <Route path="/leads"           component={LeadsPage} />
                <Route path="/leads/:id"       component={LeadDetailPage} />
                <Route path="/properties"      component={PropertiesPage} />
                <Route path="/properties/:id"  component={PropertyDetailPage} />
                <Route path="/deals"           component={DealsPage} />
                <Route path="/agents"          component={AgentsPage} />
                <Route path="/agents/:id"      component={AgentDetailPage} />
                <Route path="/viewings"        component={ViewingsPage} />
                <Route path="/analytics"       component={AnalyticsPage} />
                <Route path="/whatsapp"        component={WhatsAppPage} />
                <Route path="/integrations"    component={IntegrationsPage} />
                <Route path="/commission"      component={CommissionPage} />
                <Route path="/settings"        component={SettingsPage} />
                <Route path="/approvals"       component={ApprovalsPage} />
                <Route path="/activities"      component={ActivitiesPage} />
                <Route path="/admin/users"     component={AdminUsersPage} />
                <Route component={NotFound} />
              </Switch>
            </MainLayout>
          </RoleProvider>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
