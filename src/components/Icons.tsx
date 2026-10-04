import type { ReactNode } from 'react';

interface P {
  size?: number;
}

function Svg({ size = 24, children }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const FerryIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 15h18l-2.5 4.5a2 2 0 0 1-1.7 1H7.2a2 2 0 0 1-1.7-1L3 15Z" />
    <path d="M5 15V10h14v5" />
    <path d="M8 10V6h5v4" />
    <path d="M12 6V3" />
  </Svg>
);

export const RacerIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 16h14" />
    <path d="M4 16v-3l2.2-4.4A2 2 0 0 1 8 7.5h8a2 2 0 0 1 1.8 1.1L20 13v3" />
    <circle cx="7.5" cy="17" r="1.8" />
    <circle cx="16.5" cy="17" r="1.8" />
    <path d="M4 13h16" />
  </Svg>
);

export const BirdIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M16 7h.01" />
    <path d="M3.5 20 10 13.5" />
    <path d="M20 7.5 22 8l-2 .5" />
    <path d="M20 8a4 4 0 0 0-7.6-1.7L7 16a5 5 0 0 0 5 1.5c4.4-1.2 8-4.6 8-9.5Z" />
    <path d="M7 16 3 15l4.5-4" />
  </Svg>
);

export const FishIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6.5 12c2.5-4.5 7-6 10.5-4.5 2 .9 3.5 2.6 4 4.5-.5 1.9-2 3.6-4 4.5-3.5 1.5-8 0-10.5-4.5Z" />
    <path d="M6.5 12 2.5 8.5v7Z" />
    <path d="M17 11.5h.01" />
    <path d="M12.5 9.5c.7 1.6.7 3.4 0 5" />
  </Svg>
);

export const ArrowLeft = ({ size = 18 }: P) => (
  <Svg size={size}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </Svg>
);

export const ArrowRight = ({ size = 18 }: P) => (
  <Svg size={size}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Svg>
);

export const PlayIcon = ({ size = 18 }: P) => (
  <Svg size={size}>
    <path d="M7 4.5v15l12-7.5Z" fill="currentColor" />
  </Svg>
);

export const ClockIcon = ({ size = 16 }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const TrophyIcon = ({ size = 16 }: P) => (
  <Svg size={size}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M17 6h2.5a1.5 1.5 0 0 1 0 3.5H17" />
    <path d="M7 6H4.5a1.5 1.5 0 0 0 0 3.5H7" />
  </Svg>
);

export const CheckIcon = ({ size = 18 }: P) => (
  <Svg size={size}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const TargetIcon = ({ size = 18 }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Svg>
);

export const RetryIcon = ({ size = 18 }: P) => (
  <Svg size={size}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);

export const GridIcon = ({ size = 18 }: P) => (
  <Svg size={size}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Svg>
);

export const LogoMark = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 17V7l7 6 7-6v10" />
  </svg>
);
