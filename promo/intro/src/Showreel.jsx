import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths'
import { noise2D } from '@remotion/noise'
import T from './timeline.json'

// OpenLIMS 15 秒竖屏片头：混乱 → 冻结吸入 → Logo 爆发 → 被看见 / 有路走 / 能传承 → 开源定格。
// 所有关键帧来自 timeline.json，与 scripts/synth.mjs 合成的配乐共用同一份时间轴。

const FONT = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif'
const LATIN = '"Helvetica Neue", Arial, Helvetica, sans-serif'
const MONO = 'Menlo, "SF Mono", monospace'
const C = {
  ink: '#f6efe2',
  muted: '#b9a888',
  accent: '#e8c77a',
  brand: '#c0923e',
  fill: '#a67c2e',
  navy: '#0b0a08',
  amber: '#fbbf24',
  red: '#ef4444',
}
const CX = 540
const CY = 760
const HX = 417
const HY = 170
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
const ci = (f, a, b, from = 0, to = 1, easing) =>
  interpolate(f, [a, b], [from, to], easing ? { ...clamp, easing } : clamp)
const outE = Easing.bezier(0.16, 1, 0.3, 1)
const inOut = Easing.inOut(Easing.cubic)
const inE = Easing.in(Easing.cubic)
const P = T.phrases

// ───────────── 通用部件 ─────────────

const BrandIcon = ({ size, arc = 1, ell = 1, d1 = 1, d2 = 1, sweep = -2, glow = 1 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.2,
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(150deg, #2a2418 0%, #12100b 55%, #070605 100%)',
      border: `${Math.max(2, size * 0.012)}px solid rgba(232,199,122,0.75)`,
      boxSizing: 'border-box',
      boxShadow: `0 ${size * 0.12}px ${size * 0.32}px rgba(212,169,79,${0.38 * glow}), inset 0 2px 0 rgba(255,240,200,0.25)`,
    }}
  >
    <svg width="100%" height="100%" viewBox="0 0 128 128" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id={`gold${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1c4" />
          <stop offset="0.5" stopColor="#e8c77a" />
          <stop offset="1" stopColor="#b08433" />
        </linearGradient>
      </defs>
      <g
        transform="translate(12 4) scale(0.9)"
        fill="none"
        stroke={`url(#gold${size})`}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {arc > 0 && (
          <path d="M86 30a42 42 0 1 0 0 60" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - arc} />
        )}
        {ell > 0 && <path d="M52 37v46h42" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ell} />}
        <circle cx={95} cy={20} r={7 * d1} fill="#f3d48a" stroke="none" />
        <circle cx={95} cy={100} r={7 * d2} fill="#e8c77a" stroke="none" />
      </g>
    </svg>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(115deg, transparent 35%, rgba(255,236,190,0.45) 50%, transparent 65%)',
        transform: `translateX(${sweep * 100}%)`,
      }}
    />
  </div>
)

const Burst = ({
  at,
  x,
  y,
  n = 40,
  k: key,
  spread = [500, 1300],
  life = 50,
  size = [6, 18],
  colors = ['#ffffff', C.accent, C.brand],
}) => {
  const f = useCurrentFrame()
  const t = f - at
  if (t < 0 || t > life) return null
  const p = t / life
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = random(`${key}a${i}`) * Math.PI * 2
        const d = (spread[0] + random(`${key}s${i}`) * (spread[1] - spread[0])) * outE(p)
        const s = size[0] + random(`${key}z${i}`) * (size[1] - size[0])
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.cos(a) * d - s / 2,
              top: y + Math.sin(a) * d - s / 2,
              width: s,
              height: s,
              borderRadius: i % 3 ? '50%' : 3,
              background: colors[i % colors.length],
              opacity: (1 - p) * (0.6 + 0.4 * random(`${key}o${i}`)),
              transform: `rotate(${p * 400 * (i % 2 ? 1 : -1)}deg) scale(${1 - p * 0.5})`,
              boxShadow: `0 0 ${s}px ${colors[i % colors.length]}`,
            }}
          />
        )
      })}
    </>
  )
}

const Ring = ({ at, x, y, life = 40, from = 120, to = 900, width = 6, color = '255,255,255' }) => {
  const f = useCurrentFrame()
  const t = f - at
  if (t < 0 || t > life) return null
  const p = outE(t / life)
  const r = from + (to - from) * p
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: `${Math.max(1, width * (1 - p))}px solid rgba(${color},${1 - p})`,
      }}
    />
  )
}

// 逐字从遮罩下升起
const CharRise = ({ text, at, y, size, color = C.muted, weight = 500, stagger = 2, family = FONT, spacing = 2 }) => {
  const f = useCurrentFrame()
  if (f < at) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        transform: 'translateY(-50%)',
        display: 'flex',
        justifyContent: 'center',
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        color,
        letterSpacing: spacing,
        overflow: 'hidden',
        padding: '0.12em 0',
      }}
    >
      {[...text].map((ch, i) => {
        const p = ci(f, at + i * stagger, at + i * stagger + 18, 0, 1, outE)
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              transform: `translateY(${(1 - p) * 110}%)`,
              opacity: p,
              filter: `blur(${(1 - p) * 6}px)`,
            }}
          >
            {ch}
          </span>
        )
      })}
    </div>
  )
}

// 主标题：压字距砸入 + 高光扫过
const Headline = ({ text, at, y, size = 156 }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < at) return null
  const p = spring({ frame: f - at, fps, config: { damping: 13, stiffness: 130, mass: 0.8 } })
  const shine = ci(f, at + 8, at + 46, 0, 1, inOut)
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: 4 + 44 * Math.max(0, 1 - p),
        opacity: Math.min(1, p * 1.6),
        transform: `translateY(-50%) scale(${1.35 - 0.35 * p})`,
        filter: `blur(${Math.max(0, 1 - p) * 18}px) drop-shadow(0 0 40px rgba(212,169,79,0.55))`,
        backgroundImage: 'linear-gradient(100deg, #f1d58e 0%, #fff3d1 40%, #ffffff 50%, #fff3d1 60%, #e0b45a 100%)',
        backgroundSize: '320% 100%',
        backgroundPosition: `${100 - shine * 100}% 0`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      {text}
    </div>
  )
}

const Caption = ({ text, at, y }) => {
  const f = useCurrentFrame()
  const p = ci(f, at, at + 20, 0, 1, outE)
  if (p <= 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: 32,
        fontWeight: 500,
        color: C.accent,
        letterSpacing: 4 + (1 - p) * 20,
        opacity: p,
      }}
    >
      {text}
    </div>
  )
}

const Grain = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width="1080"
        height="1920"
        style={{ position: 'absolute', inset: 0, opacity: 0.09, mixBlendMode: 'overlay' }}
      >
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 12} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill
        style={{ background: 'radial-gradient(130% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)' }}
      />
    </AbsoluteFill>
  )
}

// ───────────── 第一幕：混乱 ─────────────

const MSGS = [
  '谁负责这个？',
  '新人该做什么？',
  '表格又被改乱了',
  '学长的资料在哪？',
  '@所有人 收一下',
  '这个月积分怎么算？',
  '报名表发我一份',
  '上次比赛的证书呢？',
  '经费报销找谁？',
  '群文件过期了',
  '收到',
  '+1',
  '在吗在吗',
  '项目进度更新一下',
  '谁有去年的文档？',
  '收到收到',
  '我也不知道…',
  '？？？',
  '明天几点开会？',
  '新同学拉群了吗',
  '这个任务谁接？',
  '+1',
  '表格是哪一版？',
  '又没人回',
  '@所有人',
  '急！！',
  '谁改了我的表',
  '求资料',
]
const NAMES = '张李王陈刘杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于'
const ORD = 10

const Sucked = ({ x, y, i, anchor = 'center', rot = 0, scale = 1, opacity = 1, children }) => {
  const f = useCurrentFrame()
  const s = ci(f, T.suck[0] + (i % 9) * 2.5, T.suck[1], 0, 1, inE)
  const px = x + (CX - x) * s
  const py = y + (CY - y) * s
  const tx = anchor === 'left' ? '0%' : anchor === 'right' ? '-100%' : '-50%'
  const origin = anchor === 'left' ? '0% 50%' : anchor === 'right' ? '100% 50%' : '50% 50%'
  const spin = (i % 2 ? 1 : -1) * s * s * 540
  const op = opacity * (1 - ci(s, 0.75, 1))
  if (op <= 0.001) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: px,
        top: py,
        opacity: op,
        transformOrigin: origin,
        transform: `translate(${tx},-50%) rotate(${rot + spin}deg) scale(${scale * (1 - s * 0.97)})`,
        filter: s > 0 ? `blur(${s * 12}px)` : undefined,
      }}
    >
      {children}
    </div>
  )
}

const Bubble = ({ text, name, side, hue }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: side === 'right' ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 16,
      fontFamily: FONT,
    }}
  >
    <div
      style={{
        width: 68,
        height: 68,
        borderRadius: 18,
        background: `hsl(${hue},14%,28%)`,
        color: '#cbd5e1',
        fontSize: 30,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {name}
    </div>
    <div
      style={{
        background: side === 'right' ? '#2b3442' : '#1f242c',
        color: '#d8dee8',
        fontSize: 34,
        padding: '16px 26px',
        borderRadius: 22,
        whiteSpace: 'nowrap',
        boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {text}
    </div>
  </div>
)

const ChaosCaption = ({ text, at, end, mode, fc }) => {
  const { fps } = useVideoConfig()
  if (fc < at || fc >= end + 6) return null
  const p = spring({ frame: fc - at, fps, config: { damping: 14, stiffness: 210 } })
  const exit = fc >= end ? (fc - end) / 6 : 0
  const g = random(`gl${Math.floor(fc / 2)}${text}`)
  const spike = g > 0.72 ? (g - 0.72) * 90 : 3
  const slice = exit > 0 ? (random(`sl${fc}`) - 0.5) * 160 * exit : g > 0.9 ? (g - 0.9) * 300 : 0
  const ramp = ci(fc, at + 6, at + 50)
  const size = text.length > 4 ? 138 : 158
  const chars = (color, dx) => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color,
        transform: `translateX(${dx}px)`,
        mixBlendMode: color === '#f1f5f9' ? 'normal' : 'screen',
        letterSpacing: mode === 'lost' ? 4 + ramp * 34 : 4,
      }}
    >
      {[...text].map((ch, i) => {
        let tr = ''
        if (mode === 'messy')
          tr = `translate(${(random(`mx${i}`) - 0.5) * 50 * ramp}px, ${(random(`my${i}`) - 0.5) * 90 * ramp}px) rotate(${(random(`mr${i}`) - 0.5) * 40 * ramp}deg)`
        if (mode === 'lost')
          tr = `translateY(${Math.sin((fc + i * 9) / 7) * 14 * ramp}px) rotate(${Math.sin((fc + i * 13) / 11) * 8 * ramp}deg)`
        return (
          <span key={i} style={{ display: 'inline-block', transform: tr }}>
            {ch}
          </span>
        )
      })}
    </div>
  )
  return (
    <Sucked x={CX} y={1000} i={99}>
      <div
        style={{
          position: 'relative',
          width: 1000,
          height: 300,
          fontFamily: FONT,
          fontSize: size,
          fontWeight: 600,
          opacity: Math.min(1, p * 1.5) * (1 - exit),
          transform: `scale(${1.6 - 0.6 * p}) translateX(${slice}px)`,
          filter: `blur(${Math.max(0, 1 - p) * 14}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -60,
            right: -60,
            top: -40,
            bottom: -40,
            background: 'radial-gradient(closest-side, rgba(5,7,10,0.85), rgba(5,7,10,0.6) 60%, transparent)',
          }}
        />
        {mode === 'echo' &&
          [0, 1, 2, 3].map((j) => {
            const off = (((fc - at) * 16 + j * 170) % 680) - 340
            return (
              <div
                key={j}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#64748b',
                  opacity: 0.28 * (1 - Math.abs(off) / 340),
                  transform: `translateY(${off}px)`,
                  letterSpacing: 4,
                }}
              >
                {text}
              </div>
            )
          })}
        {chars('#ff2e63', spike)}
        {chars('#08d9d6', -spike)}
        {chars('#f1f5f9', 0)}
        {mode === 'lost' && (
          <div
            style={{
              position: 'absolute',
              right: -20,
              top: -60,
              fontSize: 120,
              color: C.amber,
              transform: `rotate(${12 + Math.sin(fc / 6) * 14}deg) scale(${ci(fc, at + 20, at + 32, 0, 1, outE)})`,
            }}
          >
            ?
          </div>
        )}
      </div>
    </Sucked>
  )
}

const Chaos = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f >= T.impact) return null
  const fc = Math.min(f, T.freeze)
  const frozen = f >= T.freeze
  const amp = frozen ? 0 : ci(fc, 40, 224, 0, 22, Easing.in(Easing.quad))
  const sx = noise2D('sx', fc * 0.2, 0) * amp
  const sy = noise2D('sy', fc * 0.2, 0) * amp
  const sr = noise2D('sr', fc * 0.12, 0) * amp * 0.07
  const gray = ci(f, T.freeze, T.freeze + 10)
  let scroll = 0
  for (let j = 0; j < ORD; j++)
    if (fc >= T.bubbles[j]) scroll += spring({ frame: fc - T.bubbles[j], fps, config: { damping: 22, stiffness: 220 } })
  return (
    <AbsoluteFill
      style={{
        background: '#0c0e12',
        filter: `grayscale(${0.35 + 0.65 * gray}) contrast(${1 + 0.2 * gray}) brightness(${1 - 0.2 * gray})`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.09) 2px, transparent 2px), linear-gradient(90deg, rgba(148,163,184,0.09) 2px, transparent 2px)',
          backgroundSize: '180px 64px',
          backgroundPosition: `${-fc * 1.5}px ${-fc * 3}px`,
          transform: `rotate(${-7 + noise2D('g', fc * 0.03, 0) * 3}deg) scale(1.3)`,
          opacity: 1 - ci(f, T.suck[0], T.suck[1]),
        }}
      />
      <AbsoluteFill style={{ transform: `translate(${sx}px,${sy}px) rotate(${sr}deg)` }}>
        {T.files.map((a, k) => {
          if (fc < a) return null
          const dir = k % 2 ? -1 : 1
          const x = ci(fc, a, a + 55, dir > 0 ? -400 : 1480, dir > 0 ? 1480 : -400, Easing.inOut(Easing.quad))
          const name = ['成员名单_最终版(3).xlsx', '积分统计_改改改.xlsx', '报名表_新新新.xlsx'][k]
          return (
            <Sucked key={`f${k}`} x={x} y={[430, 1330, 860][k]} i={60 + k} rot={dir * -4}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 24px',
                  borderRadius: 14,
                  background: '#1b2620',
                  border: '1.5px solid rgba(134,239,172,0.35)',
                  color: '#bbf7d0',
                  fontFamily: MONO,
                  fontSize: 30,
                  whiteSpace: 'nowrap',
                  transform: `skewX(${-14 * dir}deg)`,
                  filter: 'blur(1.5px)',
                }}
              >
                <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth={2}>
                  <rect x={3} y={3} width={18} height={18} rx={2} />
                  <path d="M3 9h18M3 15h18M9 3v18" />
                </svg>
                {name}
              </div>
            </Sucked>
          )
        })}
        {Array.from({ length: 10 }, (_, k) => {
          const a = 88 + k * 13
          if (fc < a) return null
          const flick = random(`fl${k}-${Math.floor(fc / 3)}`) > 0.82 ? 0.3 : 1
          return (
            <Sucked
              key={`e${k}`}
              x={110 + random(`ex${k}`) * 860}
              y={240 + random(`ey${k}`) * 1450}
              i={70 + k}
              rot={(random(`er${k}`) - 0.5) * 30}
              scale={ci(fc, a, a + 6, 0.4, 1, outE)}
              opacity={flick}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 30,
                  color: '#fca5a5',
                  padding: '8px 16px',
                  border: '2px solid rgba(239,68,68,0.6)',
                  background: 'rgba(239,68,68,0.1)',
                }}
              >
                {['#REF!', '#N/A', '???', '#VALUE!', '#DIV/0!', '#REF!', '???', '#N/A', '错误', '#NAME?'][k]}
              </div>
            </Sucked>
          )
        })}
        {T.bubbles.map((a, k) => {
          if (fc < a) return null
          const pop = spring({ frame: fc - a, fps, config: { damping: 12, stiffness: 260, mass: 0.6 } })
          const name = NAMES[k % NAMES.length]
          const hue = (k * 47) % 360
          if (k < ORD) {
            const side = k % 2 ? 'right' : 'left'
            const y = 1590 + 128 * (k + 1 - scroll)
            if (y < -120) return null
            return (
              <Sucked
                key={k}
                x={side === 'left' ? 56 : 1024}
                y={y}
                i={k}
                anchor={side}
                scale={0.6 + 0.4 * pop}
                opacity={Math.min(1, pop * 2)}
              >
                <Bubble text={MSGS[k]} name={name} side={side} hue={hue} />
              </Sucked>
            )
          }
          return (
            <Sucked
              key={k}
              x={140 + random(`bx${k}`) * 800}
              y={220 + random(`by${k}`) * 1420}
              i={k}
              rot={(random(`br${k}`) - 0.5) * 26}
              scale={(0.95 + random(`bs${k}`) * 0.45) * pop}
              opacity={Math.min(1, pop * 2)}
            >
              <Bubble text={MSGS[k]} name={name} side={k % 2 ? 'right' : 'left'} hue={hue} />
            </Sucked>
          )
        })}
        {T.badges.map((a, k) => {
          if (fc < a) return null
          const pop = spring({ frame: fc - a, fps, config: { damping: 8, stiffness: 300, mass: 0.5 } })
          return (
            <Sucked
              key={`b${k}`}
              x={150 + random(`gx${k}`) * 780}
              y={260 + random(`gy${k}`) * 1380}
              i={40 + k}
              rot={Math.sin((fc + k * 10) / 3) * 8}
              scale={pop}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  background: C.red,
                  color: '#fff',
                  fontFamily: LATIN,
                  fontWeight: 700,
                  fontSize: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(239,68,68,0.6)',
                  border: '4px solid #0c0e12',
                }}
              >
                99+
              </div>
            </Sucked>
          )
        })}
        <ChaosCaption text="群聊刷屏" at={P.chaos[0]} end={P.chaos[1]} mode="echo" fc={fc} />
        <ChaosCaption text="表格散乱" at={P.chaos[1]} end={P.chaos[2]} mode="messy" fc={fc} />
        <ChaosCaption text="新人无从下手" at={P.chaos[2]} end={9999} mode="lost" fc={fc} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// 冻结波纹、速度线与奇点
const FreezeFx = () => {
  const f = useCurrentFrame()
  if (f < T.freeze || f >= T.impact + 2) return null
  const core = f < 292 ? ci(f, T.suck[0], 292, 0, 150, Easing.in(Easing.quad)) : ci(f, 292, 299, 150, 6, inE)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: '#f8ecd0', opacity: ci(f, T.freeze, T.freeze + 4, 0.45, 0) }} />
      <Ring at={T.freeze} x={CX} y={CY} life={34} from={20} to={1400} width={5} color="245,230,196" />
      {Array.from({ length: 40 }, (_, k) => {
        const a = (k / 40) * Math.PI * 2 + random(`sa${k}`) * 0.2
        const r = ci(f, T.suck[0] + (k % 7), T.suck[1], 1300, 0, inE)
        const op = ci(f, T.suck[0], T.suck[0] + 8) * (1 - ci(f, 290, 296))
        const len = 140 + random(`sl${k}`) * 260
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: CX + Math.cos(a) * r,
              top: CY + Math.sin(a) * r,
              width: len,
              height: 3,
              transformOrigin: '0 50%',
              transform: `rotate(${(a * 180) / Math.PI}deg)`,
              background: 'linear-gradient(90deg, rgba(250,236,200,0.9), transparent)',
              opacity: op,
            }}
          />
        )
      })}
      <div
        style={{
          position: 'absolute',
          left: CX - core / 2,
          top: CY - core / 2,
          width: core,
          height: core,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffffff 0%, #f3dfae 35%, rgba(212,169,79,0.6) 60%, transparent 72%)',
          boxShadow: `0 0 ${core}px ${core / 3}px rgba(212,169,79,0.6)`,
        }}
      />
    </AbsoluteFill>
  )
}

// ───────────── 品牌世界 ─────────────

const BrandWorld = () => {
  const f = useCurrentFrame()
  if (f < T.impact) return null
  const r = ci(f, T.impact, T.impact + 40, 0, 1600, outE)
  return (
    <AbsoluteFill
      style={{
        clipPath: `circle(${r}px at ${CX}px ${CY}px)`,
        background: 'radial-gradient(120% 70% at 50% 35%, #211a0e 0%, #0b0a08 55%, #030303 100%)',
      }}
    >
      {[0, 1, 2].map((k) => (
        <div
          key={k}
          style={{
            position: 'absolute',
            left: 540 + Math.sin(f / 90 + k * 2.1) * 320 - 450,
            top: 300 + k * 560 + Math.cos(f / 110 + k) * 220 - 450,
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: ['rgba(196,148,60,0.26)', 'rgba(150,100,30,0.2)', 'rgba(255,214,140,0.1)'][k],
            filter: 'blur(110px)',
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(232,199,122,0.35) 1.8px, transparent 2.2px)',
          backgroundSize: '48px 48px',
          backgroundPosition: `0 ${-f * 0.4}px`,
          opacity: 0.45,
        }}
      />
    </AbsoluteFill>
  )
}

const LogoTravel = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < T.impact || f > 716) return null
  const pop = spring({ frame: f - T.impact, fps, config: { damping: 11, stiffness: 140, mass: 0.7 } })
  const m = ci(f, T.header[0], T.header[1], 0, 1, inOut)
  const x = CX + (HX - CX) * m
  const y = CY + (HY - CY) * m
  const scale = pop * (1 - m * (1 - 84 / 300))
  const fade = 1 - ci(f, 700, 716)
  const word = ci(f, T.header[1] - 8, T.header[1] + 14, 0, 1, outE) * fade
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: `translate(-50%,-50%) rotate(${(1 - pop) * -25}deg) scale(${scale})`,
          opacity: fade,
        }}
      >
        <BrandIcon
          size={300}
          arc={ci(f, 304, 328, 0, 1, inOut)}
          ell={ci(f, 318, 342, 0, 1, inOut)}
          d1={spring({ frame: Math.max(0, f - 338), fps, config: { damping: 9, stiffness: 180 } })}
          d2={spring({ frame: Math.max(0, f - 344), fps, config: { damping: 9, stiffness: 180 } })}
          sweep={ci(f, 344, 362, -1.3, 1.3)}
        />
      </div>
      {word > 0 && (
        <div
          style={{
            position: 'absolute',
            left: HX + 60,
            top: HY,
            transform: `translateY(-50%) translateX(${(1 - word) * -24}px)`,
            clipPath: `inset(0 ${100 - word * 100}% 0 0)`,
            fontFamily: LATIN,
            fontWeight: 700,
            fontSize: 52,
            letterSpacing: -1.5,
            color: '#f6efe2',
            opacity: fade,
          }}
        >
          OpenLIMS
        </div>
      )}
    </>
  )
}

const ImpactFx = () => {
  const f = useCurrentFrame()
  if (f < T.impact || f > T.impact + 60) return null
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff6e0', opacity: ci(f, T.impact, T.impact + 10, 0.9, 0, outE) }} />
      <Ring at={T.impact} x={CX} y={CY} life={40} from={150} to={950} width={10} />
      <Ring at={T.impact + 5} x={CX} y={CY} life={48} from={150} to={1300} width={5} color="232,199,122" />
      <Burst at={T.impact} x={CX} y={CY} n={60} k="imp" spread={[350, 1200]} life={56} />
    </AbsoluteFill>
  )
}

// ───────────── 第二幕：每一份努力，都被看见 ─────────────

const HEAT = ['#3a2c12', '#a67c2e', '#c0923e', '#d4a94f', '#f3d48a']
const COLS = 10
const ROWS = 16
const SCORES = [
  { x: 250, y: 640, t: 384, v: '+20' },
  { x: 820, y: 520, t: 394, v: '+50' },
  { x: 720, y: 900, t: 404, v: '+10' },
  { x: 290, y: 1030, t: 414, v: '+30' },
  { x: 860, y: 1160, t: 426, v: '+20' },
  { x: 520, y: 760, t: 436, v: '+15' },
]

const whipE = (f) => ci(f, T.whip[0], T.whip[1], 0, 1, inOut)

const SeenScene = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < 352 || f > T.whip[1]) return null
  const e = whipE(f)
  const rx = ci(f, 352, 484, 64, 42, outE)
  const rz = ci(f, 352, 484, -20, -8)
  const sc = ci(f, 352, 484, 1.5, 1.05, outE)
  const enter = ci(f, 352, 372)
  return (
    <AbsoluteFill
      style={{
        transform: `translateY(${-1920 * e}px)`,
        filter: e > 0 ? `blur(${Math.sin(e * Math.PI) * 16}px)` : undefined,
        opacity: enter,
      }}
    >
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: '50% 35%' }}>
        <div
          style={{
            position: 'absolute',
            left: 540,
            top: 880,
            transform: `translate(-50%,-50%) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${sc})`,
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, 84px)`,
            gap: 12,
          }}
        >
          {Array.from({ length: COLS * ROWS }, (_, k) => {
            const c = k % COLS
            const r = Math.floor(k / COLS)
            const dist = Math.hypot(c - 4.5, r - 7.5)
            const a = 366 + dist * 2.6
            const lit = ci(f, a, a + 10, 0, 1, outE)
            const a2 = P.seen[1] + dist * 1.3
            const flash =
              ci(f, a, a + 3) * (1 - ci(f, a + 3, a + 14)) + ci(f, a2, a2 + 3) * (1 - ci(f, a2 + 3, a2 + 20)) * 0.75
            const level = Math.floor(random(`lv${k}`) * 5)
            return (
              <div
                key={k}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 14,
                  position: 'relative',
                  background: 'rgba(232,199,122,0.06)',
                  border: '1px solid rgba(232,199,122,0.08)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 14,
                    background: HEAT[level],
                    opacity: lit * (0.35 + level * 0.16),
                    boxShadow: level >= 3 ? `0 0 ${24 * lit}px rgba(232,180,90,0.6)` : undefined,
                  }}
                />
                {flash > 0.01 && (
                  <div
                    style={{ position: 'absolute', inset: 0, borderRadius: 14, background: '#fff', opacity: flash }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      {SCORES.map((s, k) => {
        const t = f - s.t
        if (t < 0 || t > 44) return null
        const pop = spring({ frame: t, fps, config: { damping: 10, stiffness: 220 } })
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y - outE(t / 44) * 90,
              transform: `translate(-50%,-50%) scale(${pop})`,
              opacity: 1 - ci(t, 30, 44),
              fontFamily: FONT,
              fontSize: 34,
              fontWeight: 600,
              color: '#140f06',
              padding: '10px 22px',
              borderRadius: 999,
              background: 'linear-gradient(135deg,#f3d48a,#c0923e)',
              boxShadow: '0 12px 30px rgba(166,124,46,0.55)',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontFamily: LATIN, fontWeight: 700 }}>{s.v}</span> 积分
          </div>
        )
      })}
      <AbsoluteFill
        style={{ background: 'linear-gradient(180deg, transparent 52%, rgba(5,4,3,0.88) 70%, rgba(5,4,3,0.96) 100%)' }}
      />
      <CharRise text="每一份努力" at={P.seen[0]} y={1390} size={64} />
      <Headline text="都被看见" at={P.seen[1]} y={1530} size={168} />
      <Caption text="积分账本 · 贡献热力图 · 公开主页" at={P.seen[1] + 16} y={1660} />
    </AbsoluteFill>
  )
}

// ───────────── 第三幕：每一位新人，都有路可走 ─────────────

const PATH_D =
  'M540 2450 C940 2330 940 2070 540 1950 C140 1830 140 1570 540 1450 C940 1330 940 1070 540 950 C140 830 140 570 540 450'
const PATH_LEN = getLength(PATH_D)
const NODE_FR = [0, 0.25, 0.5, 0.75, 1]
const STEPS = ['报名', '初筛', '面试', '技能测试', '正式成员']
const DOT_Y = 1120

const pathProgress = (frame) => {
  const nf = T.pathNodes
  if (frame <= nf[0]) return 0
  for (let i = 0; i < nf.length - 1; i++) {
    if (frame < nf[i + 1])
      return NODE_FR[i] + (NODE_FR[i + 1] - NODE_FR[i]) * inOut((frame - nf[i]) / (nf[i + 1] - nf[i]))
  }
  return 1
}
const pt = (p) => getPointAtLength(PATH_D, PATH_LEN * Math.min(1, Math.max(0, p)))

const PathScene = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < T.whip[0] || f > T.iris[1]) return null
  const e = whipE(f)
  const p = pathProgress(f)
  const dot = pt(p)
  const off = DOT_Y - dot.y
  const ev = evolvePath(p, PATH_D)
  const dotPop = spring({ frame: Math.max(0, f - T.whip[1] + 4), fps, config: { damping: 10, stiffness: 180 } })
  return (
    <AbsoluteFill
      style={{
        transform: `translateY(${1920 * (1 - e)}px)`,
        filter: e < 1 ? `blur(${Math.sin(e * Math.PI) * 16}px)` : undefined,
        background: 'radial-gradient(120% 70% at 50% 60%, #1c160c 0%, #0b0a08 55%, #030303 100%)',
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(232,199,122,0.3) 1.8px, transparent 2.2px)',
          backgroundSize: '48px 48px',
          backgroundPosition: `0 ${off * 0.3}px`,
          opacity: 0.4,
        }}
      />
      <div
        style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 2600, transform: `translateY(${off}px)` }}
      >
        <svg width={1080} height={2600} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="pg" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#a67c2e" />
              <stop offset="1" stopColor="#f3dfae" />
            </linearGradient>
          </defs>
          <path
            d={PATH_D}
            fill="none"
            stroke="rgba(232,199,122,0.22)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray="2 24"
          />
          <path
            d={PATH_D}
            fill="none"
            stroke="#d4a94f"
            strokeWidth={34}
            strokeLinecap="round"
            opacity={0.28}
            style={{ filter: 'blur(10px)' }}
            strokeDasharray={ev.strokeDasharray}
            strokeDashoffset={ev.strokeDashoffset}
          />
          <path
            d={PATH_D}
            fill="none"
            stroke="url(#pg)"
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray={ev.strokeDasharray}
            strokeDashoffset={ev.strokeDashoffset}
          />
          {NODE_FR.map((nfr, i) => {
            const n = pt(nfr)
            const at = T.pathNodes[i]
            const act = f >= at ? spring({ frame: f - at, fps, config: { damping: 9, stiffness: 200 } }) : 0
            const big = i === 4
            const r = big ? 46 : 28
            const ring = ci(f, at, at + 26, 0, 1, outE)
            return (
              <g key={i}>
                {f >= at && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r + ring * (big ? 140 : 80)}
                    fill="none"
                    stroke="#e8c77a"
                    strokeWidth={4 * (1 - ring) + 0.5}
                    opacity={1 - ring}
                  />
                )}
                <circle cx={n.x} cy={n.y} r={r} fill="#15110a" stroke="rgba(232,199,122,0.45)" strokeWidth={4} />
                <circle cx={n.x} cy={n.y} r={r * Math.min(act, 1.15)} fill={big ? '#d4a94f' : '#c0923e'} />
                {big && act > 0 && (
                  <path
                    d={`M${n.x - 18} ${n.y} l12 13 l24 -26`}
                    fill="none"
                    stroke="#140f06"
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    strokeDasharray="1 1"
                    strokeDashoffset={1 - ci(f, at + 4, at + 16)}
                  />
                )}
              </g>
            )
          })}
        </svg>
        {NODE_FR.map((nfr, i) => {
          const n = pt(nfr)
          const at = T.pathNodes[i]
          const act = f >= at ? spring({ frame: f - at, fps, config: { damping: 11, stiffness: 220 } }) : 0
          const left = i % 2 === 0
          const big = i === 4
          const near = i === 0 ? 1 : ci(pathProgress(f), nfr - 0.3, nfr - 0.1)
          if (near <= 0) return null
          return (
            <div
              key={i}
              style={{
                opacity: near,
                position: 'absolute',
                left: n.x + (left ? -(big ? 80 : 62) : big ? 80 : 62),
                top: n.y,
                transform: `translate(${left ? '-100%' : '0'},-50%) scale(${0.85 + 0.15 * Math.min(act, 1.2)})`,
                transformOrigin: left ? '100% 50%' : '0 50%',
                fontFamily: FONT,
                fontSize: big ? 46 : 36,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                padding: big ? '14px 30px' : '10px 24px',
                borderRadius: 999,
                color: act > 0 ? (big ? '#140f06' : '#fff7e3') : C.muted,
                background:
                  act > 0
                    ? big
                      ? 'linear-gradient(135deg,#f3d48a,#c0923e)'
                      : 'rgba(212,169,79,0.26)'
                    : 'rgba(20,16,9,0.8)',
                border: `2px solid ${act > 0 ? 'rgba(232,199,122,0.8)' : 'rgba(232,199,122,0.2)'}`,
                boxShadow: act > 0 && big ? '0 0 50px rgba(212,169,79,0.7)' : undefined,
              }}
            >
              {STEPS[i]}
            </div>
          )
        })}
        {Array.from({ length: 12 }, (_, k) => {
          const q = pt(pathProgress(f - (k + 1) * 1.3))
          const s = 34 * (1 - k / 12)
          return (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: q.x - s / 2,
                top: q.y - s / 2,
                width: s,
                height: s,
                borderRadius: '50%',
                background: '#e8c77a',
                opacity: (1 - k / 12) * 0.35 * dotPop,
              }}
            />
          )
        })}
        <div
          style={{
            position: 'absolute',
            left: dot.x,
            top: dot.y,
            transform: `translate(-50%,-50%) scale(${dotPop})`,
            width: 72,
            height: 72,
            borderRadius: 36,
            background: '#fff',
            boxShadow: '0 0 40px 10px rgba(232,199,122,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={40}
            height={40}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a67c2e"
            strokeWidth={2.6}
            strokeLinecap="round"
          >
            <circle cx={12} cy={8} r={4} />
            <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
          </svg>
        </div>
      </div>
      <Burst
        at={T.pathNodes[4]}
        x={CX}
        y={DOT_Y}
        n={36}
        k="grad"
        spread={[200, 620]}
        life={40}
        size={[6, 14]}
        colors={['#ffffff', C.accent, C.amber]}
      />
      <AbsoluteFill
        style={{ background: 'linear-gradient(180deg, rgba(5,4,3,0.97) 0%, rgba(5,4,3,0.9) 26%, transparent 40%)' }}
      />
      <CharRise text="每一位新人" at={P.path[0]} y={330} size={64} />
      <Headline text="都有路可走" at={P.path[1]} y={462} size={148} />
      <Caption text="共享新手任务 · 审核通过即转正" at={P.path[1] + 14} y={570} />
    </AbsoluteFill>
  )
}

// ───────────── 第四幕：每一届积累，都能传承 ─────────────

const ISO_X = 540
const ISO_Y = 1330
const SLAB = 400
const THICK = 46
const STEP = 66
const YEARS = ['2023 届', '2024 届', '2025 届', '2026 届']
const TOP = ['#2a2113', '#4a3818', '#7a5a22', '#a87d33']
const iso = (x, y, z) => [ISO_X + (x - y) * 0.866, ISO_Y + (x + y) * 0.5 - z]
const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

const Slab = ({ i, z, opacity, glow }) => {
  const h = SLAB / 2
  const A = (zz) => iso(-h, -h, zz)
  const B = (zz) => iso(h, -h, zz)
  const Cc = (zz) => iso(h, h, zz)
  const D = (zz) => iso(-h, h, zz)
  return (
    <g opacity={opacity}>
      <polygon
        points={poly([D(z), Cc(z), Cc(z - THICK), D(z - THICK)])}
        fill="#17120a"
        stroke="rgba(232,199,122,0.35)"
        strokeWidth={1.5}
      />
      <polygon
        points={poly([B(z), Cc(z), Cc(z - THICK), B(z - THICK)])}
        fill="#0d0a06"
        stroke="rgba(232,199,122,0.35)"
        strokeWidth={1.5}
      />
      <g transform={`matrix(0.866 0.5 -0.866 0.5 ${ISO_X} ${ISO_Y - z})`}>
        <rect
          x={-h}
          y={-h}
          width={SLAB}
          height={SLAB}
          rx={22}
          fill={TOP[i]}
          stroke="rgba(248,226,170,0.7)"
          strokeWidth={2.5}
        />
        <rect x={-h} y={-h} width={SLAB} height={SLAB} rx={22} fill="#fff" opacity={glow} />
        <text x={0} y={-10} textAnchor="middle" fontFamily={FONT} fontSize={74} fontWeight={600} fill="#fff">
          {YEARS[i]}
        </text>
        <text x={0} y={62} textAnchor="middle" fontFamily={FONT} fontSize={32} fill="#f3dfae">
          {['项目 · 文档', '成果 · 证书', '任务 · 讨论', '新成员 · 新项目'][i]}
        </text>
      </g>
    </g>
  )
}

const LegacyScene = () => {
  const f = useCurrentFrame()
  if (f < T.iris[0] || f > 724) return null
  const r = ci(f, T.iris[0], T.iris[1], 0, 1900, Easing.in(Easing.quad))
  const push = 1 + ci(f, 700, 720, 0, 0.9, inE)
  const sc = ci(f, 600, 700, 1, 1.06) * push
  const beam = ci(f, T.beam, T.beam + 16, 0, 1, outE)
  const topZ = 3 * STEP
  return (
    <AbsoluteFill
      style={{
        clipPath: `circle(${r}px at ${CX}px ${DOT_Y}px)`,
        background: 'radial-gradient(120% 70% at 50% 60%, #1c160c 0%, #0b0a08 55%, #030303 100%)',
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(232,199,122,0.3) 1.8px, transparent 2.2px)',
          backgroundSize: '48px 48px',
          opacity: 0.4,
        }}
      />
      <AbsoluteFill
        style={{
          transform: `scale(${sc})`,
          transformOrigin: `${ISO_X}px ${ISO_Y - 200}px`,
          filter: `brightness(${1 + ci(f, 704, 720, 0, 1.6)})`,
        }}
      >
        {beam > 0 && (
          <div
            style={{
              position: 'absolute',
              left: ISO_X - 180 * beam,
              top: -200,
              width: 360 * beam,
              height: ISO_Y + 200,
              background: 'linear-gradient(90deg, transparent, rgba(232,180,90,0.35), transparent)',
              filter: 'blur(20px)',
            }}
          />
        )}
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {T.slabs.map((L, i) => {
            if (f < L - 18) return null
            const fall = ci(f, L - 16, L, 1, 0, Easing.in(Easing.quad))
            const bounce = f >= L ? 16 * Math.exp(-(f - L) / 5) * Math.sin((f - L) / 1.8) : 0
            const z = i * STEP + 1300 * fall + bounce
            const dust = ci(f, L, L + 22, 0, 1, outE)
            const [ex, ey] = iso(0, 0, i * STEP - THICK)
            return (
              <g key={i}>
                {f >= L && dust < 1 && (
                  <ellipse
                    cx={ex}
                    cy={ey}
                    rx={260 + dust * 300}
                    ry={(260 + dust * 300) * 0.5}
                    fill="none"
                    stroke="#e8c77a"
                    strokeWidth={4 * (1 - dust)}
                    opacity={1 - dust}
                  />
                )}
                <Slab
                  i={i}
                  z={z}
                  opacity={ci(f, L - 16, L - 10)}
                  glow={i === 3 ? beam * 0.25 * (0.6 + 0.4 * Math.sin(f / 3)) : 0}
                />
              </g>
            )
          })}
        </svg>
        {beam > 0 && (
          <>
            <div
              style={{
                position: 'absolute',
                left: ISO_X - 10 * beam,
                top: -200,
                width: 20 * beam,
                height: ISO_Y - topZ,
                background: 'linear-gradient(0deg, #ffffff, rgba(248,226,170,0.9) 60%, rgba(248,226,170,0))',
                boxShadow: '0 0 40px 12px rgba(232,180,90,0.6)',
              }}
            />
            {Array.from({ length: 26 }, (_, k) => {
              const sp = 18 + random(`bp${k}`) * 22
              const y = ISO_Y - topZ - (((f - T.beam) * sp + random(`by${k}`) * 1400) % 1400)
              const x = ISO_X + (random(`bx${k}`) - 0.5) * 160 * beam
              const s = 5 + random(`bs${k}`) * 9
              return (
                <div
                  key={k}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: s,
                    height: s,
                    borderRadius: '50%',
                    background: '#f8ecd0',
                    boxShadow: '0 0 12px #e8c77a',
                    opacity: beam * 0.9,
                  }}
                />
              )
            })}
          </>
        )}
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: 'linear-gradient(180deg, rgba(5,4,3,0.97) 0%, rgba(5,4,3,0.9) 26%, transparent 40%)' }}
      />
      <CharRise text="每一届积累" at={P.legacy[0]} y={330} size={64} />
      <Headline text="都能传承" at={P.legacy[1]} y={462} size={168} />
      <Caption text="项目、成果与经验，留在实验室" at={P.legacy[1] + 14} y={570} />
      <AbsoluteFill style={{ background: '#fff', opacity: ci(f, 708, 720, 0, 1, inE) }} />
    </AbsoluteFill>
  )
}

// ───────────── 收尾：为每一个实验室而开源 ─────────────

const GITHUB =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'

const Outro = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < T.outroImpact - 4) return null
  const pop = spring({
    frame: Math.max(0, f - (T.outroImpact + 2)),
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  })
  const bt = f - T.button
  const punch = bt >= 0 ? 1 + 0.035 * Math.exp(-bt / 7) * Math.cos(bt / 2.4) : 1
  const sweep = ci(f, T.button + 2, T.button + 28, -1.3, 1.3)
  const values = ['被看见', '有路走', '能传承']
  return (
    <AbsoluteFill>
      {Array.from({ length: 60 }, (_, k) => {
        const sp = 0.6 + random(`ps${k}`) * 1.8
        const y = ((random(`py${k}`) * 2100 - (f - T.outroImpact) * sp + 2100) % 2100) - 90
        const s = 3 + random(`pz${k}`) * 6
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(f / (10 + (k % 7)) + k))
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: random(`px${k}`) * 1080,
              top: y,
              width: s,
              height: s,
              borderRadius: '50%',
              background: '#f3dfae',
              opacity: tw * 0.55 * ci(f, T.outroImpact, T.outroImpact + 30),
            }}
          />
        )
      })}
      <AbsoluteFill style={{ transform: `scale(${punch})`, transformOrigin: '540px 920px' }}>
        <Ring at={T.outroImpact + 2} x={CX} y={680} life={44} from={120} to={1000} width={8} />
        <Ring at={T.button} x={CX} y={680} life={40} from={130} to={700} width={6} color="232,199,122" />
        <Burst at={T.button} x={CX} y={680} n={30} k="btn" spread={[160, 560]} life={44} size={[5, 12]} />
        <div
          style={{
            position: 'absolute',
            left: CX,
            top: 680,
            transform: `translate(-50%,-50%) rotate(${(1 - pop) * -40}deg) scale(${pop})`,
          }}
        >
          <BrandIcon size={240} sweep={sweep} glow={1.2} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 900,
            transform: 'translateY(-50%)',
            display: 'flex',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '20px 0',
            fontFamily: LATIN,
            fontWeight: 700,
            fontSize: 160,
            letterSpacing: -5,
            color: '#fff',
          }}
        >
          {'OpenLIMS'.split('').map((ch, i) => {
            const p = ci(f, P.outro[0] + 6 + i * 3, P.outro[0] + 6 + i * 3 + 22, 0, 1, outE)
            const g = Math.exp(-Math.pow(f - (T.button + 4 + i * 2.5), 2) / 40)
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  transform: `translateY(${(1 - p) * 120}%)`,
                  filter: `blur(${(1 - p) * 8}px)`,
                  color: g > 0.02 ? `rgb(255,${255 - 22 * g},${255 - 90 * g})` : '#fbf4e4',
                  textShadow: g > 0.02 ? `0 0 ${50 * g}px rgba(232,199,122,${g})` : undefined,
                }}
              >
                {ch}
              </span>
            )
          })}
        </div>
        <CharRise
          text="为每一个实验室而开源"
          at={P.outro[1]}
          y={1070}
          size={72}
          color={C.ink}
          weight={600}
          stagger={2}
          spacing={6}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 1188,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 22,
            fontFamily: FONT,
          }}
        >
          {values.map((v, i) => {
            const p = spring({
              frame: Math.max(0, f - (P.outro[1] + 14 + i * 5)),
              fps,
              config: { damping: 11, stiffness: 200 },
            })
            return (
              <div
                key={v}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  opacity: f >= P.outro[1] + 14 + i * 5 ? 1 : 0,
                }}
              >
                {i > 0 && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.accent, opacity: 0.6 }} />}
                <div
                  style={{
                    transform: `scale(${p})`,
                    fontSize: 36,
                    fontWeight: 600,
                    color: C.accent,
                    padding: '10px 26px',
                    borderRadius: 999,
                    border: '1.5px solid rgba(232,199,122,0.45)',
                    background: 'rgba(166,124,46,0.22)',
                  }}
                >
                  {v}
                </div>
              </div>
            )
          })}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 540 - ci(f, P.outro[1] + 22, P.outro[1] + 52, 0, 290, outE),
            top: 1286,
            width: ci(f, P.outro[1] + 22, P.outro[1] + 52, 0, 580, outE),
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(232,199,122,0.8), transparent)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 1370,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 18,
            fontFamily: MONO,
            fontSize: 34,
            color: C.ink,
            opacity: ci(f, P.outro[1] + 26, P.outro[1] + 46, 0, 1),
            transform: `translateY(${(1 - ci(f, P.outro[1] + 26, P.outro[1] + 46, 0, 1, outE)) * 30}px)`,
          }}
        >
          <svg width={44} height={44} viewBox="0 0 16 16">
            <path d={GITHUB} fill="#fff" />
          </svg>
          github.com/YESlab-UAVtech/OpenLIMS
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 1456,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
            fontFamily: FONT,
            opacity: ci(f, P.outro[1] + 34, P.outro[1] + 54, 0, 1),
            transform: `translateY(${(1 - ci(f, P.outro[1] + 34, P.outro[1] + 54, 0, 1, outE)) * 30}px)`,
          }}
        >
          <span
            style={{
              fontFamily: LATIN,
              fontSize: 28,
              fontWeight: 700,
              color: C.navy,
              background: C.accent,
              borderRadius: 10,
              padding: '6px 18px',
            }}
          >
            MIT
          </span>
          <span style={{ fontSize: 30, fontWeight: 500, color: C.muted }}>开源免费 · 欢迎 Star 与贡献</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff', opacity: ci(f, T.outroImpact, T.outroImpact + 22, 1, 0) }} />
    </AbsoluteFill>
  )
}

// ───────────── 声音 ─────────────

const bgmVolume = (frame) => {
  const t = frame / T.fps
  let d = 0
  for (const v of T.vo) {
    const a = v.at - 0.06
    const b = v.at + v.dur + 0.04
    const w = t < a ? Math.max(0, 1 - (a - t) / 0.12) : t > b ? Math.max(0, 1 - (t - b) / 0.25) : 1
    d = Math.max(d, w)
  }
  return 0.5 * (1 - 0.5 * d)
}

export const Showreel = () => (
  <AbsoluteFill style={{ backgroundColor: '#030303', overflow: 'hidden' }}>
    <Audio src={staticFile('bgm.wav')} volume={bgmVolume} />
    {T.vo.map((v) => (
      <Sequence key={v.file} from={Math.round(v.at * T.fps)} layout="none">
        <Audio src={staticFile(v.file)} volume={1} />
      </Sequence>
    ))}
    <Chaos />
    <FreezeFx />
    <BrandWorld />
    <SeenScene />
    <PathScene />
    <LegacyScene />
    <Outro />
    <LogoTravel />
    <ImpactFx />
    <Grain />
  </AbsoluteFill>
)
