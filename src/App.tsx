import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import AppLayout from "@/components/layout/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import InstallPWA from "@/components/InstallPWA";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import TransacoesPage from "@/pages/TransacoesPage";
import RendaExtraPage from "@/pages/RendaExtraPage";
import CategoriasPage from "@/pages/CategoriasPage";
import MetasPage from "@/pages/MetasPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";
import AlertasPage from "@/pages/AlertasPage";
import RelatoriosPage from "@/pages/RelatoriosPage";

import RankingPage from "@/pages/RankingPage";
import BuildStatus from "@/pages/BuildStatus";
import NotFound from "@/pages/NotFound";

// Configuração da "central de memória" do app.
// staleTime: por quanto tempo um dado é considerado "fresco" (sem precisar buscar de novo)
// gcTime: por quanto tempo um dado fica guardado depois que ninguém mais o usa
// refetchOnWindowFocus: false → não busca de novo só por trocar de aba
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos como fresco (sem refetch ao voltar p/ tela)
      gcTime: 10 * 60 * 1000, // 10 minutos guardado em memória
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-muted-foreground">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayoutWithPush>{children}</AppLayoutWithPush>;
}

function AppLayoutWithPush({ children }: { children: React.ReactNode }) {
  usePushSubscription();
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <ErrorBoundary>
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <InstallPWA />
      <BrowserRouter>
        <AuthProvider>
          <ProfileProvider>
          <Routes>
            <Route path="/login" element={<AuthRoute />} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/transacoes" element={<ProtectedRoute><TransacoesPage /></ProtectedRoute>} />
            <Route path="/renda-extra" element={<ProtectedRoute><RendaExtraPage /></ProtectedRoute>} />
            <Route path="/categorias" element={<ProtectedRoute><CategoriasPage /></ProtectedRoute>} />
            <Route path="/metas" element={<ProtectedRoute><MetasPage /></ProtectedRoute>} />
            <Route path="/alertas" element={<ProtectedRoute><AlertasPage /></ProtectedRoute>} />
            <Route path="/recorrentes" element={<Navigate to="/transacoes" replace />} />
            <Route path="/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
            <Route path="/resumo-geral" element={<Navigate to="/" replace />} />
            <Route path="/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
            <Route path="/conquistas" element={<Navigate to="/ranking" replace />} />
            <Route path="/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
            <Route path="/debug/build" element={<BuildStatus />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
  </ErrorBoundary>
);

export default App;
