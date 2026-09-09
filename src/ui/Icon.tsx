import type { SVGProps } from 'react';

export type IconName =
  | 'camera' | 'paint' | 'learn' | 'undo' | 'replay' | 'share' | 'sound' | 'sound-off'
  | 'voice' | 'voice-off' | 'close' | 'help' | 'arrow-right' | 'arrow-left' | 'check' | 'link' | 'rotate' | 'bulb' | 'home' | 'cube';

const PATHS: Record<IconName, string> = {
  camera: 'M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.6c.3-.4.7-.6 1.2-.6h4c.5 0 .9.2 1.2.6L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  paint: 'M14.5 4.5 19 9l-8.2 8.2a3 3 0 0 1-2.1.9H6v-2.7c0-.8.3-1.6.9-2.1L14.5 4.5Z M13 6l5 5 M6 20h12',
  learn: 'M12 5.5c-1.8-1.3-4.3-1.7-7-1.3v13.3c2.7-.4 5.2 0 7 1.3 1.8-1.3 4.3-1.7 7-1.3V4.2c-2.7-.4-5.2 0-7 1.3Z M12 5.5v13.3',
  undo: 'M8.5 6.5 4.5 10.5l4 4 M4.5 10.5h9a5 5 0 0 1 0 10h-3',
  replay: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3 M4.5 4.5v4h4 M11 9.5v5l4-2.5-4-2.5Z',
  share: 'M12 4v11 M8.5 7.5 12 4l3.5 3.5 M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12',
  sound: 'M4.5 9.5v5h2.8l3.7 3V6.5l-3.7 3H4.5Z M14.5 9.5a3.5 3.5 0 0 1 0 5 M17 7a7 7 0 0 1 0 10',
  'sound-off': 'M4.5 9.5v5h2.8l3.7 3V6.5l-3.7 3H4.5Z M15 9.5l5 5 M20 9.5l-5 5',
  voice: 'M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3Z M6.5 12a5.5 5.5 0 0 0 11 0 M12 17.5V20',
  'voice-off': 'M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3Z M6.5 12a5.5 5.5 0 0 0 11 0 M12 17.5V20 M5 5l14 14',
  close: 'M7 7l10 10 M17 7 7 17',
  help: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M9.8 9.6a2.3 2.3 0 0 1 4.5.6c0 1.5-2.3 1.9-2.3 3.3 M12 16.5h.01',
  'arrow-right': 'M5 12h14 M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5 M11 6l-6 6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  link: 'M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.4 1.4 M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.4',
  rotate: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3 M19.5 4.5v4h-4',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 1 3.5 10.9c-.6.5-1 1.2-1 2.1H9.5c0-.9-.4-1.6-1-2.1A6 6 0 0 1 12 3Z',
  home: 'M4.5 11 12 4.5l7.5 6.5 M6.5 9.8V19h11V9.8',
  cube: 'M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7L12 3.5Z M12 12l7.5-4.3 M12 12v8.5 M12 12 4.5 7.7',
};

export function Icon({ name, weight = 1.75, ...rest }: { name: IconName; weight?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
