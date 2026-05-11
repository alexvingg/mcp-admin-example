import { useAuth0 } from "@auth0/auth0-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, KeyRound, Mail, ShieldCheck, Trash2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { useApi } from "@/api/useApi";
import type { MePayload, MyGrantsResponse } from "@/api/types";
import { usePermissions } from "@/auth/usePermissions";
import { formatDate } from "@/lib/utils";

export function Dashboard() {
  const { user } = useAuth0();
  const api = useApi();
  const { permissions, scope, role, loading } = usePermissions();

  // /api/me confirma que o backend reconhece o token
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MePayload>("/api/me"),
  });

  // /api/grants/me — lista grants ativos (cada acesso a detalhe cria um grant temporário)
  const grantsQuery = useQuery({
    queryKey: ["grants-me"],
    queryFn: () => api.get<MyGrantsResponse>("/api/grants/me"),
    refetchInterval: 5_000, // atualiza a cada 5s pra mostrar grants expirando
  });

  const qc = useQueryClient();
  const revokeMutation = useMutation({
    mutationFn: (customerId: string) =>
      api.delete(`/api/customers/${customerId}/access-request`),
    onSuccess: (_data, customerId) => {
      qc.invalidateQueries({ queryKey: ["grants-me"] });
      toast({
        title: "Grant revogado",
        description: `Acesso ao customer ${customerId.slice(0, 12)}… foi removido.`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Falha ao revogar", description: err.message });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu acesso. Os dados abaixo são extraídos do JWT validado pelo backend.
        </p>
      </div>

      {/* Cards de identidade */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuário</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{user?.name ?? "—"}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Mail className="h-3 w-3" /> {user?.email ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Role</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={role === "admin" ? "default" : role === "user" ? "secondary" : "outline"}
              className="text-base px-3 py-1"
            >
              {role}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Inferida das permissions do JWT.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {permissions.length === 0 ? "nenhuma" : "ativas no token"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes do JWT */}
      <Card>
        <CardHeader>
          <CardTitle>JWT — Permissions</CardTitle>
          <CardDescription>
            Lista de permissions resolvidas pelo Auth0 (RBAC) e injetadas no access_token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-6 w-48" />
            </div>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma permission encontrada no token. Verifique se RBAC e &quot;Add
              Permissions in Access Token&quot; estão habilitados na API do Auth0.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {permissions.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p}</code>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Scope (string OAuth) */}
      <Card>
        <CardHeader>
          <CardTitle>Scope (OAuth)</CardTitle>
          <CardDescription>Claim padrão OAuth, separado por espaços.</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
            {scope || "—"}
          </code>
        </CardContent>
      </Card>

      {/* Active Grants — pattern de runtime grants (estilo enterprise) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Grants Ativos (Tier 2 / runtime)
          </CardTitle>
          <CardDescription>
            Grants temporários (TTL {grantsQuery.data?.ttlSeconds ?? "—"}s) criados quando você abre o
            detalhe de um customer. Cada grant libera APENAS aquele id por essa janela. Inspirado no
            pattern de Redis grants usado em sistemas enterprise (mas com TTL maior pra ser usável na demo).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {grantsQuery.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : grantsQuery.data && grantsQuery.data.grants.length > 0 ? (
            <ul className="grid gap-2">
              {grantsQuery.data.grants.map((g) => {
                const remainMs = new Date(g.expiresAt).getTime() - Date.now();
                const remainSec = Math.max(0, Math.floor(remainMs / 1000));
                const min = Math.floor(remainSec / 60);
                const sec = remainSec % 60;
                const isRevoking =
                  revokeMutation.isPending && revokeMutation.variables === g.customerId;
                return (
                  <li
                    key={g.customerId}
                    className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      <div className="min-w-0">
                        <code className="block truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                          {g.customerId}
                        </code>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          criado às {formatDate(g.grantedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={remainSec > 0 ? "success" : "destructive"}
                        className="gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Revogar grant"
                        disabled={isRevoking}
                        onClick={() => revokeMutation.mutate(g.customerId)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum grant ativo no momento.
              <p className="mt-2 text-xs">
                Abra o detalhe de algum customer (lista → ícone 👁) pra criar um grant. Ele aparece aqui
                com countdown do TTL e expira automaticamente. Você também pode revogar manualmente com o
                botão 🗑.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* /api/me — confirma o backend reconheceu o token */}
      <Card>
        <CardHeader>
          <CardTitle>Backend /api/me</CardTitle>
          <CardDescription>
            Resposta do backend após validar o JWT (issuer, audience, assinatura JWKS).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : meQuery.isError ? (
            <p className="text-sm text-destructive">
              Erro ao consultar /api/me: {(meQuery.error as Error).message}
            </p>
          ) : meQuery.data ? (
            <div className="space-y-1 text-sm">
              <div><strong>sub:</strong> <code className="text-xs">{meQuery.data.sub}</code></div>
              <div><strong>iss:</strong> <code className="text-xs">{meQuery.data.iss}</code></div>
              <div><strong>aud:</strong> <code className="text-xs">{Array.isArray(meQuery.data.aud) ? meQuery.data.aud.join(", ") : meQuery.data.aud}</code></div>
              <div><strong>expires:</strong> {formatDate(new Date(meQuery.data.exp * 1000))}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
