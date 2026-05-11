/**
 * useApi: hook que devolve uma instância de ApiClient pronta pra uso,
 * já configurada com o getToken do Auth0 e handlers 401/403.
 */
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { createApiClient } from "./client";
import { toast } from "@/components/ui/use-toast";

export function useApi() {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  return useMemo(
    () =>
      createApiClient({
        getToken: () => getAccessTokenSilently(),
        on401: () => {
          toast({
            variant: "destructive",
            title: "Sessão expirada",
            description: "Por favor, faça login novamente.",
          });
          loginWithRedirect();
        },
        on403: ({ message, required }) => {
          toast({
            variant: "destructive",
            title: "Permissão negada",
            description: required
              ? `Sem permissão: ${required.join(", ")}`
              : message,
          });
          navigate("/forbidden");
        },
      }),
    [getAccessTokenSilently, loginWithRedirect, navigate],
  );
}
