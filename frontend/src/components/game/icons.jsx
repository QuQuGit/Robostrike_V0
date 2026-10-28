import React from "react";

// Explosion burst icon (lucide-compatible props)
export const BlastIcon = ({ size = 24, strokeWidth = 2, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" className={className} style={style}>
    <path d="M12 1.8l2.1 5.3 4.9-2.9-1.6 5.5 5.3.9-4.4 3.3 3.7 4-5.5-.4.4 5.6-4.1-3.8-2.8 4.9-1.4-5.5-5.3 1.9 2.7-4.9L1 13.6l4.6-2.9L2.4 6.1l5.5 1.2L8.5 1.8 11 6.6z" />
    <circle cx="12" cy="12.4" r="2.6" fill="currentColor" stroke="none" />
  </svg>
);
