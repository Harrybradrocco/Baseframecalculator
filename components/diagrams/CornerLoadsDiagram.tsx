import type React from "react"
import type { Load, Section } from "../../types"
import { validateNumber, validatePositive } from "../../utils/validation"

interface CornerLoadsDiagramProps {
  frameLength: number
  frameWidth: number
  loads: Load[]
  cornerReactionForce: number
  cornerReactions?: { R1: number; R2: number; R3: number; R4: number }
  sections?: Section[]
}

export const CornerLoadsDiagram: React.FC<CornerLoadsDiagramProps> = ({
  frameLength,
  frameWidth,
  loads,
  cornerReactionForce,
  cornerReactions,
  sections = [],
}) => {
  const svgWidth = 500
  const svgHeight = 450
  const margin = 80

  const validFrameLength = validatePositive(frameLength, 1000)
  const validFrameWidth = validatePositive(frameWidth, 1000)
  const scaleX = (svgWidth - 2 * margin) / validFrameLength
  const scaleY = (svgHeight - 2 * margin - 50) / validFrameWidth

  const frameRect = {
    x: margin,
    y: margin + 40,
    width: validFrameLength * scaleX,
    height: validFrameWidth * scaleY,
  }

  return (
    <svg width={svgWidth} height={svgHeight} className="mx-auto" id="corner-loads-diagram">
      {/* Frame outline */}
      <rect
        x={frameRect.x}
        y={frameRect.y}
        width={frameRect.width}
        height={frameRect.height}
        fill="none"
        stroke="black"
        strokeWidth="3"
      />

      {/* Corner reaction forces - Positioned to prevent overlap */}
      {[
        { 
          x: frameRect.x, 
          y: frameRect.y, 
          label: "R1", 
          reaction: cornerReactions?.R1 || cornerReactionForce,
          offsetX: -25, // Position to the left for top-left corner
          offsetY: -55
        },
        { 
          x: frameRect.x + frameRect.width, 
          y: frameRect.y, 
          label: "R2", 
          reaction: cornerReactions?.R2 || cornerReactionForce,
          offsetX: 25, // Position to the right for top-right corner
          offsetY: -55
        },
        { 
          x: frameRect.x, 
          y: frameRect.y + frameRect.height, 
          label: "R3", 
          reaction: cornerReactions?.R3 || cornerReactionForce,
          offsetX: -25, // Position to the left for bottom-left corner
          offsetY: 15
        },
        { 
          x: frameRect.x + frameRect.width, 
          y: frameRect.y + frameRect.height, 
          label: "R4", 
          reaction: cornerReactions?.R4 || cornerReactionForce,
          offsetX: 25, // Position to the right for bottom-right corner
          offsetY: 15
        },
      ].map((corner, index) => (
        <g key={index}>
          {/* Reaction force arrow */}
          <line
            x1={corner.x}
            y1={corner.y + (corner.offsetY < 0 ? -35 : 0)}
            x2={corner.x}
            y2={corner.y}
            stroke="blue"
            strokeWidth="2.5"
            markerEnd="url(#blueArrowhead)"
          />
          {/* Corner label and value - positioned to avoid overlap */}
          <text 
            x={corner.x + corner.offsetX} 
            y={corner.y + corner.offsetY} 
            textAnchor="middle" 
            fontSize="12" 
            fill="blue" 
            fontWeight="bold"
          >
            {corner.label}: {corner.reaction.toFixed(0)} N
          </text>
        </g>
      ))}

      {/* Section dividers - Simplified to prevent clutter */}
      {sections.map((section, index) => {
        const dividerX = margin + section.endPosition * scaleX
        
        return (
          <g key={section.id}>
            {/* Simple vertical divider line only */}
            <line
              x1={dividerX}
              y1={frameRect.y - 10}
              x2={dividerX}
              y2={frameRect.y + frameRect.height + 5}
              stroke="#999"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              opacity="0.6"
            />
          </g>
        )
      })}

      {/* Applied loads */}
      {loads.map((load, index) => {
        if (load.type === "Distributed Load") {
          let loadLengthMM = 0;
          let loadWidthMM = 0;
          let loadArea = 0;
          
          if (load.loadLength && load.loadWidth) {
            // For baseframe: use length and width directly
            loadLengthMM = validatePositive(load.loadLength, 100);
            loadWidthMM = validatePositive(load.loadWidth, 100);
            loadArea = (loadLengthMM * loadWidthMM) / 1_000_000; // Convert to m²
          } else if (load.area) {
            // For simple beam: convert area to square side length
            loadLengthMM = Math.sqrt(validatePositive(load.area, 1)) * 1000;
            loadWidthMM = loadLengthMM; // Square
            loadArea = load.area;
          } else {
            return null; // Skip invalid load
          }
          
          const loadStartPos = validateNumber(load.startPosition, 0);
          const x = margin + loadStartPos * scaleX; // Start from left side (startPosition)
          const y = margin + 40 + (validFrameWidth * scaleY) / 2 - (loadWidthMM * scaleY) / 2;
          const loadValue = load.magnitude * loadArea;
          return (
            <g key={index}>
              <rect
                x={Math.max(margin, validateNumber(x, margin))}
                y={Math.max(margin + 40, validateNumber(y, margin + 40))}
                width={validatePositive(Math.min(loadLengthMM * scaleX, validFrameLength * scaleX), 10)}
                height={validatePositive(Math.min(loadWidthMM * scaleY, validFrameWidth * scaleY), 10)}
                fill="rgba(255, 0, 0, 0.3)"
                stroke="red"
                strokeWidth="2"
              />
              {/* Load label - positioned inside the box to avoid overlap */}
              {loadLengthMM * scaleX > 40 && (
                <text
                  x={
                    Math.max(margin, validateNumber(x, margin)) +
                    validatePositive(Math.min(loadLengthMM * scaleX, validFrameLength * scaleX), 10) / 2
                  }
                  y={
                    Math.max(margin + 40, validateNumber(y, margin + 40)) +
                    validatePositive(Math.min(loadWidthMM * scaleY, validFrameWidth * scaleY), 10) / 2 + 4
                  }
                  textAnchor="middle"
                  fontSize="9"
                  fill="red"
                  fontWeight="bold"
                >
                  {loadValue.toFixed(0)}N
                </text>
              )}
            </g>
          );
        } else {
          const loadStartPos = validateNumber(load.startPosition, 0)
          const x = margin + loadStartPos * scaleX
          const y = margin + 40 + (validFrameWidth * scaleY) / 2
          return (
            <g key={index}>
              <line x1={x} y1={y - 20} x2={x} y2={y} stroke="red" strokeWidth="2.5" markerEnd="url(#redArrowhead)" />
              <text x={x} y={y - 25} textAnchor="middle" fontSize="9" fill="red" fontWeight="bold">
                {load.magnitude.toFixed(0)}N
              </text>
            </g>
          )
        }
      })}

      {/* Arrow definitions */}
      <defs>
        <marker id="blueArrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="blue" />
        </marker>
        <marker id="redArrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="red" />
        </marker>
      </defs>

      {/* Simplified dimension labels */}
      <text x={svgWidth / 2} y={svgHeight - 10} textAnchor="middle" fontSize="11" fill="#666">
        {validFrameLength}mm × {validFrameWidth}mm
      </text>
    </svg>
  )
}

