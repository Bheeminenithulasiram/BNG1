import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { z } from "zod";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────
export const HealthCheckResponse = z.object({
  status: z.literal("ok"),
});

export const GenerateBrandsBody = z.object({
  description: z.string().min(1),
  category: z.string().min(1),
  keywords: z.string().optional(),
  groqApiKey: z.string().optional(),
});

export const TestGroqKeyBody = z.object({
  groqApiKey: z.string().min(1, "API key is required"),
});

export const CheckBrandAvailabilityBody = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
});

export interface BrandSuggestion {
  name: string;
  tagline: string;
  suggestedDomain: string;
}

export type AvailabilityStatus = "available" | "taken" | "unknown";

export interface BrandAvailability {
  domain: { name: string; status: AvailabilityStatus };
  social: {
    instagram: AvailabilityStatus;
    twitter: AvailabilityStatus;
    github: AvailabilityStatus;
  };
}

const rawApiBaseUrl = import.meta.env?.VITE_API_BASE_URL || "";
const API_BASE_URL = rawApiBaseUrl
  ? (rawApiBaseUrl.replace(/\/$/, "").endsWith("/api")
      ? rawApiBaseUrl.replace(/\/$/, "")
      : `${rawApiBaseUrl.replace(/\/$/, "")}/api`)
  : "/api";

async function request<T>(path: string, body: unknown): Promise<T> {
  const storedKey = typeof window !== "undefined" ? localStorage.getItem("groq_api_key") || "" : "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (storedKey) {
    headers["x-groq-api-key"] = storedKey;
  }

  // Also embed groqApiKey in body if body is an object
  const finalBody = storedKey && typeof body === "object" && body !== null
    ? { ...body, groqApiKey: storedKey }
    : body;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(finalBody),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let jsonErr;
    try { jsonErr = JSON.parse(text); } catch {}
    throw new Error(jsonErr?.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function useGenerateBrands() {
  return useMutation({
    mutationFn: ({ data }: { data: Record<string, unknown> }) =>
      request<BrandSuggestion[]>(`/brands/generate`, data),
  });
}

export function useTestGroqKey() {
  return useMutation({
    mutationFn: (data: { groqApiKey: string }) =>
      request<{ ok: boolean; message?: string; error?: string }>(`/brands/test-key`, data),
  });
}

export function useCheckBrandAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data }: { data: Record<string, unknown> }) =>
      request<BrandAvailability>(`/brands/availability`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useApiHealth() {
  return useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/healthz`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }, []);
}
