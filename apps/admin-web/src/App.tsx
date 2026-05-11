import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AdminLayout } from "@/layout/AdminLayout";

import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { CustomersList } from "@/pages/CustomersList";
import { CustomerDetail } from "@/pages/CustomerDetail";
import { CustomerForm } from "@/pages/CustomerForm";
import { ProductsList } from "@/pages/ProductsList";
import { ProductForm } from "@/pages/ProductForm";
import { Forbidden } from "@/pages/Forbidden";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Customers — detalhe é o destino default; edit fica em /:id/edit */}
        <Route path="/customers" element={<CustomersList />} />
        <Route path="/customers/new" element={<CustomerForm />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/customers/:id/edit" element={<CustomerForm />} />

        <Route path="/products" element={<ProductsList />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id" element={<ProductForm />} />

        <Route path="/forbidden" element={<Forbidden />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();
  if (isLoading) return null;
  navigate(isAuthenticated ? "/dashboard" : "/login", { replace: true });
  return null;
}
