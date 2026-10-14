import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  withEmberGlow?: boolean;
}

/**
 * Hearth Brand Logo:
 * Minimal black square logo with two nested white outlined triangles
 * pointing upward, resembling a beacon or flame.
 * No text inside the logo symbol.
 */
export const Logo: React.FC<LogoProps> = ({ size = 32, className = '', withEmberGlow = false }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center bg-black border border-zinc-800 rounded-md overflow-hidden select-none shrink-0 ${
        withEmberGlow ? 'shadow-[0_0_15px_rgba(234,88,12,0.25)]' : ''
      } ${className}`}
      style={{ width: size, height: size }}
      title="Hearth"
    >
      <svg
        width={size * 0.75}
        height={size * 0.75}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white"
      >
        {/* Outer triangle (larger, pointing upward) */}
        <path
          d="M16 5L27 25H5L16 5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner triangle (nested, pointing upward) */}
        <path
          d="M16 13L21.5 23H10.5L16 13Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
