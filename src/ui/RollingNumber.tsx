import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';

/** A number that rolls in place when it changes. Tabular so the line never reflows. */
export function RollingNumber({ value, className = '' }: { value: number | string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={`rolling num ${className}`} style={{ display: 'inline-grid', verticalAlign: 'baseline' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={String(value)}
          style={{ gridArea: '1 / 1', display: 'inline-block' }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(10px)', filter: 'blur(2px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)', filter: 'blur(0px)' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-10px)', filter: 'blur(2px)' }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
