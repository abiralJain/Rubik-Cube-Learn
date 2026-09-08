import './Button.css';
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import type { Tint } from './Glow';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'candy' | 'ghost' | 'icon';
  tone?: Tint | 'holo';
  block?: boolean;
  ready?: boolean;
};

const TONE: Record<Tint | 'holo', string> = {
  white: 'var(--c-white)', yellow: 'var(--c-yellow)', red: 'var(--c-red)', orange: 'var(--c-orange)',
  green: 'var(--c-green)', blue: 'var(--c-blue)', holo: 'var(--holo)',
};
const LIGHT = new Set(['white', 'yellow', 'holo']);

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'candy', tone = 'green', block, ready, className = '', style, children, ...rest }, ref,
) {
  const cls = ['btn', `btn-${variant === 'icon' ? 'ghost btn-icon' : variant}`, block ? 'btn-block' : '', className].join(' ');
  const toneStyle: CSSProperties =
    variant === 'candy'
      ? tone === 'holo'
        ? { background: 'var(--holo)', ...style }
        : ({ '--tone': TONE[tone], ...style } as CSSProperties)
      : style ?? {};
  return (
    <button ref={ref} className={cls} style={toneStyle} data-light={LIGHT.has(tone) && variant === 'candy' ? '' : undefined} data-ready={ready ? '' : undefined} {...rest}>
      {children}
    </button>
  );
});
