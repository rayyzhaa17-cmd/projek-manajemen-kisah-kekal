const fail = (msg: string) => window.dispatchEvent(new CustomEvent('apierror', { detail: msg }))

export async function api(path: string, method = 'GET', body?: any, quiet = false) {
  let r: Response
  try {
    r = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'crm' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    if (!quiet) fail('Server tidak bisa dihubungi')
    throw Object.assign(new Error('Server tidak bisa dihubungi'), { status: 0 })
  }
  const data = await r.json().catch(() => ({}))
  if (r.status === 401 && path !== '/me' && !path.startsWith('/auth')) window.dispatchEvent(new Event('unauthorized'))
  if (!r.ok) {
    const msg = data.error || 'Terjadi error'
    if (!quiet && r.status !== 401) fail(msg)
    throw Object.assign(new Error(msg), { status: r.status })
  }
  return data
}

export function subscribe(onBooking: (b: any) => void) {
  const es = new EventSource('/api/events')
  es.addEventListener('booking', e => onBooking(JSON.parse((e as MessageEvent).data)))
  return () => es.close()
}
