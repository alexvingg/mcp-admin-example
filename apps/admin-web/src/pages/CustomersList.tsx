import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

import { useApi } from "@/api/useApi";
import type { Customer } from "@/api/types";
import { usePermissions } from "@/auth/usePermissions";

export function CustomersList() {
  const api = useApi();
  const qc = useQueryClient();
  const { canWriteCustomers, canDeleteCustomers } = usePermissions();
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<Customer | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>("/api/customers"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente excluído", description: "Operação concluída com sucesso." });
      setToDelete(null);
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Falha ao excluir",
        description: err.message,
      });
    },
  });

  const filtered = useMemo(() => {
    const list = customersQuery.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      // Buscamos por nome E email — email não aparece na coluna mas
      // a busca cobre por conveniência.
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [customersQuery.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Lista pública pra quem tem <code className="text-xs">read:customers</code>. Detalhe
            exige acesso específico ao customer (Tier 2 / ABAC).
          </p>
        </div>
        {canWriteCustomers && (
          <Button asChild>
            <Link to="/customers/new">
              <Plus /> Novo Cliente
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {customersQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customersQuery.isError ? (
            <p className="text-sm text-destructive">
              Erro: {(customersQuery.error as Error).message}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "success" : "secondary"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* View — sempre visível; Tier 2 valida no clique */}
                          <Button asChild variant="ghost" size="icon" title="Ver detalhes">
                            <Link to={`/customers/${c.id}`} aria-label="Ver detalhes">
                              <Eye />
                            </Link>
                          </Button>

                          {canWriteCustomers && (
                            <Button asChild variant="ghost" size="icon" title="Editar">
                              <Link to={`/customers/${c.id}/edit`} aria-label="Editar">
                                <Pencil />
                              </Link>
                            </Button>
                          )}

                          {canDeleteCustomers && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setToDelete(c)}
                              aria-label="Excluir"
                              title="Excluir"
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cliente?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. <strong>{toDelete?.name}</strong> será removido
              permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
