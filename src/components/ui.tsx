import { AlertTriangle, CheckCircle2, Info, Loader2, LogOut, XCircle } from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode, useMemo } from 'react'

/** Nieve decorativa ligera (se desactiva con prefers-reduced-motion). */
export function Snowfall({ flakes = 26 }: { flakes?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: flakes }, (_, i) => {
        const size = 3 + ((i * 7) % 5)
        return {
          left: `${(i * 37) % 100}%`,
          size,
          duration: `${9 + ((i * 13) % 9)}s`,
          delay: `-${(i * 11) % 15}s`,
          drift: `${((i % 5) - 2) * 18}px`,
          opacity: 0.45 + (i % 4) * 0.12,
        }
      }),
    [flakes],
  )
  return (
    <div className="snowfall" aria-hidden="true">
      {items.map((f, i) => (
        <i
          key={i}
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            animationDuration: f.duration,
            animationDelay: f.delay,
            opacity: f.opacity,
            ['--drift' as string]: f.drift,
          }}
        />
      ))}
    </div>
  )
}

export function Garland() {
  return (
    <div className="garland" aria-hidden="true">
      <div className="garland-lights">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
    </div>
  )
}

interface AppHeaderProps {
  eyebrow: string
  title: ReactNode
  icon?: ReactNode
  onLogout?: () => void
  onTitleClick?: () => void
  children?: ReactNode
  wide?: boolean
  actions?: ReactNode
}

export function AppHeader({ eyebrow, title, icon, onLogout, onTitleClick, children, wide, actions }: AppHeaderProps) {
  const TitleTag = onTitleClick ? 'button' : 'div'
  return (
    <header className="xmas-header text-white relative z-10 shadow-lg shadow-pine-950/30">
      <div className={`${wide ? 'max-w-6xl' : 'max-w-xl'} mx-auto px-4 sm:px-5 pt-5 pb-4`}>
        <div className="flex items-center justify-between gap-3">
          <TitleTag
            type={onTitleClick ? 'button' : undefined}
            onClick={onTitleClick}
            className={`flex items-center gap-3 text-left min-w-0 ${onTitleClick ? 'cursor-pointer group' : ''}`}
          >
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 border border-gold-300/40 flex items-center justify-center text-gold-300 group-hover:bg-white/15 transition-colors">
              {icon}
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold-300 truncate">
                {eyebrow}
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">{title}</h1>
            </div>
          </TitleTag>
          <div className="flex items-center gap-2 shrink-0">
          {actions}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="shrink-0 px-3 py-2 rounded-xl bg-white/10 hover:bg-berry-600 border border-white/15 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          )}
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
      <Garland />
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-3xl border border-pine-100 shadow-sm shadow-pine-900/5 ${className}`}>
      {children}
    </div>
  )
}

type Variant = 'pine' | 'berry' | 'gold' | 'ghost' | 'dark'

const VARIANT: Record<Variant, string> = {
  pine: 'bg-pine-600 hover:bg-pine-700 text-white shadow-md shadow-pine-700/25',
  berry: 'bg-berry-600 hover:bg-berry-700 text-white shadow-md shadow-berry-700/25',
  gold: 'bg-gold-400 hover:bg-gold-300 text-pine-950 shadow-md shadow-gold-600/25',
  ghost: 'bg-pine-50 hover:bg-pine-100 text-pine-800 border border-pine-200',
  dark: 'bg-pine-950 hover:bg-pine-900 text-white',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'pine', loading, size = 'md', className = '', children, disabled, ...rest }: ButtonProps) {
  const sizes = {
    sm: 'px-3 py-2 text-xs rounded-xl',
    md: 'px-4 py-3 text-sm rounded-2xl',
    lg: 'px-5 py-4 text-base rounded-2xl',
  }
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${VARIANT[variant]} ${sizes[size]} font-extrabold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

export const inputClass =
  'w-full px-4 py-3 rounded-2xl bg-snow border-2 border-pine-100 text-pine-950 font-bold placeholder:text-pine-900/30 placeholder:font-semibold focus:outline-none focus:border-pine-500 focus:bg-white transition-colors'

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-extrabold uppercase tracking-wider text-pine-700 mb-1.5">
      {children}
    </label>
  )
}

export function Alert({ tone, children, onClose }: { tone: 'error' | 'success' | 'info' | 'warn'; children: ReactNode; onClose?: () => void }) {
  const styles = {
    error: 'bg-berry-50 border-berry-300 text-berry-800',
    success: 'bg-pine-50 border-pine-300 text-pine-800',
    info: 'bg-gold-50 border-gold-300 text-pine-900',
    warn: 'bg-gold-100 border-gold-400 text-gold-700',
  }
  const Icon = { error: XCircle, success: CheckCircle2, info: Info, warn: AlertTriangle }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`p-3.5 rounded-2xl border-2 text-sm font-bold flex items-start gap-2.5 ${styles[tone]}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="text-xs underline cursor-pointer shrink-0">
          OK
        </button>
      )}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  dark,
}: {
  tabs: Array<{ id: T; label: string; icon?: ReactNode }>
  active: T
  onChange: (id: T) => void
  dark?: boolean
}) {
  return (
    <div
      role="tablist"
      className={`flex gap-1.5 overflow-x-auto p-1 rounded-2xl ${dark ? 'bg-black/20' : 'bg-pine-100/70'}`}
    >
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`flex-1 min-w-fit whitespace-nowrap px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              on
                ? dark
                  ? 'bg-gold-400 text-pine-950'
                  : 'bg-white text-berry-700 shadow-sm'
                : dark
                  ? 'text-white/85 hover:bg-white/10'
                  : 'text-pine-800 hover:bg-white/60'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function Badge({ tone = 'pine', children }: { tone?: 'pine' | 'berry' | 'gold' | 'muted'; children: ReactNode }) {
  const styles = {
    pine: 'bg-pine-100 text-pine-800',
    berry: 'bg-berry-100 text-berry-800',
    gold: 'bg-gold-100 text-gold-700',
    muted: 'bg-pine-50 text-pine-700/70',
  }
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${styles[tone]}`}>{children}</span>
}

export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="py-10 text-center text-pine-800/60 text-sm font-semibold flex flex-col items-center gap-2">
      <div className="text-gold-500">{icon}</div>
      {children}
    </div>
  )
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
