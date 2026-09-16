import React from 'react';

export const FlagTR: React.FC<{ className?: string }> = ({ className = 'w-8 h-6' }) => (
  <svg viewBox="0 0 1200 800" className={`${className} rounded-md shadow-sm inline-block flex-shrink-0`}>
    <rect width="1200" height="800" fill="#E30A17" />
    <circle cx="425" cy="400" r="200" fill="#ffffff" />
    <circle cx="475" cy="400" r="160" fill="#E30A17" />
    <polygon
      fill="#ffffff"
      points="583,400 706,440 630,335 630,465 706,360"
    />
  </svg>
);

export const FlagGB: React.FC<{ className?: string }> = ({ className = 'w-8 h-6' }) => (
  <svg viewBox="0 0 600 300" className={`${className} rounded-md shadow-sm inline-block flex-shrink-0`}>
    <rect width="600" height="300" fill="#012169" />
    <path d="M0,0 L600,300 M600,0 L0,300" stroke="#ffffff" strokeWidth="60" />
    <path d="M0,0 L600,300 M600,0 L0,300" stroke="#C8102E" strokeWidth="20" />
    <path d="M300,0 v300 M0,150 h600" stroke="#ffffff" strokeWidth="100" />
    <path d="M300,0 v300 M0,150 h600" stroke="#C8102E" strokeWidth="60" />
  </svg>
);

export const FlagSA: React.FC<{ className?: string }> = ({ className = 'w-8 h-6' }) => (
  <svg viewBox="0 0 900 600" className={`${className} rounded-md shadow-sm inline-block flex-shrink-0`}>
    <rect width="900" height="600" fill="#006C35" />
    <path
      d="M250,390 L650,390 M650,390 L620,375 M650,390 L620,405"
      stroke="#ffffff"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 280 280 Q 320 230 360 280 T 440 280 T 520 280 T 600 280"
      fill="none"
      stroke="#ffffff"
      strokeWidth="12"
      strokeLinecap="round"
    />
    <circle cx="450" cy="220" r="14" fill="#ffffff" />
    <circle cx="370" cy="220" r="10" fill="#ffffff" />
    <circle cx="530" cy="220" r="10" fill="#ffffff" />
  </svg>
);

export const FlagES: React.FC<{ className?: string }> = ({ className = 'w-8 h-6' }) => (
  <svg viewBox="0 0 750 500" className={`${className} rounded-md shadow-sm inline-block flex-shrink-0`}>
    <rect width="750" height="500" fill="#C60B1E" />
    <rect width="750" height="250" y="125" fill="#FFC400" />
    <circle cx="200" cy="250" r="40" fill="#C60B1E" opacity="0.85" />
    <circle cx="200" cy="250" r="24" fill="#FFC400" />
  </svg>
);
