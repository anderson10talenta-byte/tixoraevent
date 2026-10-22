/**
 * Safe fetch utility that guarantees JSON response parsing without ever throwing
 * SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data?.error || `Permintaan gagal dengan kode ${res.status}`,
          data,
        };
      }
      return { ok: true, status: res.status, data };
    }

    // Response is non-JSON (e.g. HTML 404 or text)
    const text = await res.text();
    const cleanSnippet = text.replace(/<[^>]+>/g, '').trim().slice(0, 150);
    return {
      ok: res.ok,
      status: res.status,
      error: !res.ok ? (cleanSnippet || `Error ${res.status}`) : undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err.message || 'Gagal menghubungi server.',
    };
  }
}
