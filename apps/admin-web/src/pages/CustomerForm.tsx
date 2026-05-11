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
import type { Customer } from "@/api/types";

const customerSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(120),
  email: z.string().email("Email inválido"),
  status: z.enum(["active", "inactive"]),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export function CustomerForm() {
  const { id } = useParams();
  const isEdit = Boolean(id && id !== "new");
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const customerQuery = useQuery({
    queryKey: ["customers", id],
    queryFn: () => api.get<Customer>(`/api/customers/${id}`),
    enabled: isEdit,
  });

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", status: "active" },
  });

  useEffect(() => {
    if (customerQuery.data) {
      form.reset({
        name: customerQuery.data.name,
        email: customerQuery.data.email,
        status: customerQuery.data.status,
      });
    }
  }, [customerQuery.data, form]);

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormValues) => api.post<Customer>("/api/customers", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente criado!" });
      navigate("/customers");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Falha ao salvar", description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CustomerFormValues) =>
      api.put<Customer>(`/api/customers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente atualizado!" });
      navigate("/customers");
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
        <Link to="/customers">
          <ArrowLeft /> Voltar
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Editar Cliente" : "Novo Cliente"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...form.register("name")} disabled={saving} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register("email")} disabled={saving} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/customers">Cancelar</Link>
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
