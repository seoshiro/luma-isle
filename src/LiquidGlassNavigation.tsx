import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Camera, Check } from 'lucide-react';
import type { Quality } from './game';
import { glassMode, highlightIndex } from './glass-policy';
import { getGlassRendererStatus, setGlassRegion, subscribeGlassRenderer } from './glass-regions';
import './liquid-glass.css';

interface GlassSettings { quality: Quality; reducedMotion: boolean }

function useHighContrast() {
  const [contrast, setContrast] = useState(() => matchMedia('(prefers-contrast: more), (forced-colors: active)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-contrast: more), (forced-colors: active)');
    const update = () => setContrast(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return contrast;
}

/** Content is a sibling of the optical paint, never a filtered descendant. */
function GlassSurface({ children, className, quality, reducedMotion }: GlassSettings & { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const highContrast = useHighContrast();
  const status = useSyncExternalStore(subscribeGlassRenderer, getGlassRendererStatus, () => 'pending' as const);
  const mode = glassMode(quality, reducedMotion, highContrast, status);
  const eligible = quality !== 'low' && !reducedMotion && !highContrast;
  useEffect(() => {
    const element = ref.current;
    if (!element || !eligible) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setGlassRegion(id, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      setGlassRegion(id, null);
    };
  }, [id, eligible]);
  return <div ref={ref} className={`glass-surface ${className}`} data-glass-mode={mode} data-glass-motion={reducedMotion || quality === 'low' ? 'still' : 'elastic'}>
    <span className="glass-backdrop" aria-hidden="true" />
    <span className="glass-tint" aria-hidden="true" />
    <span className="glass-rim" aria-hidden="true" />
    {children}
  </div>;
}

interface NavigationItem { id: string; label: string; icon: ReactNode; onSelect: () => void }
interface NavigationProps extends GlassSettings {
  items: NavigationItem[];
  stage: number;
  progressLabel: string;
  completedLabel: string;
  photoLabel: string;
  onPhoto: () => void;
}

export default function LiquidGlassNavigation({ items, stage, progressLabel, completedLabel, photoLabel, onPhoto, quality, reducedMotion }: NavigationProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pressed, setPressed] = useState(false);
  const active = highlightIndex(stage, hovered, focused, items.length);
  return <div className="bottom-hud liquid-glass-hud">
    <GlassSurface className="glass-dock" quality={quality} reducedMotion={reducedMotion}>
      <nav className="glass-navigation" aria-label={progressLabel}
        onPointerLeave={() => { setHovered(null); setPressed(false); }}
        onPointerUp={() => setPressed(false)} onPointerCancel={() => setPressed(false)}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setFocused(null); setPressed(false); } }}
        data-pressed={pressed ? 'true' : 'false'} style={{ '--glass-active': active } as CSSProperties}>
        <span className="glass-active-indicator" aria-hidden="true" />
        {items.map((item, index) => <button key={item.id} type="button"
          className={`glass-stage ${stage > index ? 'complete' : ''} ${stage === index ? 'current' : ''}`}
          aria-label={`${item.label}${stage > index ? `, ${completedLabel}` : ''}`}
          aria-current={stage === index ? 'step' : undefined}
          onClick={item.onSelect}
          onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(index); }}
          onPointerDown={() => { setHovered(index); setPressed(true); }}
          onFocus={() => { setFocused(index); setHovered(null); }}>
          <span className="glass-stage-icon" aria-hidden="true">{item.icon}{stage > index && <Check className="glass-stage-check" size={10} />}</span>
          <span className="glass-stage-name" aria-hidden="true">{item.label}</span>
        </button>)}
        <span className="glass-progress-count" aria-label={`${progressLabel}: ${stage} / ${items.length}`}>{stage}<small>/ {items.length}</small></span>
      </nav>
    </GlassSurface>
    <GlassSurface className="glass-photo" quality={quality} reducedMotion={reducedMotion}>
      <button type="button" className="glass-photo-button" aria-label={photoLabel} onClick={onPhoto}>
        <Camera size={23} aria-hidden="true" />
        <span className="glass-stage-name" aria-hidden="true">{photoLabel}</span>
      </button>
    </GlassSurface>
  </div>;
}
