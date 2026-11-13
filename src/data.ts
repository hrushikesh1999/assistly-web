import { useQuery } from "@tanstack/react-query";
import { allPages, api } from "./api";
import type { Business, Customer, Provider, Service } from "./types";
export const useBusiness = () =>
  useQuery({
    queryKey: ["business"],
    queryFn: () => api<Business>("/business"),
  });
export function useReferences() {
  const services = useQuery({
    queryKey: ["references", "services"],
    queryFn: () => allPages<Service>("/services"),
  });
  const providers = useQuery({
    queryKey: ["references", "providers"],
    queryFn: () => allPages<Provider>("/providers"),
  });
  const customers = useQuery({
    queryKey: ["references", "customers"],
    queryFn: () => allPages<Customer>("/customers"),
  });
  return {
    services: services.data || [],
    providers: providers.data || [],
    customers: customers.data || [],
    loading: services.isPending || providers.isPending || customers.isPending,
    error: services.error || providers.error || customers.error,
  };
}
export function useLabels() {
  const { data } = useBusiness();
  const label = (key: string, fallback: string) =>
    typeof data?.terminology[key] === "string" && data.terminology[key]
      ? String(data.terminology[key])
      : fallback;
  return {
    provider: label("provider", "provider"),
    customer: label("customer", "customer"),
    zone: data?.timezone || "Asia/Kolkata",
  };
}
