import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion'

// 时间轴（60fps，共 780 帧 = 13 秒）
// 0–80 点阵与扫描线；50–230 界面碎片飞入；285–373 碎片向中心汇聚；
// 368–475 图标弹出并描绘 Logo；470–540 字标；540–680 标语与模块；670–720 仓库地址；其后定格。

const FONT = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif'
const C = {
  bg: '#0b1423',
  ink: '#e6eefb',
  muted: '#9fb3cf',
  accent: '#93c5fd',
  fill: '#1d4ed8',
  brand: '#2563eb',
  amber: '#fbbf24',
}
const CENTER = { x: 540, y: 560 }
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
const ease = Easing.bezier(0.22, 1, 0.36, 1)

const card = {
  background: 'linear-gradient(180deg, rgba(24,41,66,0.94), rgba(14,25,42,0.94))',
  border: '1.5px solid rgba(147,197,253,0.28)',
  borderRadius: 28,
  boxShadow: '0 30px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
  color: C.ink,
  fontFamily: FONT,
  padding: '26px 30px',
}

const Icon = ({ d, color = C.accent, size = 30, fill = 'none' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={fill === 'none' ? color : 'none'}
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} fill={fill === 'none' ? 'none' : color} />
  </svg>
)
const ICON = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  star: 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z',
  chat: 'M4 5h16v11H9l-5 4z',
  coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9 8l3 4 3-4M12 12v5M9.5 13h5',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0',
}

const Badge = ({ children, bg = 'rgba(29,78,216,0.9)', size = 56 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 16,
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    {children}
  </div>
)

const Tag = ({ children, color = C.accent }) => (
  <span
    style={{
      fontSize: 22,
      fontWeight: 600,
      color,
      border: `1.5px solid ${color}55`,
      background: `${color}14`,
      borderRadius: 999,
      padding: '4px 14px',
    }}
  >
    {children}
  </span>
)

// ───────────── 界面碎片 ─────────────

const TaskCard = ({ t }) => {
  const p = interpolate(t, [20, 110], [0.2, 0.8], { ...clamp, easing: ease })
  return (
    <div style={{ ...card, width: 440 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Badge>
          <Icon d={ICON.check} color="#fff" />
        </Badge>
        <div style={{ fontSize: 34, fontWeight: 700, flex: 1 }}>新手任务</div>
        <Tag>进行中</Tag>
      </div>
      <div
        style={{ marginTop: 24, height: 14, borderRadius: 7, background: 'rgba(147,197,253,0.15)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${p * 100}%`,
            height: '100%',
            borderRadius: 7,
            background: 'linear-gradient(90deg,#1d4ed8,#93c5fd)',
          }}
        />
      </div>
      <div style={{ marginTop: 14, fontSize: 25, color: C.muted }}>子任务 {Math.round(p * 5)} / 5</div>
    </div>
  )
}

const HEAT = ['rgba(147,197,253,0.10)', '#1e3a5f', '#1d4ed8', '#3b82f6', '#93c5fd']
const Heatmap = ({ t }) => (
  <div style={{ ...card, width: 380 }}>
    <div style={{ fontSize: 25, color: C.muted, marginBottom: 16 }}>积分热力图</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 26px)', gap: 6 }}>
      {Array.from({ length: 50 }, (_, k) => {
        const col = k % 10
        const o = interpolate(t, [8 + col * 3, 20 + col * 3], [0, 1], clamp)
        return (
          <div
            key={k}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: HEAT[Math.floor(random(`heat-${k}`) * 5)],
              opacity: o,
            }}
          />
        )
      })}
    </div>
  </div>
)

const PointsPill = ({ t }) => {
  const n = Math.round(interpolate(t, [10, 60], [0, 20], { ...clamp, easing: ease }))
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '18px 30px',
        borderRadius: 999,
        background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
        boxShadow: '0 20px 40px rgba(29,78,216,0.45)',
        fontFamily: FONT,
        color: '#fff',
      }}
    >
      <Icon d={ICON.coin} color="#fff" size={36} />
      <span style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>+{n}</span>
      <span style={{ fontSize: 30, fontWeight: 600 }}>积分</span>
    </div>
  )
}

const Discussion = () => (
  <div style={{ ...card, width: 400, borderRadius: '28px 28px 28px 8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon d={ICON.chat} />
      <Tag color={C.amber}>置顶</Tag>
    </div>
    <div style={{ marginTop: 14, fontSize: 31, fontWeight: 700 }}>本周组会安排</div>
    <div style={{ marginTop: 8, fontSize: 24, color: C.muted }}>12 条回复 · 28 人点赞</div>
  </div>
)

const ProjectCard = ({ t }) => {
  const p = interpolate(t, [15, 100], [0, 0.68], { ...clamp, easing: ease })
  const r = 38
  const len = 2 * Math.PI * r
  return (
    <div style={{ ...card, width: 430, display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ flex: 1 }}>
        <Tag>项目</Tag>
        <div style={{ marginTop: 14, fontSize: 31, fontWeight: 700 }}>无人机视觉定位</div>
        <div style={{ marginTop: 8, fontSize: 24, color: C.muted }}>团队 6 人 · 导师 1 人</div>
      </div>
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <svg width={96} height={96} viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={48} cy={48} r={r} stroke="rgba(147,197,253,0.15)" strokeWidth={9} fill="none" />
          <circle
            cx={48}
            cy={48}
            r={r}
            stroke={C.accent}
            strokeWidth={9}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - p)}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          {Math.round(p * 100)}%
        </div>
      </div>
    </div>
  )
}

const FundCard = ({ t }) => {
  const draw = interpolate(t, [15, 90], [0, 1], { ...clamp, easing: ease })
  return (
    <div style={{ ...card, width: 380 }}>
      <div style={{ fontSize: 25, color: C.muted }}>实验室基金</div>
      <div style={{ marginTop: 6, fontSize: 44, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>¥ 12,800.00</div>
      <svg width={316} height={60} viewBox="0 0 316 60" style={{ marginTop: 10 }}>
        <polyline
          points="0,48 40,40 80,44 120,28 160,32 200,18 240,24 280,10 316,14"
          fill="none"
          stroke={C.accent}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
      </svg>
    </div>
  )
}

const BountyCard = ({ t }) => {
  const done = Math.floor(interpolate(t, [25, 115], [0, 3.99], clamp))
  return (
    <div style={{ ...card, width: 400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Badge bg="rgba(251,191,36,0.16)">
          <Icon d={ICON.star} color={C.amber} fill="solid" />
        </Badge>
        <div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>悬赏任务</div>
          <div style={{ fontSize: 23, color: C.muted, marginTop: 4 }}>前 3 名完成可得奖金</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        {[0, 1, 2].map((k) => (
          <div
            key={k}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              border: `2px solid ${k < done ? C.amber : 'rgba(147,197,253,0.3)'}`,
              background: k < done ? 'rgba(251,191,36,0.18)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {k < done ? (
              <Icon d={ICON.check} color={C.amber} size={26} />
            ) : (
              <span style={{ fontSize: 22, color: C.muted }}>{k + 1}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const MemberCard = () => (
  <div
    style={{
      ...card,
      width: 430,
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      padding: '22px 28px',
      whiteSpace: 'nowrap',
    }}
  >
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        background: 'linear-gradient(135deg,#3b82f6,#1e3a5f)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon d={ICON.user} color="#fff" size={36} />
    </div>
    <div>
      <div style={{ fontSize: 30, fontWeight: 700 }}>新成员</div>
      <div style={{ marginTop: 6, fontSize: 24, color: '#86efac' }}>技能测试通过 · 已转正</div>
    </div>
  </div>
)

const STEPS = ['报名', '初筛', '面试', '技能测试', '正式成员']
const Pipeline = ({ t }) => {
  const active = Math.floor(interpolate(t, [20, 120], [0, 4.99], clamp))
  return (
    <div style={{ ...card, padding: '24px 30px' }}>
      <div style={{ fontSize: 25, color: C.muted, marginBottom: 16 }}>招新流程</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {STEPS.map((s, k) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            {k > 0 && (
              <div
                style={{
                  width: 30,
                  height: 3,
                  borderRadius: 2,
                  background: k <= active ? C.accent : 'rgba(147,197,253,0.2)',
                }}
              />
            )}
            <div
              style={{
                fontSize: 26,
                fontWeight: 600,
                padding: '10px 20px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                color: k === active ? '#fff' : k < active ? C.accent : C.muted,
                background: k === active ? C.fill : 'transparent',
                border: `1.5px solid ${k <= active ? C.accent + '88' : 'rgba(147,197,253,0.2)'}`,
              }}
            >
              {s}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const FRAGMENTS = [
  { C: TaskCard, x: 300, y: 330, from: { x: -420, y: 260 }, delay: 50, rot: -4 },
  { C: Heatmap, x: 790, y: 270, from: { x: 1500, y: 160 }, delay: 62, rot: 3 },
  { C: PointsPill, x: 810, y: 560, from: { x: 1500, y: 620 }, delay: 74, rot: 6 },
  { C: Discussion, x: 300, y: 660, from: { x: -420, y: 760 }, delay: 86, rot: -3 },
  { C: ProjectCard, x: 770, y: 880, from: { x: 1500, y: 980 }, delay: 98, rot: 4 },
  { C: FundCard, x: 290, y: 1070, from: { x: -420, y: 1180 }, delay: 110, rot: -5 },
  { C: BountyCard, x: 780, y: 1250, from: { x: 1500, y: 1320 }, delay: 122, rot: 3 },
  { C: MemberCard, x: 310, y: 1400, from: { x: -420, y: 1480 }, delay: 134, rot: -3 },
  { C: Pipeline, x: 540, y: 1640, from: { x: 540, y: 2300 }, delay: 146, rot: 0 },
]

const Fragment = ({ i, x, y, from, delay, rot, C: Comp }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f - delay
  const enter = spring({ frame: Math.max(0, t), fps, config: { damping: 16, stiffness: 80, mass: 0.9 } })
  const cStart = 285 + i * 3
  const c = interpolate(f, [cStart, cStart + 64], [0, 1], { ...clamp, easing: Easing.bezier(0.6, 0, 0.9, 0.4) })
  const driftX = Math.sin((f + i * 40) / 70) * 10 * (1 - c)
  const driftY = Math.cos((f + i * 25) / 80) * 12 * (1 - c)
  const bx = from.x + (x - from.x) * enter + driftX
  const by = from.y + (y - from.y) * enter + driftY
  const px = bx + (CENTER.x - bx) * c
  const py = by + (CENTER.y - by) * c
  const scale = interpolate(enter, [0, 1], [0.7, 1]) * (1 - 0.94 * c)
  const rotate = interpolate(enter, [0, 1], [rot * 4, rot]) + c * rot * 6
  const opacity = Math.min(interpolate(t, [0, 14], [0, 1], clamp), 1 - interpolate(c, [0.65, 1], [0, 1], clamp))
  if (t < 0 || opacity <= 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: px,
        top: py,
        opacity,
        transform: `translate(-50%,-50%) rotate(${rotate}deg) scale(${scale})`,
        filter: c > 0 ? `blur(${c * 8}px)` : undefined,
      }}
    >
      <Comp t={t} />
    </div>
  )
}

// ───────────── 背景 ─────────────

const Background = () => {
  const f = useCurrentFrame()
  const reveal = interpolate(f, [0, 100], [0, 1900], { ...clamp, easing: ease })
  const scanY = interpolate(f, [15, 110], [-100, 2000], clamp)
  const zoom = interpolate(f, [0, 780], [1.06, 1])
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 70% at 50% 32%, #15284a 0%, #0b1423 55%, #060b15 100%)' }}>
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(147,197,253,0.42) 1.8px, transparent 2.2px)',
          backgroundSize: '48px 48px',
          backgroundPosition: `0 ${-f * 0.35}px`,
          transform: `scale(${zoom})`,
          WebkitMaskImage: `radial-gradient(circle at 50% 30%, black ${reveal * 0.45}px, rgba(0,0,0,0.25) ${reveal * 0.75}px, transparent ${reveal}px)`,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scanY,
          height: 160,
          background:
            'linear-gradient(180deg, transparent, rgba(147,197,253,0.10) 70%, rgba(147,197,253,0.55) 99%, transparent)',
          opacity: f < 115 ? 1 : 0,
        }}
      />
    </AbsoluteFill>
  )
}

// ───────────── Logo 汇聚与成形 ─────────────

const ICON_SIZE = 300

const LogoMark = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const flash = interpolate(f, [330, 372, 430], [0, 1, 0], clamp)
  const pop = spring({ frame: Math.max(0, f - 366), fps, config: { damping: 12, stiffness: 110, mass: 0.8 } })
  const arc = interpolate(f, [392, 440], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) })
  const ell = interpolate(f, [428, 466], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) })
  const dot1 = spring({ frame: Math.max(0, f - 456), fps, config: { damping: 9, stiffness: 160 } })
  const dot2 = spring({ frame: Math.max(0, f - 466), fps, config: { damping: 9, stiffness: 160 } })
  const sweep = interpolate(f, [478, 528], [-1.2, 1.2], clamp)
  const ring = interpolate(f, [468, 540], [0, 1], { ...clamp, easing: ease })
  if (f < 320) return null
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: CENTER.x - 450,
          top: CENTER.y - 450,
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(147,197,253,0.85) 0%, rgba(59,130,246,0.35) 25%, transparent 60%)',
          opacity: flash,
          transform: `scale(${0.4 + flash * 0.8})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: CENTER.x - 450,
          top: CENTER.y - 450,
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 55%)',
          opacity: pop,
        }}
      />
      {ring > 0 && ring < 1 && (
        <div
          style={{
            position: 'absolute',
            left: CENTER.x,
            top: CENTER.y,
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: 72,
            border: `4px solid rgba(147,197,253,${0.7 * (1 - ring)})`,
            transform: `translate(-50%,-50%) scale(${1 + ring * 0.6})`,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: CENTER.x,
          top: CENTER.y,
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: 61,
          overflow: 'hidden',
          background: 'linear-gradient(150deg, #3b82f6 0%, #2563eb 45%, #1d4ed8 100%)',
          boxShadow: '0 40px 90px rgba(37,99,235,0.55), inset 0 2px 0 rgba(255,255,255,0.25)',
          transform: `translate(-50%,-50%) scale(${pop})`,
        }}
      >
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 128 128">
          <g
            transform="translate(12 4) scale(0.9)"
            fill="none"
            stroke="#fff"
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M86 30a42 42 0 1 0 0 60"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - arc}
              opacity={arc > 0 ? 1 : 0}
            />
            <path
              d="M52 37v46h42"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - ell}
              opacity={ell > 0 ? 1 : 0}
            />
            <circle
              cx={95}
              cy={20}
              r={7}
              fill="#fff"
              stroke="none"
              transform={`translate(95 20) scale(${dot1}) translate(-95 -20)`}
            />
            <circle
              cx={95}
              cy={100}
              r={7}
              fill="#fff"
              stroke="none"
              transform={`translate(95 100) scale(${dot2}) translate(-95 -100)`}
            />
          </g>
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)',
            transform: `translateX(${sweep * 100}%)`,
          }}
        />
      </div>
    </>
  )
}

// ───────────── 文字 ─────────────

const Rise = ({ at, children, style }) => {
  const f = useCurrentFrame()
  const p = interpolate(f, [at, at + 34], [0, 1], { ...clamp, easing: ease })
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px)`,
        filter: `blur(${(1 - p) * 10}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const Wordmark = () => {
  const f = useCurrentFrame()
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 760,
        display: 'flex',
        justifyContent: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontWeight: 700,
        fontSize: 158,
        letterSpacing: -5,
        color: '#fff',
      }}
    >
      {'OpenLIMS'.split('').map((ch, k) => {
        const p = interpolate(f, [474 + k * 4, 506 + k * 4], [0, 1], { ...clamp, easing: ease })
        return (
          <span
            key={k}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${(1 - p) * 60}px)`,
              filter: `blur(${(1 - p) * 8}px)`,
            }}
          >
            {ch}
          </span>
        )
      })}
    </div>
  )
}

const MODULES = ['招新', '任务', '悬赏', '积分', '基金', '讨论']
const Modules = () => {
  const f = useCurrentFrame()
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 1280,
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        fontFamily: FONT,
      }}
    >
      {MODULES.map((m, k) => {
        const p = interpolate(f, [612 + k * 6, 642 + k * 6], [0, 1], { ...clamp, easing: ease })
        return (
          <div
            key={m}
            style={{
              opacity: p,
              transform: `scale(${0.8 + 0.2 * p})`,
              fontSize: 32,
              fontWeight: 600,
              color: C.ink,
              padding: '12px 26px',
              borderRadius: 999,
              border: '1.5px solid rgba(147,197,253,0.35)',
              background: 'rgba(29,78,216,0.18)',
            }}
          >
            {m}
          </div>
        )
      })}
    </div>
  )
}

const GITHUB =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'

const Divider = () => {
  const f = useCurrentFrame()
  const w = interpolate(f, [590, 640], [0, 520], { ...clamp, easing: ease })
  return (
    <div
      style={{
        position: 'absolute',
        left: 540 - w / 2,
        top: 1236,
        width: w,
        height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(147,197,253,0.7), transparent)',
      }}
    />
  )
}

export const IntroV1 = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT, overflow: 'hidden' }}>
    <Background />
    {FRAGMENTS.map((fr, i) => (
      <Fragment key={i} i={i} {...fr} />
    ))}
    <LogoMark />
    <Wordmark />
    <Rise at={540} style={{ top: 980, fontSize: 52, fontWeight: 500, color: C.muted }}>
      面向实验室的
    </Rise>
    <Rise at={556} style={{ top: 1050, fontSize: 70, fontWeight: 700, color: C.ink, letterSpacing: 2 }}>
      成员成长与科研协作平台
    </Rise>
    <Rise
      at={576}
      style={{
        top: 1166,
        fontSize: 28,
        fontWeight: 500,
        color: 'rgba(147,197,253,0.85)',
        letterSpacing: 2,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      Open Laboratory Information Management System
    </Rise>
    <Divider />
    <Modules />
    <Rise
      at={672}
      style={{
        top: 1560,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        fontSize: 34,
        color: C.ink,
        fontFamily: 'Menlo, "SF Mono", monospace',
      }}
    >
      <svg width={44} height={44} viewBox="0 0 16 16">
        <path d={GITHUB} fill="#fff" />
      </svg>
      github.com/YESlab-UAVtech/OpenLIMS
    </Rise>
    <Rise at={690} style={{ top: 1650, display: 'flex', justifyContent: 'center', gap: 16 }}>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#0b1423',
          background: C.accent,
          borderRadius: 10,
          padding: '6px 18px',
        }}
      >
        MIT
      </span>
      <span style={{ fontSize: 30, fontWeight: 600, color: C.ink, padding: '6px 0' }}>开源 · 欢迎 Star 与贡献</span>
    </Rise>
  </AbsoluteFill>
)
