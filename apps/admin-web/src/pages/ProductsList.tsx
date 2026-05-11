import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
import type { Product } from "@/api/types";
import { usePermissions } from "@/auth/usePermissions";
import { formatCurrency } from "@/lib/utils";

export function ProductsList() {
  const api = useApi();
  const qc = useQueryClient();
  const { canWriteProducts, canDeleteProducts } = usePermissions();
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/api/products"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto excluído" });
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
    const list = productsQuery.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [productsQuery.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Gerencie o catálogo de produtos.</p>
        </div>
        {canWriteProducts && (
          <Button asChild>
            <Link to="/products/new">
              <Plus /> Novo Produto
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {productsQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : productsQuery.isError ? (
            <p className="text-sm text-destructive">
              Erro: {(productsQuery.error as Error).message}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead>Status</TableHead>
                  {(canWriteProducts || canDeleteProducts) && (
                    <TableHead className="text-right">Ações</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum produto encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(p.price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "active" ? "success" : "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      {(canWriteProducts || canDeleteProducts) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canWriteProducts && (
                              <Button asChild variant="ghost" size="icon">
                                <Link to={`/products/${p.id}`} aria-label="Editar">
                                  <Pencil />
                                </Link>
                              </Button>
                            )}
                            {canDeleteProducts && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setToDelete(p)}
                                aria-label="Excluir"
                              >
                                <Trash2 className="text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
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
            <DialogTitle>Excluir produto?</DialogTitle>
            <DialogDescription>
              <strong>{toDelete?.name}</strong> será removido permanentemente.
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
