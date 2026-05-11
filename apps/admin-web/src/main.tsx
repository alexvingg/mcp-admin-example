import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { Auth0Provider, type AppState } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { Toaster } from "./components/ui/toaster";
import "./index.css";

// Aplica tema persistido antes de renderizar
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") document.documentElement.classList.add("dark");

const env = {
  domain:   import.meta.env.VITE_AUTH0_DOMAIN!,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID!,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE!,
};

if (!env.domain || !env.clientId || !env.audience) {
  console.error("✗ Variáveis de ambiente Auth0 ausentes. Verifique apps/admin-web/.env");
}

const SCOPES = [
  "openid", "profile", "email",
  "read:customers", "write:customers", "delete:customers",
  "read:products",  "write:products",  "delete:products",
].join(" ");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Não tenta de novo em 401/403 — são esperados quando faltam permissions
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});

function Auth0ProviderWithRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo ?? "/dashboard", { replace: true });
  };

  return (
    <Auth0Provider
      domain={env.domain}
      clientId={env.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: env.audience,
        scope: SCOPES,
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
      useRefreshTokens
      useRefreshTokensFallback
    >
      {children}
    </Auth0Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithRouter>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster />
        </QueryClientProvider>
      </Auth0ProviderWithRouter>
    </BrowserRouter>
  </React.StrictMode>,
);
