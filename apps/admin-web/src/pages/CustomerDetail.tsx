/**
 * Página de detalhe de Customer (read-only) com fluxo de GRANT em runtime.
 *
 * Pattern (miniatura de pattern enterprise):
 *   1. Ao montar a página, faz POST /api/customers/:id/access-request
 *      → backend valida ENTITLEMENT (alex pode acessar Maria?)
 *        - sim → cria grant em memória com TTL (5 min) e responde 201
 *        - não → 403 "no_entitlement" — não tem acesso, ponto.
 *   2. Em sucesso do grant, faz GET /api/customers/:id
 *      → backend Tier 2 valida que existe grant ativo (lookup runtime)
 *      → 200 retorna o detalhe
 *   3. Mostra badge "Grant ativo, expira em Xmin"
 *
 * Admin bypassa tudo: o POST sempre retorna 201, o GET sempre 200.
 *
 * Fazemos fetch RAW (sem useApi) pra ter controle total dos 403 — o useApi
 * default redireciona pra /forbidden, e nesse fluxo precisamos diferenciar:
 *   - 403 "no_entitlement" → mostra mensagem inline (não redireciona)
 *   - outros 403 → cai no error genérico
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Hash,
  Mail,
  Pencil,
  ShieldCheck,
  Tag,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import type { Customer } from "@/api/types";
import { usePermissions } from "@/auth/usePermissions";
import { formatDate } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

interface GrantInfo {
  customerId: string;
  grantedAt: string;
  expiresAt: string;
  ttlSeconds: number;
}

type State =
  | { kind: "loading" }
  /** Sucesso: `grant` é null pra admin (bypass — não criou grant) */
  | { kind: "success"; data: Customer; grant: GrantInfo | null }
  | { kind: "no_entitlement"; message: string }
  | { kind: "error"; message: string };

export function CustomerDetail() {
  const { id } = useParams();
  const { getAccessTokenSilently } = useAuth0();
  const { canWriteCustomers } = usePermissions();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [now, setNow] = useState(Date.now()); // pra atualizar countdown

  // Tick do timer pro countdown do grant — só pra UX
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const token = await getAccessTokenSilently();
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        // Step 1: pedir grant (Tier 1.5 — entitlement check no backend)
        const grantRes = await fetch(
          `${API_BASE}/api/customers/${id}/access-request`,
          { method: "POST", headers, body: JSON.stringify({}) },
        );

        if (cancelled) return;

        if (!grantRes.ok) {
          const err = await grantRes.json().catch(() => ({}));
          if (grantRes.status === 403 && err.error === "no_entitlement") {
            return setState({
              kind: "no_entitlement",
              message: "Você não tem permissão para ver os detalhes desse cliente.",
            });
          }
          return setState({
            kind: "error",
            message: err.message ?? `HTTP ${grantRes.status}`,
          });
        }

        const grant: GrantInfo = await grantRes.json();

        // Step 2: GET detalhe (Tier 2 — middleware verifica grant ativo)
        const detailRes = await fetch(`${API_BASE}/api/customers/${id}`, {
          method: "GET",
          headers,
        });

        if (cancelled) return;

        if (!detailRes.ok) {
          const err = await detailRes.json().catch(() => ({}));
          return setState({
            kind: "error",
            message: err.message ?? `HTTP ${detailRes.status}`,
          });
        }

        const data: Customer = await detailRes.json();
        setState({ kind: "success", data, grant });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, getAccessTokenSilently]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link to="/customers">
            <ArrowLeft /> Voltar
          </Link>
        </Button>

        {state.kind === "success" && canWriteCustomers && (
          <Button asChild>
            <Link to={`/customers/${id}/edit`}>
              <Pencil /> Editar
            </Link>
          </Button>
        )}
      </div>

      {state.kind === "loading" && <LoadingCard />}

      {state.kind === "no_entitlement" && (
        <NoEntitlementCard message={state.message} />
      )}

      {state.kind === "error" && <ErrorCard message={state.message} />}

      {state.kind === "success" && (
        <>
          <GrantBadge grant={state.grant} now={now} />
          <CustomerCard customer={state.data} />
        </>
      )}
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="space-y-3 py-8">
        <p className="text-sm text-muted-foreground">
          Solicitando acesso ao registro…
        </p>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </CardContent>
    </Card>
  );
}

function NoEntitlementCard({ message }: { message: string }) {
  return (
    <Card className="border-yellow-500/30">
      <CardContent className="space-y-4 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
          <AlertTriangle className="h-6 w-6 text-yellow-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Sem permissão</h2>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          O backend rejeitou a criação de um grant porque você não está na lista
          de entitlements para esse cliente. Fale com um admin se acredita que
          isso é um erro.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="py-8 text-center">
        <p className="text-sm text-destructive">Erro: {message}</p>
      </CardContent>
    </Card>
  );
}

function GrantBadge({ grant, now }: { grant: GrantInfo; now: number }) {
  const expiresAtMs = new Date(grant.expiresAt).getTime();
  const remainingMs = Math.max(0, expiresAtMs - now);
  const remainingSec = Math.floor(remainingMs / 1000);
  const min = Math.floor(remainingSec / 60);
  const sec = remainingSec % 60;
  const expired = remainingMs <= 0;

  return (
    <Card className={expired ? "border-destructive/30" : "border-green-500/30"}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div
            className={
              "flex h-10 w-10 items-center justify-center rounded-full " +
              (expired ? "bg-destructive/10" : "bg-green-500/10")
            }
          >
            <ShieldCheck
              className={
                "h-5 w-5 " + (expired ? "text-destructive" : "text-green-600")
              }
            />
          </div>
          <div>
            <p className="text-sm font-medium">
              {expired ? "Grant expirou" : "Grant ativo"}
            </p>
            <p className="text-xs text-muted-foreground">
              Concedido às {formatDate(grant.grantedAt)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <Badge variant={expired ? "destructive" : "success"} className="gap-1">
            <Clock className="h-3 w-3" />
            {expired
              ? "00:00"
              : `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`}
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground">
            TTL: {grant.ttlSeconds}s
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate">{customer.name}</CardTitle>
            <CardDescription>Detalhes completos do cliente</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="divide-y">
        <DetailRow icon={<Mail className="h-4 w-4" />} label="Email">
          <a
            className="text-sm font-medium hover:underline"
            href={`mailto:${customer.email}`}
          >
            {customer.email}
          </a>
        </DetailRow>

        <DetailRow icon={<Tag className="h-4 w-4" />} label="Status">
          <Badge variant={customer.status === "active" ? "success" : "secondary"}>
            {customer.status}
          </Badge>
        </DetailRow>

        <DetailRow icon={<Calendar className="h-4 w-4" />} label="Criado em">
          <span className="text-sm">{formatDate(customer.createdAt)}</span>
        </DetailRow>

        <DetailRow icon={<Hash className="h-4 w-4" />} label="ID">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{customer.id}</code>
        </DetailRow>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-right">{children}</div>
    </div>
  );
}
