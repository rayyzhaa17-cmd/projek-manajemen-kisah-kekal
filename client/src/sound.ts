let ctx: AudioContext | null = null

export const soundOn = () => localStorage.getItem('sound') !== 'off'
export const setSound = (on: boolean) => localStorage.setItem('sound', on ? 'on' : 'off')

export async function unlock() {
  try {
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {}
}

// dua nada naik, true kalau suara beneran bunyi
export function chime() {
  if (!ctx || ctx.state !== 'running') return false
  const c = ctx
  const t = c.currentTime
  ;[[880, 0], [1318.5, 0.18]].forEach(([f, d]) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t + d)
    g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5)
    o.connect(g).connect(c.destination)
    o.start(t + d)
    o.stop(t + d + 0.55)
  })
  return true
}
