import './Button.css';
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import type { Tint } from './Glow';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  /** Primary only: colour the sheen with a stage colour instead of Opal's yellow→mint. */
  tone?: Tint | 'holo';
  block?: boolean;
  ready?: boolean;
};

const TONE: Record<Tint, string> = {
  white: 'var(--a-white)', yellow: 'var(--a-yellow)', red: 'var(--a-red)', orange: 'var(--a-orange)',
  green: 'var(--a-green)', blue: 'var(--a-blue)',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', tone = 'holo', block, ready, className = '', style, children, ...rest }, ref,
) {
  const cls = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className].filter(Boolean).join(' ');
  const toned = variant === 'primary' && tone !== 'holo';
  const s: CSSProperties = toned ? ({ '--tone': TONE[tone], ...style } as CSSProperties) : style ?? {};
  return (
    <button ref={ref} className={cls} style={s} data-toned={toned ? '' : undefined} data-ready={ready ? '' : undefined} {...rest}>
      {children}
    </button>
  );
});
