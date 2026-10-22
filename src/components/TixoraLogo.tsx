import React from 'react';

interface TixoraLogoProps {
  /** Size variant or pixel dimension */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Whether to show the "Tixora" text beside or beneath the emblem */
  showText?: boolean;
  /** Show the "PRO" badge beside Tixora */
  showProBadge?: boolean;
  /** Layout direction: horizontal (inline) or vertical (stacked) */
  layout?: 'horizontal' | 'vertical';
  /** Optional custom CSS classes */
  className?: string;
  /** Subtitle text under Tixora */
  subtitle?: string;
}

export const TixoraLogo: React.FC<TixoraLogoProps> = ({
  size = 'md',
  showText = true,
  showProBadge = true,
  layout = 'horizontal',
  className = '',
  subtitle = 'Platform Tiket & Gate Pass Resmi',
}) => {
  // Map size variants to pixel dimensions
  const getIconSize = () => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'sm':
        return 28;
      case 'lg':
        return 52;
      case 'xl':
        return 84;
      case 'md':
      default:
        return 42;
    }
  };

  const iconPx = getIconSize();

  const getTextClass = () => {
    if (typeof size === 'number') {
      return size > 50 ? 'text-2xl sm:text-3xl' : size > 35 ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg';
    }
    switch (size) {
      case 'sm':
        return 'text-base';
      case 'lg':
        return 'text-2xl';
      case 'xl':
        return 'text-3xl sm:text-4xl';
      case 'md':
      default:
        return 'text-xl sm:text-2xl';
    }
  };

  return (
    <div
      className={`inline-flex ${
        layout === 'vertical' ? 'flex-col items-center text-center' : 'items-center gap-2.5'
      } ${className}`}
    >
      {/* Exact Neo-Brutalist Vector Emblem SVG matching user logo */}
      <div
        style={{ width: iconPx, height: iconPx }}
        className="shrink-0 relative select-none flex items-center justify-center transition-transform hover:scale-105"
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xs"
        >
          <defs>
            <filter id="tixoraNeoShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="3" dy="4" stdDeviation="0" floodColor="#0f172a" />
            </filter>
          </defs>

          {/* Squircle Background with Hard Shadow & Dark Border */}
          <g filter="url(#tixoraNeoShadow)">
            <rect
              x="16"
              y="12"
              width="68"
              height="76"
              rx="24"
              fill="#5b5df8"
              stroke="#0f172a"
              strokeWidth="5"
            />
          </g>

          {/* White Ticket Motif inside */}
          <g transform="translate(50, 50) rotate(-12)">
            <path
              d="M -18,-11 
                 H 18 
                 A 3.5,3.5 0 0 1 21.5,-7.5 
                 V -3.5 
                 A 4,4 0 0 0 21.5,3.5 
                 V 7.5 
                 A 3.5,3.5 0 0 1 18,11 
                 H -18 
                 A 3.5,3.5 0 0 1 -21.5,7.5 
                 V 3.5 
                 A 4,4 0 0 0 -21.5,-3.5 
                 V -7.5 
                 A 3.5,3.5 0 0 1 -18,-11 Z"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Center Perforated Ticket Line */}
            <line
              x1="0"
              y1="-7"
              x2="0"
              y2="7"
              stroke="#ffffff"
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeDasharray="3.5 4"
            />
          </g>
        </svg>
      </div>

      {/* Brand Typography & Yellow PRO badge */}
      {showText && (
        <div className={`flex flex-col ${layout === 'vertical' ? 'items-center mt-2' : ''}`}>
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-black tracking-tight text-slate-900 ${getTextClass()}`}
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            >
              Tixora
            </span>
            {showProBadge && (
              <span className="inline-flex items-center justify-center bg-amber-400 text-slate-950 font-black text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full border border-slate-900 shadow-[1.5px_1.5px_0px_#0f172a] uppercase tracking-wide">
                PRO
              </span>
            )}
          </div>
          {subtitle && (
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 mt-1 leading-tight">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
