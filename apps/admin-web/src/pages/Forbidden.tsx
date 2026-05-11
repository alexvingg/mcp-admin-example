import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/auth/usePermissions";

export function Forbidden() {
  const { permissions } = usePermissions();

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>

          <div>
            <h1 className="text-2xl font-bold">Acesso negado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Você não tem permissão para acessar essa funcionalidade.
            </p>
          </div>

          <div className="rounded-md border bg-muted/50 p-3 text-left text-xs">
            <p className="font-semibold mb-2">Suas permissões atuais:</p>
            {permissions.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma.</p>
            ) : (
              <ul className="space-y-0.5">
                {permissions.map((p) => (
                  <li key={p} className="font-mono">• {p}</li>
                ))}
              </ul>
            )}
          </div>

          <Button asChild className="w-full">
            <Link to="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
