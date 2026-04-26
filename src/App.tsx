import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Layout from "./components/Layout.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import Home from "./pages/app/Home.tsx";
import Banco from "./pages/app/Banco.tsx";
import Simulado from "./pages/app/Simulado.tsx";
import Enamed from "./pages/app/Enamed.tsx";
import Desempenho from "./pages/app/Desempenho.tsx";
import Admin from "./pages/app/Admin.tsx";
import Revisar from "./pages/app/Revisar.tsx";
import { AuthProvider } from "./hooks/useAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Home />} />
              <Route path="banco" element={<Banco />} />
              <Route path="simulado" element={<Simulado />} />
              <Route path="enamed" element={<Enamed />} />
              <Route path="desempenho" element={<Desempenho />} />
              <Route path="revisar" element={<Revisar />} />
              <Route path="admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
