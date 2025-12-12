import type React from "react"

interface BeamCrossSectionImageProps {
  type: string
}

export const BeamCrossSectionImage: React.FC<BeamCrossSectionImageProps> = ({ type }) => {
  const size = 150
  const strokeWidth = 2

  switch (type) {
    case "Rectangular":
      return (
        <svg width={size} height={size} viewBox="0 0 150 150">
          <rect x="25" y="25" width="100" height="100" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <text x="75" y="145" fontSize="12" textAnchor="middle">
            W × H
          </text>
        </svg>
      )
    case "I Beam":
      return (
        <svg width={size} height={size} viewBox="0 0 150 150">
          <rect x="40" y="25" width="70" height="15" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <rect x="50" y="40" width="50" height="70" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <rect x="40" y="110" width="70" height="15" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <text x="75" y="145" fontSize="12" textAnchor="middle">
            I-Beam
          </text>
        </svg>
      )
    case "C Channel":
      return (
        <svg width={size} height={size} viewBox="0 0 150 150">
          <rect x="50" y="25" width="50" height="100" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <rect x="25" y="25" width="25" height="15" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <rect x="25" y="110" width="25" height="15" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <text x="75" y="145" fontSize="12" textAnchor="middle">
            C-Channel
          </text>
        </svg>
      )
    case "Circular":
      return (
        <svg width={size} height={size} viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="50" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <line x1="75" y1="25" x2="75" y2="125" stroke="black" strokeWidth="1" />
          <text x="85" y="80" fontSize="12" textAnchor="middle">
            D
          </text>
        </svg>
      )
    default:
      return null
  }
}

