// 纯代码合成配乐与音效：读取 src/timeline.json，输出 public/bgm.wav（48kHz 立体声 16bit）。
// 120 BPM；所有转场、冲击与界面音效都按时间轴对齐画面。
import fs from 'node:fs'

const T = JSON.parse(fs.readFileSync(new URL('../src/timeline.json', import.meta.url)))
const SR = 48000
const DUR = T.duration
const N = Math.ceil(SR * DUR)
const L = new Float32Array(N)
const R = new Float32Array(N)
const REV = new Float32Array(N) // 混响发送
const DLY = new Float32Array(N) // 延迟发送
const PUMP = new Float32Array(N).fill(1) // 底鼓侧链

let seed = 20261007
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
const noise = () => rnd() * 2 - 1
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
const S = (t) => Math.floor(t * SR)
const fr = (frame) => frame / T.fps
const TAU = Math.PI * 2

function put(i, v, pan = 0, rev = 0, dly = 0) {
  if (i < 0 || i >= N) return
  const a = ((pan + 1) * Math.PI) / 4
  L[i] += v * Math.cos(a) * Math.SQRT2
  R[i] += v * Math.sin(a) * Math.SQRT2
  if (rev) REV[i] += v * rev
  if (dly) DLY[i] += v * dly
}

class SVF {
  lp = 0
  bp = 0
  hp = 0
  run(x, fc, damp = 1) {
    const f = 2 * Math.sin((Math.PI * Math.min(Math.max(fc, 20), SR / 6.5)) / SR)
    this.hp = x - this.lp - damp * this.bp
    this.bp += f * this.hp
    this.lp += f * this.bp
    return this
  }
}

// 用 PolyBLEP 抑制锯齿波混叠
function blepSaw(phase, dt) {
  let v = 2 * phase - 1
  if (phase < dt) {
    const t = phase / dt
    v -= t + t - t * t - 1
  } else if (phase > 1 - dt) {
    const t = (phase - 1) / dt
    v -= t * t + t + t + 1
  }
  return v
}

// ───────────── 鼓组 ─────────────

function kick(t, g = 1, pump = true) {
  const i0 = S(t)
  let ph = 0
  for (let k = 0; k < S(0.5); k++) {
    const s = k / SR
    const f = 44 + 120 * Math.exp(-s / 0.032)
    ph += f / SR
    const amp = Math.exp(-s / 0.17)
    let v = Math.sin(TAU * ph) * amp
    if (s < 0.004) v += noise() * 0.5 * (1 - s / 0.004)
    put(i0 + k, Math.tanh(v * 1.6) * 0.62 * g)
  }
  if (pump)
    for (let k = 0; k < S(0.3); k++) {
      const s = k / SR
      const d = 1 - 0.72 * Math.pow(Math.max(0, 1 - s / 0.28), 2)
      if (PUMP[i0 + k] > d) PUMP[i0 + k] = d
    }
}

function clap(t, g = 1, pan = 0) {
  const i0 = S(t)
  const f = new SVF()
  for (let k = 0; k < S(0.3); k++) {
    const s = k / SR
    let env = Math.exp(-s / 0.11)
    for (const b of [0, 0.011, 0.022]) if (s >= b && s < b + 0.01) env = Math.max(env, Math.exp(-(s - b) / 0.004))
    const v = f.run(noise(), 1400, 0.9).bp * env
    put(i0 + k, v * 0.5 * g, pan, 0.35)
  }
}

function hat(t, g = 1, decay = 0.035, pan = 0.2) {
  const i0 = S(t)
  let lp = 0
  for (let k = 0; k < S(decay * 6); k++) {
    const s = k / SR
    const n = noise()
    lp += 0.55 * (n - lp)
    put(i0 + k, (n - lp) * Math.exp(-s / decay) * 0.22 * g, pan, 0.05)
  }
}

function crash(t, g = 1, dur = 1.8) {
  const i0 = S(t)
  const fl = new SVF()
  const fr2 = new SVF()
  for (let k = 0; k < S(dur); k++) {
    const s = k / SR
    const env = Math.exp(-s / (dur * 0.35))
    const vl = fl.run(noise(), 7000, 0.6).hp
    const vr = fr2.run(noise(), 7200, 0.6).hp
    const i = i0 + k
    if (i >= N) break
    L[i] += vl * env * 0.16 * g
    R[i] += vr * env * 0.16 * g
    REV[i] += (vl + vr) * env * 0.05 * g
  }
}

function boom(t, g = 1, dur = 2.2) {
  const i0 = S(t)
  let ph = 0
  for (let k = 0; k < S(dur); k++) {
    const s = k / SR
    const f = 30 + 70 * Math.exp(-s / 0.18)
    ph += f / SR
    const amp = Math.exp(-s / (dur * 0.3))
    put(i0 + k, Math.tanh(Math.sin(TAU * ph) * amp * 2.2) * 0.55 * g, 0, 0.08)
  }
}

// ───────────── 转场音效 ─────────────

function whoosh(t0, t1, g = 1, pan0 = -0.7, pan1 = 0.7, f0 = 300, f1 = 5000) {
  const i0 = S(t0)
  const n = S(t1 - t0)
  const f = new SVF()
  for (let k = 0; k < n; k++) {
    const x = k / n
    const bell = Math.pow(Math.sin(Math.PI * Math.pow(x, 0.8)), 2)
    const fc = f0 * Math.pow(f1 / f0, Math.sin(Math.PI * x * 0.5))
    const v = f.run(noise(), fc, 0.5).bp * bell
    put(i0 + k, v * 0.55 * g, pan0 + (pan1 - pan0) * x, 0.3)
  }
}

function riser(t0, t1, g = 1) {
  const i0 = S(t0)
  const n = S(t1 - t0)
  const f = new SVF()
  let ph = 0
  for (let k = 0; k < n; k++) {
    const x = k / n
    const amp = x * x
    const fc = 250 * Math.pow(40, x)
    const nv = f.run(noise(), fc, 0.35).bp
    ph += (180 * Math.pow(6, x)) / SR
    const tone = Math.sin(TAU * ph) * 0.25
    put(i0 + k, (nv * 0.4 + tone) * amp * g, Math.sin(x * 18) * 0.3, 0.25)
  }
}

function reverseSwell(t0, t1, g = 1) {
  const i0 = S(t0)
  const n = S(t1 - t0)
  const f = new SVF()
  for (let k = 0; k < n; k++) {
    const x = k / n
    const amp = Math.pow(x, 3.5)
    const v = f.run(noise(), 600 + 9000 * x * x, 0.7).lp
    put(i0 + k, v * amp * 0.7 * g, 0, 0.15)
  }
}

function scratch(t, g = 1) {
  const i0 = S(t)
  let ph = 0
  const n = S(0.32)
  for (let k = 0; k < n; k++) {
    const x = k / n
    const f = 900 * Math.pow(50 / 900, x)
    ph += f / SR
    const p = ph % 1
    put(i0 + k, (blepSaw(p, f / SR) * 0.5 + Math.sin(TAU * ph) * 0.5) * (1 - x) * 0.35 * g)
  }
}

// ───────────── 界面音效 ─────────────

function ping(t, f, g = 1, pan = 0, decay = 0.14) {
  const i0 = S(t)
  for (let k = 0; k < S(decay * 5); k++) {
    const s = k / SR
    const env = Math.exp(-s / decay) * Math.min(1, s / 0.002)
    const v = Math.sin(TAU * f * s) + 0.35 * Math.sin(TAU * f * 2.76 * s) * Math.exp(-s / 0.03)
    put(i0 + k, v * env * 0.16 * g, pan, 0.25, 0.15)
  }
}

function buzz(t, g = 1, pan = 0) {
  const i0 = S(t)
  const f = new SVF()
  for (let k = 0; k < S(0.16); k++) {
    const s = k / SR
    const fq = s < 0.07 ? 233 : 185
    const p = (fq * s) % 1
    const env = (s < 0.07 ? Math.exp(-s / 0.05) : Math.exp(-(s - 0.07) / 0.05)) * Math.min(1, s / 0.002)
    put(i0 + k, f.run(blepSaw(p, fq / SR), 1600, 0.8).lp * env * 0.22 * g, pan, 0.1)
  }
}

function thock(t, g = 1, f0 = 150) {
  const i0 = S(t)
  let ph = 0
  for (let k = 0; k < S(0.3); k++) {
    const s = k / SR
    ph += (f0 * 0.5 + f0 * 0.5 * Math.exp(-s / 0.03)) / SR
    let v = Math.sin(TAU * ph) * Math.exp(-s / 0.09)
    if (s < 0.006) v += noise() * 0.6 * (1 - s / 0.006)
    put(i0 + k, Math.tanh(v * 1.4) * 0.42 * g, 0, 0.18)
  }
}

function sparkle(t, g = 1, pan = 0) {
  for (let j = 0; j < 4; j++)
    ping(t + j * 0.035, mtof(96 + [0, 4, 7, 12][j]), 0.5 * g * (1 - j * 0.18), pan + (j - 1.5) * 0.15, 0.08)
}

// ───────────── 乐器 ─────────────

function pad(t0, t1, notes, g = 1, { cutoff = 2200, attack = 0.25, release = 0.8, pumpAmt = 1, rev = 0.35 } = {}) {
  const i0 = S(t0)
  const n = S(t1 - t0 + release)
  const hold = t1 - t0
  const voices = []
  notes.forEach((m, ni) => {
    for (let d = 0; d < 5; d++) {
      const det = (d - 2) * 0.09
      voices.push({ f: mtof(m + det), ph: rnd(), pan: ((d - 2) / 2) * 0.8 * (ni % 2 ? 1 : -1) * 0.9, filt: new SVF() })
    }
  })
  const norm = 1 / Math.sqrt(voices.length)
  for (let k = 0; k < n; k++) {
    const s = k / SR
    const env = Math.min(1, s / attack) * (s > hold ? Math.exp(-(s - hold) / (release * 0.35)) : 1)
    const i = i0 + k
    if (i >= N) break
    const p = 1 - pumpAmt * (1 - PUMP[i])
    const fc = cutoff * (0.85 + 0.15 * Math.sin(s * 1.7))
    for (const v of voices) {
      v.ph = (v.ph + v.f / SR) % 1
      const x = v.filt.run(blepSaw(v.ph, v.f / SR), fc, 1.1).lp
      put(i, x * env * p * norm * 0.2 * g, v.pan, rev)
    }
  }
}

function pluck(t, m, g = 1, pan = 0) {
  const i0 = S(t)
  const f = mtof(m)
  const filt = new SVF()
  let ph = rnd()
  for (let k = 0; k < S(0.45); k++) {
    const s = k / SR
    ph = (ph + f / SR) % 1
    const sq = ph < 0.5 ? 1 : -1
    const x = blepSaw(ph, f / SR) * 0.7 + sq * 0.3
    const fc = 300 + 5200 * Math.exp(-s / 0.07)
    const env = Math.exp(-s / 0.16) * Math.min(1, s / 0.002)
    put(i0 + k, filt.run(x, fc, 0.6).lp * env * 0.17 * g, pan, 0.18, 0.32)
  }
}

function bass(t, m, dur, g = 1) {
  const i0 = S(t)
  const f = mtof(m)
  const filt = new SVF()
  let ph = 0
  for (let k = 0; k < S(dur + 0.05); k++) {
    const s = k / SR
    ph = (ph + f / SR) % 1
    const env = Math.min(1, s / 0.004) * (s > dur ? Math.exp(-(s - dur) / 0.015) : 1)
    const x = Math.sin(TAU * ph) * 0.8 + filt.run(blepSaw(ph, f / SR), 520, 1).lp * 0.45
    const i = i0 + k
    put(i, Math.tanh(x * 1.3) * env * 0.36 * g * (i < N ? 0.35 + 0.65 * PUMP[i] : 1))
  }
}

function drone(t0, t1, notes, g = 1) {
  const i0 = S(t0)
  const n = S(t1 - t0)
  const vs = notes.map((m) => ({ f: mtof(m), ph: rnd(), filt: new SVF() }))
  for (let k = 0; k < n; k++) {
    const x = k / n
    const s = k / SR
    const amp = Math.min(1, s / 0.6) * (0.35 + 0.65 * x)
    const trem = 0.75 + 0.25 * Math.sin(TAU * s * (3 + 9 * x))
    let v = 0
    for (const o of vs) {
      o.ph = (o.ph + (o.f * (1 + 0.004 * Math.sin(s * 5))) / SR) % 1
      v += o.filt.run(blepSaw(o.ph, o.f / SR), 300 + 900 * x, 0.9).lp
    }
    put(i0 + k, v * amp * trem * 0.16 * g, Math.sin(s * 2) * 0.3, 0.12)
  }
}

function shimmer(t0, t1, notes, g = 1) {
  const i0 = S(t0)
  const n = S(t1 - t0)
  for (let k = 0; k < n; k++) {
    const x = k / n
    const s = k / SR
    const env = Math.sin(Math.PI * x)
    let v = 0
    notes.forEach((m, j) => (v += Math.sin(TAU * mtof(m) * s + j) * (0.6 + 0.4 * Math.sin(s * (6 + j * 3)))))
    put(i0 + k, v * env * 0.05 * g, Math.sin(s * 3) * 0.5, 0.6)
  }
}

// ───────────── 编曲 ─────────────

const B = 0.5 // 一拍
const bubbleNotes = [1318.5, 1396.9, 1568, 1661.2, 1760, 1864.7, 1244.5]

// 1. 混乱（0 – 3.75s）
drone(0, fr(T.freeze), [33, 34, 40, 46], 1)
for (let b = 0; b < 8; b++) {
  kick(b * B, 0.55 + b * 0.04, false)
  kick(b * B + 0.17, 0.3, false)
}
for (let t = 1.0; t < fr(T.freeze) - 0.01; t += 0.125)
  hat(t, 0.3 + ((t - 1) / 2.75) * 0.8, rnd() < 0.15 ? 0.12 : 0.03, (rnd() - 0.5) * 0.8)
T.bubbles.forEach((b, k) =>
  ping(
    fr(b),
    bubbleNotes[k % bubbleNotes.length] * (k > 14 ? 1.06 : 1),
    0.7 + (k / 28) * 0.6,
    (rnd() - 0.5) * 1.2,
    0.1,
  ),
)
T.badges.forEach((b) => buzz(fr(b), 0.9, (rnd() - 0.5) * 1.2))
T.files.forEach((b, k) => whoosh(fr(b), fr(b) + 0.55, 0.45, k % 2 ? 0.8 : -0.8, k % 2 ? -0.8 : 0.8, 600, 7000))
riser(1.4, fr(T.freeze), 0.9)
for (let t = 3.0; t < fr(T.freeze) - 0.02; t += 0.0625)
  if (rnd() < 0.55) ping(t, 3000 + rnd() * 3000, 0.25, (rnd() - 0.5) * 1.6, 0.012)

// 2. 冻结与吸入（3.75 – 5.0s）
scratch(fr(T.freeze), 1)
boom(fr(T.freeze), 0.45, 1.2)
shimmer(fr(T.freeze) + 0.05, fr(T.impact) - 0.05, [88, 95, 100], 1)
reverseSwell(fr(T.suck[0]) - 0.2, fr(T.impact) - 0.03, 1)
whoosh(fr(T.suck[0]), fr(T.impact) - 0.03, 0.9, 0.9, -0.9, 200, 6000)

// 3. 冲击与 Logo（5.0 – 6.0s）
const tI = fr(T.impact)
boom(tI, 1.1)
crash(tI, 1, 2.2)
kick(tI, 1.1)
pad(tI, tI + 0.9, [57, 60, 64, 69, 72], 1.3, { attack: 0.005, release: 1.2, cutoff: 3200 })
pad(tI + 0.05, 6.0, [45, 52], 0.8, { attack: 0.4, release: 0.4, cutoff: 900 })
;[0, 2, 4].forEach((j) => pluck(tI + 0.25 + j * 0.125, [69, 72, 76][j / 2], 0.6, 0.3))
sparkle(5.55, 0.8, -0.3)
sparkle(5.65, 0.8, 0.3)
whoosh(fr(T.header[0]), fr(T.header[1]), 0.35, 0, -0.4, 900, 5000)
riser(5.4, 6.0, 0.35)

// 4. 律动（6.0 – 12.0s）：F → G → Em → Am
const chords = [
  { t: 6.0, len: 2, root: 41, pad: [53, 57, 60, 64], arp: [65, 69, 72, 76] },
  { t: 8.0, len: 2, root: 43, pad: [55, 59, 62, 67], arp: [67, 71, 74, 79] },
  { t: 10.0, len: 1, root: 40, pad: [52, 55, 59, 62], arp: [64, 67, 71, 74] },
  { t: 11.0, len: 1, root: 45, pad: [57, 60, 64, 67], arp: [69, 72, 76, 79] },
]
const arpPat = [0, 1, 2, 3, 2, 1, 2, 3]
for (const c of chords) {
  pad(c.t, c.t + c.len, c.pad, 1, { attack: 0.08, release: 0.3 })
  for (let s = 0; s < c.len * 4; s++) {
    const t = c.t + s * B
    bass(t, c.root, 0.2)
    bass(t + 0.25, c.root + 12, 0.18, 0.8)
  }
  for (let s = 0; s < c.len * 8; s++)
    pluck(c.t + s * 0.125, c.arp[arpPat[s % 8]], s % 2 ? 0.55 : 0.8, s % 2 ? 0.45 : -0.45)
}
for (let t = 6.0; t < 11.0; t += B) kick(t, 1)
for (let t = 6.5; t < 11.0; t += 2 * B) clap(t, 0.9, 0)
for (let t = 6.25; t < 11.5; t += B) hat(t, 0.9, 0.05, 0.25)
for (let t = 6.0; t < 11.75; t += 0.125) hat(t, 0.25, 0.018, -0.3)
// 进入第三幕前的军鼓滚奏
const roll = [
  11.0, 11.125, 11.25, 11.375, 11.5, 11.5625, 11.625, 11.6875, 11.75, 11.78125, 11.8125, 11.84375, 11.875, 11.90625,
]
roll.forEach((t, k) => clap(t, 0.25 + k * 0.05, k % 2 ? 0.2 : -0.2))
kick(11.0, 1)
kick(11.5, 1)
// 第一幕：热力图闪光
for (let k = 0; k < 14; k++)
  ping(6.15 + k * 0.11 + rnd() * 0.05, mtof([89, 93, 96, 100][k % 4]), 0.35, (rnd() - 0.5) * 1.4, 0.07)
sparkle(fr(T.phrases.seen[1]), 0.9, 0)
// 转场
whoosh(fr(T.whip[0]) - 0.05, fr(T.whip[1]) + 0.05, 1, -0.2, 0.2, 250, 7000)
T.pathNodes.forEach((n, k) => {
  ping(fr(n), mtof([79, 83, 86, 91, 98][k]), k === 4 ? 1.4 : 1, k % 2 ? 0.35 : -0.35, k === 4 ? 0.4 : 0.18)
  if (k === 4) sparkle(fr(n) + 0.03, 1, 0)
})
whoosh(fr(T.iris[0]) - 0.05, fr(T.iris[1]), 0.8, 0.3, -0.3, 400, 4000)
T.slabs.forEach((n, k) => {
  thock(fr(n), 1 + k * 0.1, 140 - k * 12)
  ping(fr(n), mtof([64, 67, 71, 76][k]), 0.6, 0, 0.25)
})
riser(fr(T.beam) - 0.1, 12.0, 0.9)
reverseSwell(11.3, 11.98, 0.9)

// 5. 收尾（12.0 – 15.0s）：C add9
const tO = fr(T.outroImpact)
boom(tO, 1.2, 2.6)
crash(tO, 1.1, 2.8)
kick(tO, 1.2)
pad(tO, 14.0, [48, 55, 60, 62, 64, 67, 71], 1.15, { attack: 0.01, release: 1.6, cutoff: 3000, rev: 0.45 })
bass(tO, 36, 1.9, 1)
kick(13.0, 0.9)
clap(13.0, 0.7)
for (let t = 12.5; t < 14.0; t += B) hat(t, 0.7, 0.06, 0.25)
for (let s = 0; s < 16; s++)
  pluck(
    12.0 + s * 0.125,
    [72, 74, 76, 79, 84, 79, 76, 74][s % 8] + (s >= 8 ? 12 : 0),
    s % 2 ? 0.5 : 0.75,
    s % 2 ? 0.5 : -0.5,
  )
riser(13.3, 14.0, 0.6)
const tB = fr(T.button)
kick(tB, 1.2, false)
boom(tB, 0.9, 1.4)
crash(tB, 0.8, 1.2)
pad(tB, tB + 0.35, [60, 64, 67, 72, 76, 79], 1.2, { attack: 0.004, release: 1.0, cutoff: 4200, pumpAmt: 0, rev: 0.6 })
sparkle(tB + 0.02, 1.2, 0)

// ───────────── 效果总线 ─────────────

function reverb(send, wet = 0.32) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356]
  const aps = [556, 441, 341]
  for (const [out, spread] of [
    [L, 0],
    [R, 23],
  ]) {
    const acc = new Float32Array(N)
    for (const c of combs) {
      const d = c + spread
      const buf = new Float32Array(d)
      let idx = 0
      let lp = 0
      for (let i = 0; i < N; i++) {
        const y = buf[idx]
        lp = y * 0.72 + lp * 0.28
        buf[idx] = send[i] + lp * 0.86
        acc[i] += y
        idx = (idx + 1) % d
      }
    }
    for (const a of aps) {
      const d = a + spread
      const buf = new Float32Array(d)
      let idx = 0
      for (let i = 0; i < N; i++) {
        const b = buf[idx]
        const y = -acc[i] + b
        buf[idx] = acc[i] + b * 0.5
        acc[i] = y
        idx = (idx + 1) % d
      }
    }
    for (let i = 0; i < N; i++) out[i] += acc[i] * wet * 0.18
  }
}

function pingPong(send, time = 0.375, fb = 0.38, wet = 0.5) {
  const d = S(time)
  const bl = new Float32Array(N)
  const br = new Float32Array(N)
  let lpL = 0
  let lpR = 0
  for (let i = 0; i < N; i++) {
    const fromR = i >= d ? br[i - d] : 0
    const fromL = i >= d ? bl[i - d] : 0
    lpL += 0.35 * (send[i] + fromR * fb - lpL)
    lpR += 0.35 * (fromL - lpR)
    bl[i] = lpL
    br[i] = lpR
    L[i] += bl[i] * wet
    R[i] += br[i] * wet
  }
}

pingPong(DLY)
reverb(REV)

// 母带：低切、软削波、尾部淡出、归一化
let hpL = 0
let hpR = 0
let peak = 0
for (let i = 0; i < N; i++) {
  hpL += 0.0033 * (L[i] - hpL)
  hpR += 0.0033 * (R[i] - hpR)
  const fade = Math.min(1, (N - i) / S(0.5))
  L[i] = Math.tanh((L[i] - hpL) * 1.15) * fade
  R[i] = Math.tanh((R[i] - hpR) * 1.15) * fade
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const gain = 0.89 / peak
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0)
buf.writeUInt32LE(36 + N * 4, 4)
buf.write('WAVEfmt ', 8)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20)
buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24)
buf.writeUInt32LE(SR * 4, 28)
buf.writeUInt16LE(4, 32)
buf.writeUInt16LE(16, 34)
buf.write('data', 36)
buf.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4)
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4)
}
fs.mkdirSync(new URL('../public/', import.meta.url), { recursive: true })
fs.writeFileSync(new URL('../public/bgm.wav', import.meta.url), buf)
console.log(`bgm.wav ${DUR}s peak ${peak.toFixed(2)} → normalized`)
