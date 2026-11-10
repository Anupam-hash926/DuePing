/**
 * DuePing API client.
 *
 * Typed fetch wrapper for the DuePing backend REST API.
 * Throws backend API error.message on failure.
 */

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...options,
  })

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`
    try {
      const data = await res.json()
      if (data && data.error && data.error.message) {
        errorMsg = data.error.message
      } else if (data && data.detail) {
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map((d: { msg: string }) => d.msg).join('; ')
        } else if (typeof data.detail === 'string') {
          errorMsg = data.detail
        }
      }
    } catch {
      // not JSON
    }
    throw new Error(errorMsg)
  }

  // Handle empty responses
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }
  return {} as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
