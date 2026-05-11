import { useAuth0 } from "@auth0/auth0-react";
import { Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Login() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-4">Auth0 Admin Demo</CardTitle>
          <CardDescription>
            Demo de RBAC + scopes com Auth0, Express e Postgres
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            disabled={isLoading}
            onClick={() => loginWithRedirect()}
          >
            {isLoading ? "Carregando…" : "Entrar com Auth0"}
          </Button>

          <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-semibold mb-1">Usuários de teste:</p>
            <ul className="space-y-1 font-mono">
              <li>• admin@demo.local (acesso total)</li>
              <li>• user@demo.local (somente leitura)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
