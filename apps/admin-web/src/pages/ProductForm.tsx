import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

import { useApi } from "@/api/useApi";
import type { Product } from "@/api/types";

const productSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(120),
  price: z
    .string()
    .min(1, "Preço obrigatório")
    .regex(/^\d+(\.\d{1,2})?$/, "Use formato 0.00"),
  status: z.enum(["active", "inactive"]),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id && id !== "new");
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const productQuery = useQuery({
    queryKey: ["products", id],
    queryFn: () => api.get<Product>(`/api/products/${id}`),
    enabled: isEdit,
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", price: "0.00", status: "active" },
  });

  useEffect(() => {
    if (productQuery.data) {
      form.reset({
        name: productQuery.data.name,
        price: String(productQuery.data.price),
        status: productQuery.data.status,
      });
    }
  }, [productQuery.data, form]);

  const createMutation = useMutation({
    mutationFn: (data: ProductFormValues) => api.post<Product>("/api/products", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto criado!" });
      navigate("/products");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Falha ao salvar", description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProductFormValues) =>
      api.put<Product>(`/api/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto atualizado!" });
      navigate("/products");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Falha ao atualizar", description: err.message });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data);
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/products">
          <ArrowLeft /> Voltar
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...form.register("name")} disabled={saving} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Preço (BRL)</Label>
                <Input
                  id="price"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...form.register("price")}
                  disabled={saving}
                />
                {form.formState.errors.price && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.price.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  {...form.register("status")}
                  disabled={saving}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/products">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
