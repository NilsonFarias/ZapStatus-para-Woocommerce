import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import Dashboard from "@/pages/dashboard";
import UserDashboard from "@/pages/user-dashboard";
import Clients from "@/pages/clients";
import Instances from "@/pages/instances";
import Templates from "@/pages/templates";
import Webhooks from "@/pages/webhooks";
import MessageQueue from "@/pages/message-queue";
import Billing from "@/pages/billing";
import Settings from "@/pages/settings";
import Subscribe from "@/pages/subscribe";
import SubscriptionSuccess from "@/pages/subscription-success";
import Register from "@/pages/register";
import Login from "@/pages/login";
import Welcome from "@/pages/welcome";
import ApiConfig from "@/pages/api-config";
import StripeSettings from "@/pages/stripe-settings";
import EvolutionDocs from "@/pages/evolution-docs";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Public routes (when user is not authenticated)
  if (!user) {
    return (
      <Switch>
        <Route path="/register" component={Register} />
        <Route path="/login" component={Login} />
        <Route path="/subscription-success" component={SubscriptionSuccess} />
        <Route path="/" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  // Authenticated routes
  return (
    <Switch>
      <Route path="/welcome" component={Welcome} />
      {/* Route based on user role */}
      <Route path="/" component={user.role === 'admin' ? Dashboard : UserDashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/clients" component={Clients} />
      <Route path="/instances" component={Instances} />
      <Route path="/templates" component={Templates} />
      <Route path="/webhooks" component={Webhooks} />
      <Route path="/message-queue" component={MessageQueue} />
      <Route path="/billing" component={Billing} />
      <Route path="/api-config" component={ApiConfig} />
      <Route path="/stripe-settings" component={StripeSettings} />
      <Route path="/evolution-docs" component={EvolutionDocs} />
      <Route path="/settings" component={Settings} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/subscription-success" component={SubscriptionSuccess} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
