import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleProvider } from "./contexts/RoleContext";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import DriverLogin from "./pages/DriverLogin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/driver/login" component={DriverLogin} />
      <Route path="/driver" component={DriverDashboard} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <RoleProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </RoleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
