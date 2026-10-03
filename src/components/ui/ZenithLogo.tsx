import React from 'react';

interface ZenithLogoProps {
  className?: string;
  size?: number;
}

export function ZenithLogo({ className = 'w-6 h-6', size }: ZenithLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-label="Zenith Logo"
      role="img"
    >
      <rect width="512" height="512" fill="#1D2021" />
      <rect
        x="15"
        y="15"
        width="482"
        height="482"
        fill="none"
        stroke="#3C3836"
        strokeWidth="15"
      />
      <g transform="translate(81.92, 81.92) scale(14.506666666666668)">
        <path
          d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
          fill="#FE8019"
          stroke="#FE8019"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
