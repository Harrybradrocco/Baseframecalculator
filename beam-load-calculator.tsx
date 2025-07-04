"use client"

import { useCallback } from "react"

import { useEffect } from "react"

import { useState } from "react"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { HelpCircle } from "lucide-react"
import { jsPDF } from "jspdf"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import Head from "next/head"
import { Mail } from "lucide-react"

const standardMaterials = {
  "ASTM A36 Structural Steel": {
    yieldStrength: 250,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  "ASTM A992 Structural Steel": {
    yieldStrength: 345,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  "ASTM A572 Grade 50 Steel": {
    yieldStrength: 345,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  Custom: {
    yieldStrength: 0,
    elasticModulus: 0,
    density: 0,
    poissonsRatio: 0,
    thermalExpansion: 0,
  },
} as const

interface Load {
  type: "Point Load" | "Uniform Load" | "Distributed Load"
  magnitude: number
  startPosition: number
  endPosition?: number
  area?: number
}

// Validation helper functions
const validateNumber = (value: number, fallback = 0): number => {
  return isNaN(value) || !isFinite(value) ? fallback : value
}

const validatePositive = (value: number, fallback = 1): number => {
  const validated = validateNumber(value, fallback)
  return validated <= 0 ? fallback : validated
}

const HelpDialog: React.FC = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="fixed top-4 right-4 z-50 bg-transparent">
          <HelpCircle className="w-4 h-4 mr-2" />
          Help & Formulas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Calculation Methods & Formulas</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Load Calculations */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Load Calculations</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Point Load</h4>
                  <p className="text-sm text-gray-600">Total Load = Magnitude (N)</p>
                </div>
                <div>
                  <h4 className="font-medium">Uniform Load</h4>
                  <p className="text-sm text-gray-600">Total Load = Magnitude (N/m) × Length (m)</p>
                </div>
                <div>
                  <h4 className="font-medium">Distributed Load</h4>
                  <p className="text-sm text-gray-600">Total Load = Magnitude (N/m²) × Area (m²)</p>
                </div>
              </div>
            </section>

            {/* Shear Force */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Maximum Shear Force</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Simple Beam</h4>
                  <p className="text-sm text-gray-600 mb-2">For simply supported beam with point loads:</p>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">V_max = max(|R₁|, |R₂|)</p>
                  <p className="text-sm text-gray-600">Where R₁ and R₂ are reaction forces at supports</p>
                </div>
                <div>
                  <h4 className="font-medium">Base Frame</h4>
                  <p className="text-sm text-gray-600 mb-2">For uniform load on critical beam:</p>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">V_max = wL/2</p>
                  <p className="text-sm text-gray-600">Where w = uniform load per meter, L = beam length</p>
                </div>
              </div>
            </section>

            {/* Bending Moment */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Maximum Bending Moment</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Simple Beam</h4>
                  <p className="text-sm text-gray-600 mb-2">Calculated at multiple points along beam length:</p>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">M(x) = R₁(x - a) - ΣP(x - xᵢ)</p>
                  <p className="text-sm text-gray-600">Where P = point loads, xᵢ = load positions</p>
                </div>
                <div>
                  <h4 className="font-medium">Base Frame</h4>
                  <p className="text-sm text-gray-600 mb-2">For uniform load on simply supported beam:</p>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">M_max = wL²/8</p>
                  <p className="text-sm text-gray-600">Maximum occurs at center of beam</p>
                </div>
              </div>
            </section>

            {/* Moment of Inertia */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Moment of Inertia (I)</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Rectangular Section</h4>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">I = bh³/12</p>
                  <p className="text-sm text-gray-600">Where b = width, h = height</p>
                </div>
                <div>
                  <h4 className="font-medium">I-Beam & C-Channel</h4>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">I = I_flanges + I_web</p>
                  <p className="text-sm text-gray-600">
                    Sum of flange and web contributions using parallel axis theorem
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Circular Section</h4>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">I = πd⁴/64</p>
                  <p className="text-sm text-gray-600">Where d = diameter</p>
                </div>
              </div>
            </section>

            {/* Section Modulus */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Section Modulus (S)</h3>
              <p className="text-sm text-gray-600 mb-2">Measure of beam's resistance to bending:</p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">S = I/c</p>
              <p className="text-sm text-gray-600">Where I = moment of inertia, c = distance to extreme fiber</p>
            </section>

            {/* Stresses */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Stress Calculations</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Normal Stress (Bending)</h4>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">σ = M/S</p>
                  <p className="text-sm text-gray-600">Where M = maximum bending moment, S = section modulus</p>
                </div>
                <div>
                  <h4 className="font-medium">Shear Stress</h4>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">τ = 1.5V/A</p>
                  <p className="text-sm text-gray-600">Where V = maximum shear force, A = cross-sectional area</p>
                  <p className="text-sm text-gray-600">Factor 1.5 accounts for non-uniform shear distribution</p>
                </div>
              </div>
            </section>

            {/* Safety Factor */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Safety Factor</h3>
              <p className="text-sm text-gray-600 mb-2">Ratio of material strength to applied stress:</p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">SF = σ_yield / σ_applied</p>
              <div className="text-sm text-gray-600 mt-2">
                <p>{"• SF > 2.0: Generally safe for static loads"}</p>
                <p>{"• SF > 3.0: Recommended for dynamic loads"}</p>
                <p>{"• SF < 1.0: Unsafe - material may yield"}</p>
              </div>
            </section>

            {/* Deflection */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Maximum Deflection</h3>
              <p className="text-sm text-gray-600 mb-2">For simply supported beam with uniform load:</p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">δ_max = 5wL⁴/(384EI)</p>
              <p className="text-sm text-gray-600">
                Where w = load per unit length, L = span, E = elastic modulus, I = moment of inertia
              </p>
            </section>

            {/* Base Frame Analysis */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Base Frame Analysis Method</h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  1. Total applied loads are distributed equally among 4 frame members
                </p>
                <p className="text-sm text-gray-600">
                  2. Each member carries 1/4 of total load as uniform distribution
                </p>
                <p className="text-sm text-gray-600">3. Critical beam (longer side) determines maximum stresses</p>
                <p className="text-sm text-gray-600">4. Corner reactions calculated assuming rigid connections</p>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded">Corner Reaction = V_max × √2</p>
              </div>
            </section>

            {/* Units */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Units Used</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p>
                    <strong>Length:</strong> mm, m
                  </p>
                  <p>
                    <strong>Force:</strong> N (Newtons)
                  </p>
                  <p>
                    <strong>Stress:</strong> MPa (Megapascals)
                  </p>
                  <p>
                    <strong>Area:</strong> m²
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Moment:</strong> N·m
                  </p>
                  <p>
                    <strong>Elastic Modulus:</strong> GPa
                  </p>
                  <p>
                    <strong>Density:</strong> kg/m³
                  </p>
                  <p>
                    <strong>Moment of Inertia:</strong> m⁴
                  </p>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

interface BeamDiagramProps {
  beamLength: number
  leftSupport: number
  rightSupport: number
  loads: Load[]
}

const BeamDiagram: React.FC<BeamDiagramProps> = ({ beamLength, leftSupport, rightSupport, loads }) => {
  const svgWidth = 500
  const svgHeight = 250
  const margin = 50
  const beamY = svgHeight / 2
  const supportSize = 30

  const validBeamLength = beamLength || 1000
  const validLeftSupport = leftSupport || 0
  const validRightSupport = rightSupport || validBeamLength

  const leftSupportX = margin + (validLeftSupport / validBeamLength) * (svgWidth - 2 * margin)
  const rightSupportX = margin + (validRightSupport / validBeamLength) * (svgWidth - 2 * margin)

  return (
    <svg width={svgWidth} height={svgHeight} className="mx-auto" id="beam-structure-diagram">
      {/* Beam */}
      <line x1={margin} y1={beamY} x2={svgWidth - margin} y2={beamY} stroke="black" strokeWidth="4" />

      {/* Left Support */}
      <polygon
        points={`${leftSupportX},${beamY} ${leftSupportX - supportSize / 2},${
          beamY + supportSize
        } ${leftSupportX + supportSize / 2},${beamY + supportSize}`}
        fill="none"
        stroke="black"
        strokeWidth="2"
      />

      {/* Right Support */}
      <polygon
        points={`${rightSupportX},${beamY} ${rightSupportX - supportSize / 2},${
          beamY + supportSize
        } ${rightSupportX + supportSize / 2},${beamY + supportSize}`}
        fill="none"
        stroke="black"
        strokeWidth="2"
      />

      {/* Load Arrows */}
      {loads.map((load, index) => {
        const loadStartX = margin + (load.startPosition / validBeamLength) * (svgWidth - 2 * margin)
        const loadEndX =
          load.type === "Uniform Load"
            ? margin + ((load.endPosition || load.startPosition) / validBeamLength) * (svgWidth - 2 * margin)
            : loadStartX

        if (load.type === "Point Load") {
          return (
            <g key={index}>
              <line
                x1={loadStartX}
                y1={beamY - 70}
                x2={loadStartX}
                y2={beamY}
                stroke="red"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              <text x={loadStartX} y={beamY - 80} textAnchor="middle" fontSize="11" fill="red" fontWeight="bold">
                {load.magnitude.toFixed(0)} N
              </text>
            </g>
          )
        } else {
          return (
            <g key={index}>
              <line x1={loadStartX} y1={beamY - 50} x2={loadEndX} y2={beamY - 50} stroke="red" strokeWidth="2" />
              {Array.from({ length: 5 }).map((_, i) => {
                const x = loadStartX + ((loadEndX - loadStartX) / 4) * i
                return (
                  <line
                    key={i}
                    x1={x}
                    y1={beamY - 50}
                    x2={x}
                    y2={beamY}
                    stroke="red"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                )
              })}
              <text
                x={(loadStartX + loadEndX) / 2}
                y={beamY - 60}
                textAnchor="middle"
                fontSize="11"
                fill="red"
                fontWeight="bold"
              >
                {load.magnitude.toFixed(0)} N/m
              </text>
            </g>
          )
        }
      })}

      {/* Arrow definition */}
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="red" />
        </marker>
      </defs>

      {/* Labels */}
      <text x={margin} y={beamY + supportSize + 25} textAnchor="middle" fontSize="12">
        0
      </text>
      <text x={svgWidth - margin} y={beamY + supportSize + 25} textAnchor="middle" fontSize="12">
        {validBeamLength}
      </text>
      <text x={svgWidth / 2} y={svgHeight - 15} textAnchor="middle" fontSize="12">
        Beam Length: {validBeamLength} mm
      </text>
    </svg>
  )
}

interface FrameDiagramProps {
  frameLength: number
  frameWidth: number
  loads: Load[]
}

const FrameDiagram: React.FC<FrameDiagramProps> = ({ frameLength, frameWidth, loads }) => {
  const svgWidth = 500
  const svgHeight = 450
  const margin = 60

  // Scale factors with validation
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
    <svg width={svgWidth} height={svgHeight} className="mx-auto" id="frame-structure-diagram">
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

      {/* Longitudinal beams (top and bottom) */}
      <line
        x1={margin}
        y1={margin + 30}
        x2={margin + validatePositive(validFrameLength * scaleX, 100)}
        y2={margin + 30}
        stroke="blue"
        strokeWidth="3"
      />
      <line
        x1={margin}
        y1={margin + 30 + validatePositive(validFrameWidth * scaleY, 100)}
        x2={margin + validatePositive(validFrameLength * scaleX, 100)}
        y2={margin + 30 + validatePositive(validFrameWidth * scaleY, 100)}
        stroke="blue"
        strokeWidth="3"
      />

      {/* Transverse beams (left and right) */}
      <line
        x1={margin}
        y1={margin + 30}
        x2={margin}
        y2={margin + 30 + validatePositive(validFrameWidth * scaleY, 100)}
        stroke="red"
        strokeWidth="3"
      />
      <line
        x1={margin + validatePositive(validFrameLength * scaleX, 100)}
        y1={margin + 30}
        x2={margin + validatePositive(validFrameLength * scaleX, 100)}
        y2={margin + 30 + validatePositive(validFrameWidth * scaleY, 100)}
        stroke="red"
        strokeWidth="3"
      />

      {/* Load indicators */}
      {loads.map((load, index) => {
        if (load.type === "Distributed Load" && load.area) {
          // Convert area (m²) to side length in mm
          const loadAreaSideMM = Math.sqrt(validatePositive(load.area, 1)) * 1000;
          const loadStartPos = validateNumber(load.startPosition, 0);
          const x = margin + loadStartPos * scaleX - (loadAreaSideMM * scaleX) / 2;
          const y = margin + 30 + (validFrameWidth * scaleY) / 2 - (loadAreaSideMM * scaleY) / 2;
          const loadValue = load.magnitude * load.area;
          return (
            <g key={index}>
              <rect
                x={Math.max(margin, validateNumber(x, margin))}
                y={Math.max(margin + 30, validateNumber(y, margin + 30))}
                width={validatePositive(Math.min(loadAreaSideMM * scaleX, validFrameLength * scaleX), 10)}
                height={validatePositive(Math.min(loadAreaSideMM * scaleY, validFrameWidth * scaleY), 10)}
                fill="rgba(255, 0, 0, 0.3)"
                stroke="red"
                strokeWidth="1"
              />
              <text
                x={
                  Math.max(margin, validateNumber(x, margin)) +
                  validatePositive(Math.min(loadAreaSideMM * scaleX, validFrameLength * scaleX), 10) / 2
                }
                y={Math.max(margin + 30, validateNumber(y, margin + 30)) - 8}
                textAnchor="middle"
                fontSize="10"
                fill="red"
                fontWeight="bold"
              >
                {loadValue.toFixed(0)}N
              </text>
            </g>
          );
        } else {
          const loadStartPos = validateNumber(load.startPosition, 0)
          const x = margin + loadStartPos * scaleX
          const y = margin + 30 + (validFrameWidth * scaleY) / 2
          return (
            <g key={index}>
              <line x1={x} y1={y - 25} x2={x} y2={y} stroke="red" strokeWidth="3" markerEnd="url(#redArrowhead)" />
              <text x={x} y={y - 30} textAnchor="middle" fontSize="10" fill="red" fontWeight="bold">
                {load.magnitude.toFixed(0)}N
              </text>
            </g>
          )
        }
      })}

      {/* Arrow definitions */}
      <defs>
        <marker id="redArrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="red" />
        </marker>
      </defs>

      {/* Dimension lines and labels */}
      {/* Length dimension */}
      <line
        x1={margin}
        y1={margin}
        x2={margin + validatePositive(validFrameLength * scaleX, 100)}
        y2={margin}
        stroke="black"
        strokeWidth="1"
      />
      <line x1={margin} y1={margin - 5} x2={margin} y2={margin + 5} stroke="black" strokeWidth="1" />
      <line
        x1={margin + validatePositive(validFrameLength * scaleX, 100)}
        y1={margin - 5}
        x2={margin + validatePositive(validFrameLength * scaleX, 100)}
        y2={margin + 5}
        stroke="black"
        strokeWidth="1"
      />
      <text
        x={margin + validatePositive(validFrameLength * scaleX, 100) / 2}
        y={margin - 10}
        textAnchor="middle"
        fontSize="12"
      >
        {validFrameLength} mm
      </text>

      {/* Width dimension */}
      <line
        x1={margin - 30}
        y1={margin + 30}
        x2={margin - 30}
        y2={margin + 30 + validatePositive(validFrameWidth * scaleY, 100)}
        stroke="black"
        strokeWidth="1"
      />
      <line x1={margin - 35} y1={margin + 30} x2={margin - 25} y2={margin + 30} stroke="black" strokeWidth="1" />
      <line
        x1={margin - 35}
        y1={margin + 30 + validatePositive(validFrameWidth * scaleY, 100)}
        x2={margin - 25}
        y2={margin + 30 + validatePositive(validFrameWidth * scaleY, 100)}
        stroke="black"
        strokeWidth="1"
      />
      <text
        x={margin - 40}
        y={margin + 30 + validatePositive(validFrameWidth * scaleY, 100) / 2}
        textAnchor="middle"
        fontSize="12"
        transform={`rotate(-90, ${margin - 40}, ${margin + 30 + validatePositive(validFrameWidth * scaleY, 100) / 2})`}
      >
        {validFrameWidth} mm
      </text>

      {/* Labels */}
      <text x={svgWidth / 2} y={svgHeight - 15} textAnchor="middle" fontSize="12">
        Base Frame: {validFrameLength}mm × {validFrameWidth}mm
      </text>
      <text x={10} y={20} fontSize="12" fill="blue">
        Longitudinal Beams (2)
      </text>
      <text x={10} y={35} fontSize="12" fill="red">
        Transverse Beams (2)
      </text>
    </svg>
  )
}

interface CornerLoadsDiagramProps {
  frameLength: number
  frameWidth: number
  loads: Load[]
  cornerReactionForce: number
}

const CornerLoadsDiagram: React.FC<CornerLoadsDiagramProps> = ({
  frameLength,
  frameWidth,
  loads,
  cornerReactionForce,
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

      {/* Corner reaction forces */}
      {[
        { x: frameRect.x, y: frameRect.y, label: "R1" },
        { x: frameRect.x + frameRect.width, y: frameRect.y, label: "R2" },
        { x: frameRect.x, y: frameRect.y + frameRect.height, label: "R3" },
        { x: frameRect.x + frameRect.width, y: frameRect.y + frameRect.height, label: "R4" },
      ].map((corner, index) => (
        <g key={index}>
          {/* Reaction force arrow */}
          <line
            x1={corner.x}
            y1={corner.y - 35}
            x2={corner.x}
            y2={corner.y}
            stroke="blue"
            strokeWidth="3"
            markerEnd="url(#blueArrowhead)"
          />
          {/* Force label */}
          <text x={corner.x} y={corner.y - 45} textAnchor="middle" fontSize="12" fill="blue" fontWeight="bold">
            {corner.label}
          </text>
          <text x={corner.x} y={corner.y - 32} textAnchor="middle" fontSize="10" fill="blue">
            {cornerReactionForce.toFixed(0)}N
          </text>
        </g>
      ))}

      {/* Applied loads */}
      {loads.map((load, index) => {
        if (load.type === "Distributed Load" && load.area) {
          // Convert area (m²) to side length in mm
          const loadAreaSideMM = Math.sqrt(validatePositive(load.area, 1)) * 1000;
          const loadStartPos = validateNumber(load.startPosition, 0);
          const x = margin + loadStartPos * scaleX - (loadAreaSideMM * scaleX) / 2;
          const y = margin + 40 + (validFrameWidth * scaleY) / 2 - (loadAreaSideMM * scaleY) / 2;
          const loadValue = load.magnitude * load.area;
          return (
            <g key={index}>
              <rect
                x={Math.max(margin, validateNumber(x, margin))}
                y={Math.max(margin + 40, validateNumber(y, margin + 40))}
                width={validatePositive(Math.min(loadAreaSideMM * scaleX, validFrameLength * scaleX), 10)}
                height={validatePositive(Math.min(loadAreaSideMM * scaleY, validFrameWidth * scaleY), 10)}
                fill="rgba(255, 0, 0, 0.3)"
                stroke="red"
                strokeWidth="2"
              />
              <text
                x={
                  Math.max(margin, validateNumber(x, margin)) +
                  validatePositive(Math.min(loadAreaSideMM * scaleX, validFrameLength * scaleX), 10) / 2
                }
                y={Math.max(margin + 40, validateNumber(y, margin + 40)) - 8}
                textAnchor="middle"
                fontSize="10"
                fill="red"
                fontWeight="bold"
              >
                {loadValue.toFixed(0)}N
              </text>
            </g>
          );
        } else {
          const loadStartPos = validateNumber(load.startPosition, 0)
          const x = margin + loadStartPos * scaleX
          const y = margin + 40 + (validFrameWidth * scaleY) / 2
          return (
            <g key={index}>
              <line x1={x} y1={y - 25} x2={x} y2={y} stroke="red" strokeWidth="3" markerEnd="url(#redArrowhead)" />
              <text x={x} y={y - 30} textAnchor="middle" fontSize="10" fill="red" fontWeight="bold">
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

      {/* Dimension labels */}
      <text x={svgWidth / 2} y={svgHeight - 15} textAnchor="middle" fontSize="12">
        Corner Loads Analysis: {validFrameLength}mm × {validFrameWidth}mm
      </text>
      <text x={10} y={20} fontSize="12" fill="blue">
        Corner Reactions: {cornerReactionForce.toFixed(0)}N each
      </text>
      <text x={10} y={35} fontSize="12" fill="red">
        Applied Loads (Red Arrows)
      </text>
    </svg>
  )
}

const BeamCrossSectionImage: React.FC<{ type: string }> = ({ type }) => {
  const size = 150
  const strokeWidth = 2

  switch (type) {
    case "Rectangular":
      return (
        <svg width={size} height={size} viewBox="0 0 150 150">
          <rect x="25" y="25" width="100" height="100" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <line x1="0" y1="25" x2="25" y2="25" stroke="black" strokeWidth="1" />
          <line x1="0" y1="125" x2="25" y2="125" stroke="black" strokeWidth="1" />
          <text x="10" y="80" fontSize="12" textAnchor="middle">
            H
          </text>
          <line x1="25" y1="0" x2="25" y2="25" stroke="black" strokeWidth="1" />
          <line x1="125" y1="0" x2="125" y2="25" stroke="black" strokeWidth="1" />
          <text x="75" y="15" fontSize="12" textAnchor="middle">
            W
          </text>
        </svg>
      )
    case "I Beam":
      return (
        <svg width={size} height={size} viewBox="0 0 150 150">
          <path
            d="M25 25 H125 V45 H95 V105 H125 V125 H25 V105 H55 V45 H25 Z"
            fill="none"
            stroke="black"
            strokeWidth={strokeWidth}
          />
          <line x1="0" y1="25" x2="25" y2="25" stroke="black" strokeWidth="1" />
          <line x1="0" y1="125" x2="25" y2="125" stroke="black" strokeWidth="1" />
          <text x="10" y="80" fontSize="12" textAnchor="middle">
            H
          </text>
          <line x1="125" y1="25" x2="150" y2="25" stroke="black" strokeWidth="1" />
          <text x="137" y="40" fontSize="12" textAnchor="middle">
            tf
          </text>
          <line x1="95" y1="45" x2="125" y2="45" stroke="black" strokeWidth="1" />
          <text x="110" y="55" fontSize="12" textAnchor="middle">
            tw
          </text>
          <line x1="125" y1="0" x2="125" y2="25" stroke="black" strokeWidth="1" />
          <text x="135" y="15" fontSize="12" textAnchor="middle">
            bf
          </text>
        </svg>
      )
    case "C Channel":
      return (
        <svg width={size} height={size} viewBox="0 0 150 150">
          <path d="M50 25 H125 V45 H70 V105 H125 V125 H50 V25 Z" fill="none" stroke="black" strokeWidth={strokeWidth} />
          <line x1="25" y1="25" x2="50" y2="25" stroke="black" strokeWidth="1" />
          <line x1="25" y1="125" x2="50" y2="125" stroke="black" strokeWidth="1" />
          <text x="35" y="80" fontSize="12" textAnchor="middle">
            H
          </text>
          <line x1="125" y1="25" x2="150" y2="25" stroke="black" strokeWidth="1" />
          <text x="137" y="40" fontSize="12" textAnchor="middle">
            tf
          </text>
          <line x1="70" y1="45" x2="125" y2="45" stroke="black" strokeWidth="1" />
          <text x="97" y="55" fontSize="12" textAnchor="middle">
            tw
          </text>
          <line x1="125" y1="0" x2="125" y2="25" stroke="black" strokeWidth="1" />
          <text x="135" y="15" fontSize="12" textAnchor="middle">
            bf
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

// Helper: Convert SVG element to PNG data URL
async function svgToPngDataUrl(svg: SVGSVGElement, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svg);
    // Add XML declaration for compatibility
    if (!svgString.startsWith('<?xml')) {
      svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
    }
    const svg64 = btoa(unescape(encodeURIComponent(svgString)));
    const image64 = 'data:image/svg+xml;base64,' + svg64;
    const img = new window.Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context not available'));
      // White background for PDF
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = function (e) {
      reject(new Error('Failed to load SVG as image'));
    };
    img.src = image64;
  });
}

export default function BeamLoadCalculator() {
  const [analysisType, setAnalysisType] = useState("Simple Beam")
  const [beamType, setBeamType] = useState("Simple Beam")
  const [beamCrossSection, setBeamCrossSection] = useState("C Channel")
  const [beamLength, setBeamLength] = useState(1000)
  const [frameLength, setFrameLength] = useState(2000)
  const [frameWidth, setFrameWidth] = useState(1000)
  const [leftSupport, setLeftSupport] = useState(0)
  const [rightSupport, setRightSupport] = useState(1000)
  const [loads, setLoads] = useState<Load[]>([{ type: "Point Load", magnitude: 1000, startPosition: 500 }])
  const [shearForceData, setShearForceData] = useState<Array<{ x: number; y: number }>>([])
  const [bendingMomentData, setBendingMomentData] = useState<Array<{ x: number; y: number }>>([])
  const [axialForceData, setAxialForceData] = useState<Array<{ x: number; y: number }>>([])
  const [material, setMaterial] = useState<keyof typeof standardMaterials>("ASTM A36 Structural Steel")
  const [customMaterial, setCustomMaterial] = useState({ ...standardMaterials["Custom"] })
  const [width, setWidth] = useState(100)
  const [height, setHeight] = useState(218)
  const [flangeWidth, setFlangeWidth] = useState(66)
  const [flangeThickness, setFlangeThickness] = useState(3)
  const [webThickness, setWebThickness] = useState(44.8)
  const [diameter, setDiameter] = useState(100)
  const [beamDensity, setBeamDensity] = useState(7850)
  const [frameWeight, setFrameWeight] = useState(0)
  const [results, setResults] = useState({
    maxShearForce: 0,
    maxBendingMoment: 0,
    maxNormalStress: 0,
    maxShearStress: 0,
    safetyFactor: 0,
    totalBeams: 0,
    loadPerBeam: 0,
    momentOfInertia: 0,
    sectionModulus: 0,
    cornerReactionForce: 0,
    maxDeflection: 0,
    totalAppliedLoad: 0,
  })
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [deflectionData, setDeflectionData] = useState<Array<{ x: number; y: number }>>([])

  // Reset loads when analysis type changes
  useEffect(() => {
    if (analysisType === "Simple Beam") {
      setLoads([{ type: "Point Load", magnitude: 1000, startPosition: 500 }])
    } else {
      setLoads([{ type: "Distributed Load", magnitude: 1000, startPosition: 1000, area: 0.5 }])
    }
  }, [analysisType])

  const addLoad = () => {
    if (loads.length < 10) {
      const newLoad: Load =
        analysisType === "Simple Beam"
          ? { type: "Point Load", magnitude: 1000, startPosition: beamLength / 2 }
          : { type: "Distributed Load", magnitude: 1000, startPosition: frameLength / 2, area: 0.5 }
      setLoads([...loads, newLoad])
    }
  }

  const removeLoad = (index: number) => {
    setLoads(loads.filter((_, i) => i !== index))
  }

  const updateLoad = (index: number, updatedLoad: Partial<Load>) => {
    setLoads(
      loads.map((load, i) => {
        if (i === index) {
          const newLoad = { ...load, ...updatedLoad }
          if (newLoad.type === "Uniform Load" && !newLoad.endPosition) {
            newLoad.endPosition = newLoad.startPosition + 100
          }
          if (newLoad.type === "Distributed Load" && !newLoad.area) {
            newLoad.area = 0.5
          }
          return newLoad
        }
        return load
      }),
    )
  }

  const calculateResults = useCallback(() => {
    // Validate inputs
    const validFrameLength = validatePositive(frameLength, 1000)
    const validFrameWidth = validatePositive(frameWidth, 1000)
    const validBeamLength = validatePositive(beamLength, 1000)

    // Convert mm to m for calculations
    const frameLengthM = validFrameLength / 1000
    const frameWidthM = validFrameWidth / 1000
    const beamLengthM = validBeamLength / 1000
    const widthM = validatePositive(width, 100) / 1000
    const heightM = validatePositive(height, 218) / 1000
    const flangeWidthM = validatePositive(flangeWidth, 66) / 1000
    const flangeThicknessM = validatePositive(flangeThickness, 3) / 1000
    const webThicknessM = validatePositive(webThickness, 44.8) / 1000
    const diameterM = validatePositive(diameter, 100) / 1000

    // Calculate cross-sectional properties
    let beamVolume: number
    switch (beamCrossSection) {
      case "Rectangular":
        beamVolume = widthM * heightM
        break
      case "I Beam":
        beamVolume = 2 * flangeWidthM * flangeThicknessM + (heightM - 2 * flangeThicknessM) * webThicknessM
        break
      case "C Channel":
        beamVolume = 2 * flangeWidthM * flangeThicknessM + (heightM - 2 * flangeThicknessM) * webThicknessM
        break
      case "Circular":
        beamVolume = Math.PI * Math.pow(diameterM / 2, 2)
        break
      default:
        beamVolume = widthM * heightM
    }

    // Calculate total applied loads
    let totalAppliedLoad = 0
    loads.forEach((load) => {
      if (load.type === "Distributed Load" && load.area) {
        // For distributed loads: magnitude (N/m²) × area (m²) = total load (N)
        totalAppliedLoad += load.magnitude * load.area
      } else if (load.type === "Uniform Load" && load.endPosition) {
        // For uniform loads: magnitude (N/m) × length (m) = total load (N)
        const loadLength = (load.endPosition - load.startPosition) / 1000
        totalAppliedLoad += load.magnitude * loadLength
      } else {
        // For point loads: magnitude is already in Newtons
        totalAppliedLoad += load.magnitude
      }
    })

    let maxShearForce = 0
    let maxBendingMoment = 0
    let frameWeightN = 0
    let totalBeams = 0
    let loadPerBeam = 0

    if (analysisType === "Simple Beam") {
      // Single beam analysis
      totalBeams = 1
      loadPerBeam = totalAppliedLoad
      frameWeightN = beamVolume * beamLengthM * beamDensity * 9.81

      // Calculate reactions for simple beam
      const leftSupportM = leftSupport / 1000
      const rightSupportM = rightSupport / 1000
      const spanLength = rightSupportM - leftSupportM

      let R1 = 0,
        R2 = 0

      loads.forEach((load) => {
        const loadStartPositionM = load.startPosition / 1000

        if (load.type === "Point Load") {
          const a = loadStartPositionM - leftSupportM
          const b = rightSupportM - loadStartPositionM
          if (spanLength > 0) {
            R1 += (load.magnitude * b) / spanLength
            R2 += (load.magnitude * a) / spanLength
          }
        } else if (load.type === "Uniform Load") {
          const loadEndPositionM = load.endPosition! / 1000
          const loadStartM = Math.max(loadStartPositionM, leftSupportM)
          const loadEndM = Math.min(loadEndPositionM, rightSupportM)

          if (loadEndM > loadStartM) {
            const loadLengthM = loadEndM - loadStartM
            const totalLoad = load.magnitude * loadLengthM
            const loadCentroidM = (loadStartM + loadEndM) / 2

            const a = loadCentroidM - leftSupportM
            const b = rightSupportM - loadCentroidM
            if (spanLength > 0) {
              R1 += (totalLoad * b) / spanLength
              R2 += (totalLoad * a) / spanLength
            }
          }
        }
      })

      maxShearForce = Math.max(Math.abs(R1), Math.abs(R2))

      // Calculate maximum bending moment
      const numPoints = 100
      const dx = beamLengthM / (numPoints - 1)

      for (let i = 0; i < numPoints; i++) {
        const x = i * dx
        let moment = 0

        if (x >= leftSupportM) {
          moment = R1 * (x - leftSupportM)
        }
        if (x >= rightSupportM) {
          moment -= R2 * (x - rightSupportM)
        }

        loads.forEach((load) => {
          if (load.type === "Point Load" && x > load.startPosition / 1000) {
            moment -= load.magnitude * (x - load.startPosition / 1000)
          } else if (load.type === "Uniform Load") {
            const loadStartM = load.startPosition / 1000
            const loadEndM = load.endPosition! / 1000
            if (x > loadStartM) {
              const loadedLength = Math.min(x - loadStartM, loadEndM - loadStartM)
              const loadCentroid = loadStartM + loadedLength / 2
              moment -= load.magnitude * loadedLength * (x - loadCentroid)
            }
          }
        })

        maxBendingMoment = Math.max(maxBendingMoment, Math.abs(moment))
      }
    } else {
      // Base frame analysis - Fixed calculations
      totalBeams = 4
      const framePerimeter = 2 * (frameLengthM + frameWidthM)
      frameWeightN = beamVolume * framePerimeter * beamDensity * 9.81

      // For base frame, loads are distributed to all 4 members
      // Each member carries 1/4 of the total load as uniform load
      loadPerBeam = totalAppliedLoad / 4

      // Calculate critical beam length (longer of the two sides)
      const criticalBeamLength = Math.max(frameLengthM, frameWidthM)

      // For simply supported beam with uniform load:
      // Max shear = wL/2, Max moment = wL²/8
      const uniformLoadPerMeter = loadPerBeam / criticalBeamLength
      maxShearForce = (uniformLoadPerMeter * criticalBeamLength) / 2
      maxBendingMoment = (uniformLoadPerMeter * Math.pow(criticalBeamLength, 2)) / 8
    }

    setFrameWeight(Number(frameWeightN.toFixed(2)))

    // Calculate cross-sectional properties for stress analysis
    const materialProps = material === "Custom" ? customMaterial : standardMaterials[material]
    let area: number, momentOfInertia: number, sectionModulus: number

    switch (beamCrossSection) {
      case "Rectangular":
        area = widthM * heightM
        momentOfInertia = (widthM * Math.pow(heightM, 3)) / 12
        sectionModulus = momentOfInertia / (heightM / 2)
        break
      case "I Beam":
        area = 2 * flangeWidthM * flangeThicknessM + (heightM - 2 * flangeThicknessM) * webThicknessM
        const I_total_flange = (flangeWidthM * Math.pow(flangeThicknessM, 3)) / 12
        const I_flange_parallel = flangeWidthM * flangeThicknessM * Math.pow((heightM - flangeThicknessM) / 2, 2)
        const I_web = (webThicknessM * Math.pow(heightM - 2 * flangeThicknessM, 3)) / 12
        momentOfInertia = 2 * (I_total_flange + I_flange_parallel) + I_web
        sectionModulus = momentOfInertia / (heightM / 2)
        break
      case "C Channel":
        area = 2 * flangeWidthM * flangeThicknessM + (heightM - 2 * flangeThicknessM) * webThicknessM
        const I_flange_c =
          (flangeWidthM * Math.pow(flangeThicknessM, 3)) / 12 +
          flangeWidthM * flangeThicknessM * Math.pow((heightM - flangeThicknessM) / 2, 2)
        const I_web_c = (webThicknessM * Math.pow(heightM - 2 * flangeThicknessM, 3)) / 12
        momentOfInertia = 2 * I_flange_c + I_web_c
        sectionModulus = momentOfInertia / (heightM / 2)
        break
      case "Circular":
        area = Math.PI * Math.pow(diameterM / 2, 2)
        momentOfInertia = (Math.PI * Math.pow(diameterM, 4)) / 64
        sectionModulus = momentOfInertia / (diameterM / 2)
        break
      default:
        area = widthM * heightM
        momentOfInertia = (widthM * Math.pow(heightM, 3)) / 12
        sectionModulus = momentOfInertia / (heightM / 2)
    }

    // Calculate stresses
    const maxNormalStress = maxBendingMoment / sectionModulus / 1e6 // Convert to MPa
    const maxShearStress = (1.5 * maxShearForce) / area / 1e6 // Convert to MPa

    // Calculate safety factor
    const safetyFactor = materialProps.yieldStrength > 0 ? materialProps.yieldStrength / maxNormalStress : 0

    // Calculate deflection
    const E = materialProps.elasticModulus * 1e9 // Convert GPa to Pa
    const criticalLength = analysisType === "Simple Beam" ? beamLengthM : Math.max(frameLengthM, frameWidthM)
    const maxDeflection = E > 0 ? (5 * totalAppliedLoad * Math.pow(criticalLength, 4)) / (384 * E * momentOfInertia) : 0

    setResults({
      maxShearForce: Number(maxShearForce.toFixed(2)),
      maxBendingMoment: Number(maxBendingMoment.toFixed(2)),
      maxNormalStress: Number(maxNormalStress.toFixed(2)),
      maxShearStress: Number(maxShearStress.toFixed(2)),
      safetyFactor: Number(safetyFactor.toFixed(2)),
      totalBeams: totalBeams,
      loadPerBeam: Number(loadPerBeam.toFixed(2)),
      momentOfInertia: Number(momentOfInertia.toFixed(6)),
      sectionModulus: Number(sectionModulus.toFixed(6)),
      cornerReactionForce: Number((maxShearForce * Math.sqrt(2)).toFixed(2)),
      maxDeflection: Number(maxDeflection.toFixed(6)),
      totalAppliedLoad: Number(totalAppliedLoad.toFixed(2)),
    })
  }, [
    analysisType,
    beamLength,
    frameLength,
    frameWidth,
    leftSupport,
    rightSupport,
    loads,
    material,
    customMaterial,
    width,
    height,
    flangeWidth,
    flangeThickness,
    webThickness,
    diameter,
    beamDensity,
    beamCrossSection,
  ])

  const calculateDiagrams = useCallback(() => {
    const numPoints = 100
    const validBeamLength = validatePositive(beamLength, 1000)
    const validFrameLength = validatePositive(frameLength, 1000)
    const validFrameWidth = validatePositive(frameWidth, 1000)
    const criticalLength =
      analysisType === "Simple Beam" ? validBeamLength : Math.max(validFrameLength, validFrameWidth)
    const dx = criticalLength / (numPoints - 1)
    const shearForce = []
    const bendingMoment = []
    const deflection = []

    if (analysisType === "Simple Beam") {
      // Simple beam diagram calculations
      const beamLengthM = beamLength / 1000
      const leftSupportM = leftSupport / 1000
      const rightSupportM = rightSupport / 1000
      const spanLength = rightSupportM - leftSupportM

      // Calculate reactions
      let R1 = 0,
        R2 = 0
      loads.forEach((load) => {
        const loadStartPositionM = load.startPosition / 1000
        if (load.type === "Point Load") {
          const a = loadStartPositionM - leftSupportM
          const b = rightSupportM - loadStartPositionM
          if (spanLength > 0) {
            R1 += (load.magnitude * b) / spanLength
            R2 += (load.magnitude * a) / spanLength
          }
        }
      })

      // Calculate E and I for deflection
      const materialProps = material === "Custom" ? customMaterial : standardMaterials[material]
      const E = materialProps.elasticModulus * 1e9 // Pa
      // Use momentOfInertia from results (already calculated)
      const I = results.momentOfInertia
      for (let i = 0; i < numPoints; i++) {
        const x = i * dx
        const xM = x / 1000
        let shear = 0
        let moment = 0
        let delta = 0
        // Add left reaction
        if (xM >= leftSupportM) shear += R1
        // Subtract right reaction
        if (xM >= rightSupportM) shear -= R2
        // Subtract loads
        loads.forEach((load) => {
          if (load.type === "Point Load" && xM >= load.startPosition / 1000) {
            shear -= load.magnitude
          }
        })
        // Calculate moment
        if (xM >= leftSupportM) {
          moment = R1 * (xM - leftSupportM)
        }
        if (xM >= rightSupportM) {
          moment -= R2 * (xM - rightSupportM)
        }
        loads.forEach((load) => {
          if (load.type === "Point Load" && xM > load.startPosition / 1000) {
            moment -= load.magnitude * (xM - load.startPosition / 1000)
          }
        })
        // Deflection for single point load at a (approximate for first load only)
        if (loads.length === 1 && loads[0].type === "Point Load" && E > 0 && I > 0) {
          const P = loads[0].magnitude
          const a = (loads[0].startPosition - leftSupport) / 1000
          const b = (rightSupport - loads[0].startPosition) / 1000
          const L = spanLength
          if (xM <= a) {
            delta = (P * b * xM * (L * L - b * b - xM * xM)) / (6 * L * E * I)
          } else {
            delta = (P * a * (L - xM) * (2 * L * xM - xM * xM - a * a)) / (6 * L * E * I)
          }
        } else {
          // For multiple loads or uniform loads, use superposition or zero (for now)
          delta = 0
        }
        shearForce.push({ x: Number(x.toFixed(2)), y: Number(shear.toFixed(2)) })
        bendingMoment.push({ x: Number(x.toFixed(2)), y: Number(moment.toFixed(2)) })
        deflection.push({ x: Number(x.toFixed(2)), y: Number((delta * 1000).toFixed(4)) }) // mm
      }
    } else {
      // Base frame - show critical beam analysis with correct uniform load
      const criticalLength = Math.max(validFrameLength, validFrameWidth)
      const criticalLengthM = criticalLength / 1000
      const uniformLoadPerMeter = results.totalAppliedLoad / 4 / criticalLengthM
      // Use momentOfInertia from results (already calculated)
      const materialProps = material === "Custom" ? customMaterial : standardMaterials[material]
      const E = materialProps.elasticModulus * 1e9 // Pa
      const I = results.momentOfInertia
      for (let i = 0; i < numPoints; i++) {
        const x = i * dx
        const xM = x / 1000
        // For simply supported beam with uniform load w (N/m):
        // Shear V(x) = wL/2 - wx
        // Moment M(x) = (wL/2)x - (wx²/2) = wx(L-x)/2
        // Deflection: δ(x) = (w x (L^3 - 2Lx^2 + x^3)) / (24 E I)
        const shear = (uniformLoadPerMeter * criticalLengthM) / 2 - uniformLoadPerMeter * xM
        const moment = (uniformLoadPerMeter * xM * (criticalLengthM - xM)) / 2
        let delta = 0
        if (E > 0 && I > 0) {
          delta = (uniformLoadPerMeter * xM * (Math.pow(criticalLengthM, 3) - 2 * criticalLengthM * xM * xM + Math.pow(xM, 3))) / (24 * E * I)
        }
        shearForce.push({ x: Number(x.toFixed(2)), y: Number(shear.toFixed(2)) })
        bendingMoment.push({ x: Number(x.toFixed(2)), y: Number(moment.toFixed(2)) })
        deflection.push({ x: Number(x.toFixed(2)), y: Number((delta * 1000).toFixed(4)) }) // mm
      }
    }
    setShearForceData(shearForce)
    setBendingMomentData(bendingMoment)
    setDeflectionData(deflection)
  }, [
    analysisType,
    beamLength,
    frameLength,
    frameWidth,
    leftSupport,
    rightSupport,
    loads,
    results.totalAppliedLoad,
    results.loadPerBeam,
    results.momentOfInertia,
    material,
    customMaterial,
  ])

  useEffect(() => {
    calculateResults()
    calculateDiagrams()
  }, [calculateResults, calculateDiagrams])

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true)
    try {
      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const contentWidth = pageWidth - 2 * margin

      // Set default font
      pdf.setFont("helvetica") // Note: jsPDF doesn't support custom fonts like "Chesna Grotesk" directly
      // For custom fonts, you would need to load them into jsPDF, but for now we'll use helvetica

      // Helper function to add wrapped text with better formatting
      const addWrappedText = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        fontSize = 10,
      ): number => {
        pdf.setFontSize(fontSize)
        const lines = pdf.splitTextToSize(text, maxWidth)
        pdf.text(lines, x, y)
        return y + lines.length * lineHeight
      }

      // Helper function to add section headers
      const addSectionHeader = (title: string, x: number, y: number): number => {
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.text(title, x, y)
        pdf.setFont("helvetica", "normal")
        return y + 8
      }

      // Helper function to add subsection headers
      const addSubsectionHeader = (title: string, x: number, y: number): number => {
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.text(title, x, y)
        pdf.setFont("helvetica", "normal")
        return y + 6
      }

      // Helper to capture a DOM node as PNG using svgToPngDataUrl
      const captureSVGAsImage = async (svgId: string, fallbackWidth: number, fallbackHeight: number) => {
        const svg = document.getElementById(svgId) as SVGSVGElement | null;
        if (!svg) throw new Error(`SVG with id '${svgId}' not found in DOM. Make sure the chart is visible on the page before downloading the PDF.`);
        let width = fallbackWidth;
        let height = fallbackHeight;
        if (svg.hasAttribute("width")) width = Number(svg.getAttribute("width")) || fallbackWidth;
        if (svg.hasAttribute("height")) height = Number(svg.getAttribute("height")) || fallbackHeight;
        return await svgToPngDataUrl(svg, width, height);
      }

      // Title Page
      pdf.setFontSize(24)
      pdf.setFont("helvetica", "bold")
      pdf.text("Load Analysis Report", pageWidth / 2, 40, { align: "center" })

      // Subtitle
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "normal")
      pdf.text("Structural Engineering Analysis", pageWidth / 2, 55, { align: "center" })

      // Date and time
      pdf.setFontSize(12)
      const now = new Date()
      const dateStr = now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
      pdf.text(`Date: ${dateStr}`, pageWidth / 2, 70, { align: "center" })
      pdf.text(`Prepared by: hbradroc@uwo.ca`, pageWidth / 2, 80, { align: "center" })

      // Add a line separator
      pdf.setLineWidth(0.5)
      pdf.line(margin, 95, pageWidth - margin, 95)

      // Declare yOffset at the top before any use
      let yOffset = 0;

      // Add Table of Contents page
      pdf.addPage()
      yOffset = 30
      yOffset = addSectionHeader("TABLE OF CONTENTS", margin, yOffset)
      yOffset += 20

      // TOC entries
      pdf.setFontSize(11)
      pdf.setFont("helvetica", "bold")
      pdf.text("1. CONFIGURATION", margin, yOffset)
      pdf.setFont("helvetica", "normal")
      pdf.text("4", pageWidth - margin - 10, yOffset, { align: "right" })
      yOffset += 15

      pdf.setFont("helvetica", "bold")
      pdf.text("2. LOADING CONDITIONS", margin, yOffset)
      pdf.setFont("helvetica", "normal")
      pdf.text("5", pageWidth - margin - 10, yOffset, { align: "right" })
      yOffset += 15

      pdf.setFont("helvetica", "bold")
      pdf.text("3. ANALYSIS RESULTS", margin, yOffset)
      pdf.setFont("helvetica", "normal")
      pdf.text("6", pageWidth - margin - 10, yOffset, { align: "right" })
      yOffset += 15

      pdf.setFont("helvetica", "bold")
      pdf.text("4. STRUCTURAL DIAGRAMS", margin, yOffset)
      pdf.setFont("helvetica", "normal")
      pdf.text("7", pageWidth - margin - 10, yOffset, { align: "right" })
      yOffset += 15

      pdf.setFont("helvetica", "bold")
      pdf.text("5. FORCE DIAGRAMS", margin, yOffset)
      pdf.setFont("helvetica", "normal")
      pdf.text("8", pageWidth - margin - 10, yOffset, { align: "right" })
      yOffset += 20

      // Add line separator
      pdf.setLineWidth(0.5)
      pdf.line(margin, yOffset, pageWidth - margin, yOffset)

      // Add a new page for the first section
      pdf.addPage()
      yOffset = 30

      // 1. CONFIGURATION SECTION
      yOffset = addSectionHeader("1. CONFIGURATION", margin, yOffset)
      yOffset += 5

      if (analysisType === "Simple Beam") {
        yOffset = addSubsectionHeader("Beam Properties:", margin, yOffset)
        yOffset = addWrappedText(`• Length: ${beamLength} mm`, margin + 10, yOffset, contentWidth - 10, 6, 10)
        yOffset = addWrappedText(
          `• Left Support Position: ${leftSupport} mm`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
        yOffset = addWrappedText(
          `• Right Support Position: ${rightSupport} mm`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
        yOffset = addWrappedText(
          `• Span Length: ${rightSupport - leftSupport} mm`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
      } else {
        yOffset = addSubsectionHeader("Frame Properties:", margin, yOffset)
        yOffset = addWrappedText(`• Frame Length: ${frameLength} mm`, margin + 10, yOffset, contentWidth - 10, 6, 10)
        yOffset = addWrappedText(`• Frame Width: ${frameWidth} mm`, margin + 10, yOffset, contentWidth - 10, 6, 10)
        yOffset = addWrappedText(
          `• Total Members: 4 (2 Longitudinal + 2 Transverse)`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
      }

      yOffset += 5
      yOffset = addSubsectionHeader("Cross Section:", margin, yOffset)
      yOffset = addWrappedText(`• Type: ${beamCrossSection}`, margin + 10, yOffset, contentWidth - 10, 6, 10)

      if (beamCrossSection === "Rectangular") {
        yOffset = addWrappedText(`• Width: ${width} mm`, margin + 10, yOffset, contentWidth - 10, 6, 10)
        yOffset = addWrappedText(`• Height: ${height} mm`, margin + 10, yOffset, contentWidth - 10, 6, 10)
      } else if (beamCrossSection === "I Beam" || beamCrossSection === "C Channel") {
        yOffset = addWrappedText(`• Height (H): ${height} mm`, margin + 10, yOffset, contentWidth - 10, 6, 10)
        yOffset = addWrappedText(
          `• Flange Width (bf): ${flangeWidth} mm`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
        yOffset = addWrappedText(
          `• Flange Thickness (tf): ${flangeThickness} mm`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
        yOffset = addWrappedText(
          `• Web Thickness (tw): ${webThickness} mm`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
      } else if (beamCrossSection === "Circular") {
        yOffset = addWrappedText(`• Diameter: ${diameter} mm`, margin + 10, yOffset, contentWidth - 10, 6, 10)
      }

      yOffset += 5
      yOffset = addSubsectionHeader("Material:", margin, yOffset)
      yOffset = addWrappedText(`• Type: ${material}`, margin + 10, yOffset, contentWidth - 10, 6, 10)

      const materialProps = material === "Custom" ? customMaterial : standardMaterials[material]
      if (materialProps.yieldStrength > 0) {
        yOffset = addWrappedText(
          `• Yield Strength: ${materialProps.yieldStrength} MPa`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
        yOffset = addWrappedText(
          `• Elastic Modulus: ${materialProps.elasticModulus} GPa`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
        yOffset = addWrappedText(
          `• Density: ${materialProps.density} kg/m³`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
      }

      // 2. LOADING CONDITIONS
      yOffset += 10
      yOffset = addSectionHeader("2. LOADING CONDITIONS", margin, yOffset)
      yOffset += 5

      yOffset = addWrappedText(
        `Total Applied Load: ${results.totalAppliedLoad.toFixed(1)} N`,
        margin,
        yOffset,
        contentWidth,
        6,
        11,
      )
      yOffset += 3

      loads.forEach((load, index) => {
        let loadValue = 0
        let loadDescription = ""

        if (load.type === "Distributed Load" && load.area) {
          loadValue = load.magnitude * load.area
          loadDescription = `${load.magnitude} N/m² over ${load.area} m² area`
        } else if (load.type === "Uniform Load" && load.endPosition) {
          const loadLength = (load.endPosition - load.startPosition) / 1000
          loadValue = load.magnitude * loadLength
          loadDescription = `${load.magnitude} N/m over ${loadLength.toFixed(2)} m length`
        } else {
          loadValue = load.magnitude
          loadDescription = `${load.magnitude} N point load`
        }

        yOffset = addWrappedText(
          `Load ${index + 1}: ${loadDescription} = ${loadValue.toFixed(1)} N`,
          margin + 10,
          yOffset,
          contentWidth - 10,
          6,
          10,
        )
      })

      if (analysisType === "Base Frame") {
        yOffset += 3
        yOffset = addWrappedText(
          `Load per Member: ${results.loadPerBeam.toFixed(1)} N (distributed equally among 4 members)`,
          margin,
          yOffset,
          contentWidth,
          6,
          11,
        )
      }

      if (yOffset > pageHeight - 60) {
        pdf.addPage()
        yOffset = 30
      }

      // 3. ANALYSIS RESULTS
      yOffset += 15
      yOffset = addSectionHeader("3. ANALYSIS RESULTS", margin, yOffset)
      yOffset += 5

      // Create a results table
      const results_data = [
        ["Parameter", "Value", "Unit"],
        ["Maximum Shear Force", results.maxShearForce.toFixed(2), "N"],
        ["Maximum Bending Moment", results.maxBendingMoment.toFixed(2), "N·m"],
        ["Maximum Normal Stress", results.maxNormalStress.toFixed(2), "MPa"],
        ["Maximum Shear Stress", results.maxShearStress.toFixed(2), "MPa"],
        ["Safety Factor", results.safetyFactor.toFixed(2), "-"],
        ["Maximum Deflection", (results.maxDeflection * 1000).toFixed(3), "mm"],
        ["Moment of Inertia", results.momentOfInertia.toExponential(3), "m⁴"],
        ["Section Modulus", results.sectionModulus.toExponential(3), "m³"],
        ["Structure Weight", frameWeight.toFixed(2), "N"],
      ]

      if (analysisType === "Base Frame") {
        results_data.push(["Corner Reaction Force", results.cornerReactionForce.toFixed(2), "N"])
      }
      // Add table manually
      const tableStartY = yOffset
      const rowHeight = 8
      const colWidths = [contentWidth * 0.5, contentWidth * 0.3, contentWidth * 0.2]
      let currentY = tableStartY

      // Table header
      pdf.setFillColor(41, 128, 185)
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.rect(margin, currentY, contentWidth, rowHeight, "F")
      pdf.text(results_data[0][0], margin + 2, currentY + 5)
      pdf.text(results_data[0][1], margin + colWidths[0] + 2, currentY + 5)
      pdf.text(results_data[0][2], margin + colWidths[0] + colWidths[1] + 2, currentY + 5)
      currentY += rowHeight

      // Table body
      pdf.setTextColor(0, 0, 0)
      pdf.setFont("helvetica", "normal")
      results_data.slice(1).forEach((row, index) => {
        if (index % 2 === 0) {
          pdf.setFillColor(245, 245, 245)
          pdf.rect(margin, currentY, contentWidth, rowHeight, "F")
        }

        pdf.text(row[0], margin + 2, currentY + 5)
        pdf.text(row[1], margin + colWidths[0] + 2, currentY + 5)
        pdf.text(row[2], margin + colWidths[0] + colWidths[1] + 2, currentY + 5)
        currentY += rowHeight
      })

      // Add border around table
      pdf.setDrawColor(0, 0, 0)
      pdf.rect(margin, tableStartY, contentWidth, currentY - tableStartY)

      yOffset = currentY + 20

      // 4. STRUCTURAL DIAGRAMS
      pdf.addPage()
      yOffset = 30
      yOffset = addSectionHeader("4. STRUCTURAL DIAGRAMS", margin, yOffset)
      yOffset += 10

      // Structure Diagram
      yOffset = addSubsectionHeader("4.1 Structure Layout", margin, yOffset)
      yOffset += 15
      let structureImg: string | null = null
      if (analysisType === "Simple Beam") {
        const svg = document.getElementById("beam-structure-diagram") as SVGSVGElement | null
        if (!svg) throw new Error("Beam structure diagram SVG not found in DOM")
        structureImg = await captureSVGAsImage("beam-structure-diagram", 500, 250)
        if (!structureImg) throw new Error("Failed to capture beam structure diagram image")
        const origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500;
        const origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 250;
        const aspect = origHeight / origWidth;
        const diagramWidth = 200;
        const diagramHeight = Math.round(diagramWidth * aspect);
        const diagramX = (pageWidth - diagramWidth) / 2;
        // Light gray background
        pdf.setFillColor(240, 240, 240);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "F");
        pdf.addImage(structureImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        yOffset += diagramHeight + 15;
      } else {
        const svg = document.getElementById("frame-structure-diagram") as SVGSVGElement | null
        if (!svg) throw new Error("Frame structure diagram SVG not found in DOM")
        structureImg = await captureSVGAsImage("frame-structure-diagram", 500, 450)
        if (!structureImg) throw new Error("Failed to capture frame structure diagram image")
        const origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500;
        const origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 450;
        const aspect = origHeight / origWidth;
        const diagramWidth = 200;
        const diagramHeight = Math.round(diagramWidth * aspect);
        const diagramX = (pageWidth - diagramWidth) / 2;
        pdf.setFillColor(240, 240, 240);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "F");
        pdf.addImage(structureImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        yOffset += diagramHeight + 15;
      }

      // Corner Loads Diagram (for Base Frame only)
      if (analysisType === "Base Frame") {
        // Estimate required height for header + diagram + padding
        const diagramHeaderHeight = 10;
        const diagramPadding = 15;
        const diagramWidth = 200;
        const svg = document.getElementById("corner-loads-diagram") as SVGSVGElement | null;
        let origWidth = 500, origHeight = 450, aspect = origHeight / origWidth;
        if (svg) {
          origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500;
          origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 450;
          aspect = origHeight / origWidth;
        }
        const diagramHeight = Math.round(diagramWidth * aspect);
        const requiredHeight = diagramHeaderHeight + diagramHeight + diagramPadding + 10;
        if (yOffset + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yOffset = 30;
        }
        yOffset = addSubsectionHeader("4.2 Corner Loads Analysis", margin, yOffset)
        yOffset += 15
        if (svg) {
          const cornerImg = await captureSVGAsImage("corner-loads-diagram", origWidth, origHeight)
          if (cornerImg) {
            const diagramX = (pageWidth - diagramWidth) / 2;
            pdf.setFillColor(240, 240, 240);
            pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "F");
            pdf.addImage(cornerImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
            yOffset += diagramHeight + 15;
          }
        }
      }

      // 5. FORCE DIAGRAMS
      pdf.addPage()
      yOffset = 30
      yOffset = addSectionHeader("5. FORCE DIAGRAMS", margin, yOffset)
      yOffset += 10

      // Shear Force Diagram
      yOffset = addSubsectionHeader("5.1 Shear Force Diagram", margin, yOffset)
      yOffset += 15
      try {
        const container = document.getElementById("shear-force-diagram");
        const svg = container?.querySelector("svg") as SVGSVGElement | null;
        if (!svg) throw new Error("Shear force diagram SVG not found in DOM");
        const origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248;
        const origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300;
        const aspect = origHeight / origWidth;
        const diagramWidth = 180;
        const diagramHeight = Math.round(diagramWidth * aspect);
        const diagramX = (pageWidth - diagramWidth) / 2;
        const img = await svgToPngDataUrl(svg, origWidth, origHeight);
        pdf.setFillColor(240, 240, 240);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "F");
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        yOffset += diagramHeight + 15;
      } catch (err) {
        yOffset = addWrappedText("[Shear Force Diagram could not be captured]", margin, yOffset, contentWidth, 6, 10);
        yOffset += 10;
      }

      // Bending Moment Diagram
      yOffset = addSubsectionHeader("5.2 Bending Moment Diagram", margin, yOffset)
      yOffset += 15
      try {
        const container = document.getElementById("bending-moment-diagram");
        const svg = container?.querySelector("svg") as SVGSVGElement | null;
        if (!svg) throw new Error("Bending moment diagram SVG not found in DOM");
        const origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248;
        const origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300;
        const aspect = origHeight / origWidth;
        const diagramWidth = 180;
        const diagramHeight = Math.round(diagramWidth * aspect);
        const diagramX = (pageWidth - diagramWidth) / 2;
        const img = await svgToPngDataUrl(svg, origWidth, origHeight);
        pdf.setFillColor(240, 240, 240);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "F");
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        yOffset += diagramHeight + 15;
      } catch (err) {
        yOffset = addWrappedText("[Bending Moment Diagram could not be captured]", margin, yOffset, contentWidth, 6, 10);
        yOffset += 10;
      }

      // Deflection Diagram
      yOffset = addSubsectionHeader("5.3 Deflection Diagram", margin, yOffset)
      yOffset += 15
      try {
        const container = document.getElementById("deflection-diagram");
        const svg = container?.querySelector("svg") as SVGSVGElement | null;
        if (!svg) throw new Error("Deflection diagram SVG not found in DOM");
        const origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248;
        const origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300;
        const aspect = origHeight / origWidth;
        const diagramWidth = 180;
        const diagramHeight = Math.round(diagramWidth * aspect);
        const diagramX = (pageWidth - diagramWidth) / 2;
        const img = await svgToPngDataUrl(svg, origWidth, origHeight);
        pdf.setFillColor(240, 240, 240);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "F");
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        yOffset += diagramHeight + 15;
      } catch (err) {
        yOffset = addWrappedText("[Deflection Diagram could not be captured]", margin, yOffset, contentWidth, 6, 10);
        yOffset += 10;
      }

      // Add page numbers to all pages
      const pageCount = pdf.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "italic")
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" })
      }

      // Save the PDF
      const fileName = `${analysisType.toLowerCase().replace(" ", "_")}_analysis_report_${new Date().toISOString().split("T")[0]}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Error generating PDF report. Please try again.\n" + error)
    } finally {
      setIsGeneratingPDF(false)
    }
  }
  return (
    <div className="container mx-auto p-2" style={{ fontFamily: '"Chesna Grotesk", sans-serif' }}>
      <Head>
        <title>Load Calculator</title>
        <link rel="icon" href="/placeholder-logo.png" />
      </Head>
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">Enhanced Load Calculator</h1>
        <div className="flex items-center gap-2">
          <a href="mailto:hbradroc@uwo.ca" title="Email hbradroc@uwo.ca" className="text-gray-700 hover:text-blue-600 flex items-center">
            <Mail className="w-4 h-4 mr-1" />
            <span className="text-xs font-medium hidden sm:inline">hbradroc@uwo.ca</span>
          </a>
          <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF} size="sm">
            {isGeneratingPDF ? "Generating PDF..." : "Download PDF Report"}
          </Button>
          <HelpDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Configuration Card */}
        <Card className="p-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Calculations - Configuration</CardTitle>
            <CardDescription className="text-sm">Select analysis type and enter beam properties.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-2">
            <div className="grid grid-cols-2 gap-2">
              <Label htmlFor="analysis-type">Analysis Type</Label>
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger id="analysis-type">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Simple Beam">Simple Beam</SelectItem>
                  <SelectItem value="Base Frame">Base Frame</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {analysisType === "Simple Beam" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="beam-length">Beam Length (mm)</Label>
                  <Input
                    type="number"
                    id="beam-length"
                    value={beamLength}
                    onChange={(e) => setBeamLength(validatePositive(Number(e.target.value), 1000))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="left-support">Left Support (mm)</Label>
                  <Input
                    type="number"
                    id="left-support"
                    value={leftSupport}
                    onChange={(e) => setLeftSupport(validateNumber(Number(e.target.value), 0))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="right-support">Right Support (mm)</Label>
                  <Input
                    type="number"
                    id="right-support"
                    value={rightSupport}
                    onChange={(e) => setRightSupport(validatePositive(Number(e.target.value), beamLength))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="frame-length">Frame Length (mm)</Label>
                  <Input
                    type="number"
                    id="frame-length"
                    value={frameLength}
                    onChange={(e) => setFrameLength(validatePositive(Number(e.target.value), 2000))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="frame-width">Frame Width (mm)</Label>
                  <Input
                    type="number"
                    id="frame-width"
                    value={frameWidth}
                    onChange={(e) => setFrameWidth(validatePositive(Number(e.target.value), 1000))}
                  />
                </div>

              </>
            )}
          </CardContent>
        </Card>

        {/* Cross-Section Dimensions Card */}
        <Card className="p-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Cross-Section Dimensions</CardTitle>
            <CardDescription className="text-sm">Enter the dimensions of the beam cross-section.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-2">
            <div className="grid grid-cols-2 gap-2">
              <Label htmlFor="beam-cross-section">Cross Section</Label>
              <Select value={beamCrossSection} onValueChange={setBeamCrossSection}>
                <SelectTrigger id="beam-cross-section">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rectangular">Rectangular</SelectItem>
                  <SelectItem value="I Beam">I-Beam</SelectItem>
                  <SelectItem value="C Channel">C-Channel</SelectItem>
                  <SelectItem value="Circular">Circular</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <BeamCrossSectionImage type={beamCrossSection} />
            </div>

            {beamCrossSection === "Rectangular" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="width">Width (mm)</Label>
                  <Input
                    type="number"
                    id="width"
                    value={width}
                    onChange={(e) => setWidth(validatePositive(Number(e.target.value), 100))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="height">Height (mm)</Label>
                  <Input
                    type="number"
                    id="height"
                    value={height}
                    onChange={(e) => setHeight(validatePositive(Number(e.target.value), 218))}
                  />
                </div>
              </>
            )}

            {(beamCrossSection === "I Beam" || beamCrossSection === "C Channel") && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="height">Height (H, mm)</Label>
                  <Input
                    type="number"
                    id="height"
                    value={height}
                    onChange={(e) => setHeight(validatePositive(Number(e.target.value), 218))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="flange-width">Flange Width (bf, mm)</Label>
                  <Input
                    type="number"
                    id="flange-width"
                    value={flangeWidth}
                    onChange={(e) => setFlangeWidth(validatePositive(Number(e.target.value), 66))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="flange-thickness">Flange Thickness (tf, mm)</Label>
                  <Input
                    type="number"
                    id="flange-thickness"
                    value={flangeThickness}
                    onChange={(e) => setFlangeThickness(validatePositive(Number(e.target.value), 3))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="web-thickness">Web Thickness (tw, mm)</Label>
                  <Input
                    type="number"
                    id="web-thickness"
                    value={webThickness}
                    onChange={(e) => setWebThickness(validatePositive(Number(e.target.value), 44.8))}
                  />
                </div>
              </>
            )}

            {beamCrossSection === "Circular" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="diameter">Diameter (D, mm)</Label>
                  <Input
                    type="number"
                    id="diameter"
                    value={diameter}
                    onChange={(e) => setDiameter(validatePositive(Number(e.target.value), 100))}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Loads Card */}
        <Card className="p-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Loads</CardTitle>
            <CardDescription className="text-sm">Add and manage loads applied to the beam.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-2">
            {loads.map((load, index) => (
              <div key={index} className="border p-2 rounded-md">
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor={`load-type-${index}`}>Load Type</Label>
                  <Select
                    value={load.type}
                    onValueChange={(value) => updateLoad(index, { type: value as Load["type"] })}
                  >
                    <SelectTrigger id={`load-type-${index}`}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Point Load">Point Load</SelectItem>
                      <SelectItem value="Uniform Load">Uniform Load</SelectItem>
                      <SelectItem value="Distributed Load">Distributed Load</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor={`load-magnitude-${index}`}>Magnitude (N)</Label>
                  <Input
                    type="number"
                    id={`load-magnitude-${index}`}
                    value={load.magnitude}
                    onChange={(e) => updateLoad(index, { magnitude: validateNumber(Number(e.target.value), 1000) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor={`load-position-${index}`}>Start Position (mm)</Label>
                  <Input
                    type="number"
                    id={`load-position-${index}`}
                    value={load.startPosition}
                    onChange={(e) =>
                      updateLoad(index, {
                        startPosition: validateNumber(
                          Number(e.target.value),
                          analysisType === "Simple Beam" ? beamLength / 2 : frameLength / 2,
                        ),
                      })
                    }
                  />
                </div>
                {load.type === "Uniform Load" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Label htmlFor={`load-end-position-${index}`}>End Position (mm)</Label>
                    <Input
                      type="number"
                      id={`load-end-position-${index}`}
                      value={load.endPosition || load.startPosition + 100}
                      onChange={(e) =>
                        updateLoad(index, {
                          endPosition: validateNumber(Number(e.target.value), load.startPosition + 100),
                        })
                      }
                    />
                  </div>
                )}
                {load.type === "Distributed Load" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Label htmlFor={`load-area-${index}`}>Area (m²)</Label>
                    <Input
                      type="number"
                      id={`load-area-${index}`}
                      min={0.1}
                      step={0.1}
                      max={((analysisType === "Base Frame" ? frameLength * frameWidth : beamLength * width) / 1_000_000).toFixed(2)}
                      value={load.area || 0.5}
                      onChange={(e) => {
                        let val = Math.max(0.1, Number(e.target.value));
                        const maxArea = (analysisType === "Base Frame" ? frameLength * frameWidth : beamLength * width) / 1_000_000;
                        if (val > maxArea) val = maxArea;
                        updateLoad(index, { area: val });
                      }}
                    />
                  </div>
                )}
                <Button variant="destructive" size="sm" onClick={() => removeLoad(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button onClick={addLoad} disabled={loads.length >= 10}>
              Add Load
            </Button>
          </CardContent>
        </Card>

        {/* Material Properties Card */}
        <Card className="p-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Material Properties</CardTitle>
            <CardDescription className="text-sm">Select material and view its properties.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-2">
            <div className="grid grid-cols-2 gap-2">
              <Label htmlFor="material">Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger id="material">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(standardMaterials).map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {material === "Custom" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="yield-strength">Yield Strength (MPa)</Label>
                  <Input
                    type="number"
                    id="yield-strength"
                    value={customMaterial.yieldStrength}
                    onChange={(e) =>
                      setCustomMaterial({ ...customMaterial, yieldStrength: validateNumber(Number(e.target.value), 0) })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="elastic-modulus">Elastic Modulus (GPa)</Label>
                  <Input
                    type="number"
                    id="elastic-modulus"
                    value={customMaterial.elasticModulus}
                    onChange={(e) =>
                      setCustomMaterial({
                        ...customMaterial,
                        elasticModulus: validateNumber(Number(e.target.value), 0),
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label htmlFor="density">Density (kg/m³)</Label>
                  <Input
                    type="number"
                    id="density"
                    value={customMaterial.density}
                    onChange={(e) =>
                      setCustomMaterial({ ...customMaterial, density: validateNumber(Number(e.target.value), 0) })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Label>Yield Strength (MPa)</Label>
                  <Input type="text" value={standardMaterials[material].yieldStrength} readOnly />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label>Elastic Modulus (GPa)</Label>
                  <Input type="text" value={standardMaterials[material].elasticModulus} readOnly />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Label>Density (kg/m³)</Label>
                  <Input type="text" value={standardMaterials[material].density} readOnly />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card className="p-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Results</CardTitle>
            <CardDescription className="text-sm">View the calculated results.</CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <table className="w-full text-sm border-separate border-spacing-y-1">
              <tbody>
                <tr><td className="font-medium pr-4">Max Shear Force (N)</td><td>{results.maxShearForce}</td></tr>
                <tr><td className="font-medium pr-4">Max Bending Moment (N·m)</td><td>{results.maxBendingMoment}</td></tr>
                <tr><td className="font-medium pr-4">Max Normal Stress (MPa)</td><td>{results.maxNormalStress}</td></tr>
                <tr><td className="font-medium pr-4">Max Shear Stress (MPa)</td><td>{results.maxShearStress}</td></tr>
                <tr><td className="font-medium pr-4">Safety Factor</td><td>{results.safetyFactor}</td></tr>
                <tr><td className="font-medium pr-4">Max Deflection (mm)</td><td>{(results.maxDeflection * 1000).toFixed(3)}</td></tr>
                <tr><td className="font-medium pr-4">Structure Weight (N)</td><td>{frameWeight}</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Diagrams Section */}
      <div className="mt-4">
        <h2 className="text-xl font-semibold mb-2">Diagrams</h2>

        {/* Structure Diagram */}
        <div className="mb-2">
          <h3 className="text-lg font-semibold mb-1">Structure Diagram</h3>
          {analysisType === "Simple Beam" ? (
            <BeamDiagram beamLength={beamLength} leftSupport={leftSupport} rightSupport={rightSupport} loads={loads} />
          ) : (
            <FrameDiagram frameLength={frameLength} frameWidth={frameWidth} loads={loads} />
          )}
        </div>

        {/* Corner Loads Diagram (for Base Frame only) */}
        {analysisType === "Base Frame" && (
          <div className="mb-2">
            <h3 className="text-lg font-semibold mb-1">Corner Loads Diagram</h3>
            <CornerLoadsDiagram
              frameLength={frameLength}
              frameWidth={frameWidth}
              loads={loads}
              cornerReactionForce={results.cornerReactionForce}
            />
          </div>
        )}

        {/* Shear Force Diagram */}
        <div className="mb-2">
          <h3 className="text-lg font-semibold mb-1">Shear Force Diagram</h3>
          <div id="shear-force-diagram" style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              {shearForceData.length > 0 && (
                <AreaChart data={shearForceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" label={{ value: "Position (mm)", position: "insideBottom", offset: -5 }} />
                  <YAxis label={{ value: "Shear Force (N)", angle: -90, position: "insideLeft", offset: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="y" stroke="#8884d8" fill="#8884d8" />
                  <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bending Moment Diagram */}
        <div className="mb-2">
          <h3 className="text-lg font-semibold mb-1">Bending Moment Diagram</h3>
          <div id="bending-moment-diagram" style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              {bendingMomentData.length > 0 && (
                <AreaChart data={bendingMomentData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" label={{ value: "Position (mm)", position: "insideBottom", offset: -5 }} />
                  <YAxis label={{ value: "Bending Moment (N·m)", angle: -90, position: "insideLeft", offset: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="y" stroke="#82ca9d" fill="#82ca9d" />
                  <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Deflection Diagram */}
        <div className="mb-2">
          <h3 className="text-lg font-semibold mb-1">Deflection Diagram</h3>
          <div id="deflection-diagram" style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              {deflectionData.length > 0 && (
                <AreaChart data={deflectionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" label={{ value: "Position (mm)", position: "insideBottom", offset: -5 }} />
                  <YAxis label={{ value: "Deflection (mm)", angle: -90, position: "insideLeft", offset: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="y" stroke="#ff7300" fill="#ff7300" />
                  <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>


    </div>
  )
}
