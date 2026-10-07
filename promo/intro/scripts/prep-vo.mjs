// 整理配音：读取 public/vo-raw/l*.wav（edge-tts 云希），去头尾静音、把句中停顿压到 MAX_GAP，
// 输出到 public/vo/，并把各句时长与短句起点（帧）写回 src/timeline.json。
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const tlUrl = new URL('../src/timeline.json', import.meta.url)
const T = JSON.parse(fs.readFileSync(tlUrl))
const KEYS = ['chaos', 'seen', 'path', 'legacy', 'outro']
const MAX_GAP = 0.25
const TAIL = 0.22
const PHRASE_GAP = 0.2 // 原始停顿超过它视为短句分界

const readWav = (file) => {
  const b = fs.readFileSync(file)
  let o = 12
  while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4)
  const sr = b.readUInt32LE(24)
  const n = b.readUInt32LE(o + 4) / 2
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(o + 8 + i * 2) / 32768
  return { x, sr }
}
const writeWav = (file, x, sr) => {
  const b = Buffer.alloc(44 + x.length * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + x.length * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(sr, 24)
  b.writeUInt32LE(sr * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(x.length * 2, 40)
  x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2))
  fs.writeFileSync(file, b)
}

T.vo.forEach((v, li) => {
  const { x, sr } = readWav(new URL(`../public/vo-raw/l${li + 1}.wav`, import.meta.url))
  const win = Math.round(sr * 0.01)
  const loud = []
  for (let i = 0; i < x.length; i += win) {
    let s = 0
    for (let k = i; k < Math.min(i + win, x.length); k++) s += x[k] * x[k]
    loud.push(20 * Math.log10(Math.sqrt(s / win) + 1e-9) > -40)
  }
  // 连续发声段，合并 80ms 以内的缝隙
  const segs = []
  loud.forEach((on, w) => {
    if (!on) return
    const last = segs[segs.length - 1]
    if (last && w - last[1] <= 8) last[1] = w + 1
    else segs.push([w, w + 1])
  })
  const pad = 3 // 每段前后各留 30ms
  const out = []
  const onsets = []
  let t = 0
  segs.forEach(([a, b], k) => {
    const s0 = Math.max(0, (a - pad) * win)
    const s1 = Math.min(x.length, (b + pad) * win)
    if (k > 0) {
      const gap = (a - segs[k - 1][1]) * 0.01
      const keep = Math.min(gap, MAX_GAP)
      const n = Math.round(keep * sr)
      for (let i = 0; i < n; i++) out.push(0)
      t += keep
      if (gap >= PHRASE_GAP) onsets.push(t)
    } else onsets.push(0)
    const len = s1 - s0
    const fade = Math.round(sr * 0.006)
    for (let i = 0; i < len; i++) out.push(x[s0 + i] * Math.min(1, i / fade, (len - 1 - i) / fade))
    t += len / sr
  })
  for (let i = 0; i < Math.round(TAIL * sr); i++) out.push(0)
  const dst = fileURLToPath(new URL(`../public/vo/l${li + 1}.wav`, import.meta.url))
  writeWav(`${dst}.tmp.wav`, Float32Array.from(out), sr)
  // 响度标准化到 −15 LUFS
  execFileSync('npx', [
    'remotion',
    'ffmpeg',
    '-y',
    '-loglevel',
    'error',
    '-i',
    `${dst}.tmp.wav`,
    '-af',
    'loudnorm=I=-15:TP=-1.5:LRA=7',
    '-ar',
    String(sr),
    '-ac',
    '1',
    dst,
  ])
  fs.unlinkSync(`${dst}.tmp.wav`)
  v.dur = +(out.length / sr - TAIL).toFixed(2)
  T.phrases[KEYS[li]] = onsets.map((o) => Math.round((v.at + o) * T.fps))
  console.log(
    `l${li + 1} at ${v.at}s dur ${v.dur}s end ${(v.at + v.dur).toFixed(2)}s phrases ${T.phrases[KEYS[li]].join(',')}`,
  )
})
fs.writeFileSync(
  tlUrl,
  JSON.stringify(T, null, 2).replace(/\[\s+([\d,\s]+?)\s+\]/g, (m, a) => `[${a.replace(/\s+/g, ' ')}]`) + '\n',
)
