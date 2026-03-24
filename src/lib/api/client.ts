export type ApiError = {
  error: string
}

function apiBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined
  return (envBase || "").replace(/\/+$/, "")
}

export function apiUrl(path: string): string {
  const base = apiBase()
  // Default to the dev-server proxy path so requests stay same-origin.
  if (!base) return `/__api${path}`
  return `${base}${path}`
}

export function apiSameOriginUrl(path: string): string {
  const base = apiBase()
  if (!base) return `/__api${path}`
  if (typeof window === "undefined") return `${base}${path}`
  try {
    const baseUrl = new URL(base, window.location.href)
    if (import.meta.env.DEV && baseUrl.origin !== window.location.origin) {
      return `/__api${path}`
    }
  } catch {
    return `/__api${path}`
  }
  return `${base}${path}`
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  let body = init.body
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(init.json)
  }

  const res = await fetch(apiUrl(path), {
    ...init,
    headers,
    body,
    credentials: "include",
  })

  if (!res.ok) {
    const err = await readJson<ApiError>(res).catch(() => ({ error: "request_failed" }))
    throw new Error(err.error || "request_failed")
  }

  return readJson<T>(res)
}

