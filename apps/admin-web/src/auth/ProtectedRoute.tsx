import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Bloqueia acesso a rotas protegidas. Se o user não está autenticado,
 * dispara o Universal Login do Auth0 (PKCE) e redireciona de volta.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect({
        appState: { returnTo: window.location.pathname + window.location.search },
      });
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <p className="text-sm text-muted-foreground">Redirecionando para login…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
