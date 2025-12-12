"use client"

import { useCallback } from "react"

import { useEffect } from "react"

import { useState } from "react"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { HelpCircle, Calculator, Settings, Loader2, FileText, BarChart3, Ruler, Package, Mail, Download, Info } from "lucide-react"
import { jsPDF } from "jspdf"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import Head from "next/head"

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
  area?: number // For backward compatibility and simple beam
  loadLength?: number // Length of distributed load component (mm) - for baseframe
  loadWidth?: number // Width of distributed load component (mm) - for baseframe
  unit?: "N" | "kg" // Add unit field
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
              <div className="mt-2">
                <h4 className="font-medium">Deflection at any position (x):</h4>
                <p className="text-sm text-gray-600 mb-1">For a point load P at position a:</p>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                  δ(x) = {`{P·b·x·(L²-b²-x²) / (6·L·E·I)`} for x ≤ a<br/>
                  δ(x) = {`{P·a·(L-x)·(2Lx-x²-a²) / (6·L·E·I)`} for x &gt; a
                </p>
                <p className="text-sm text-gray-600 mb-1">For multiple point loads, sum the deflection from each load at each position (superposition).</p>
                <p className="text-sm text-gray-600 mb-1">For uniform load over the entire span:</p>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                  δ(x) = {`w·x·(L³-2Lx²+x³) / (24·E·I)`}
                </p>
                <p className="text-sm text-gray-600">For multiple loads, total deflection is the sum of all contributions at each position.</p>
              </div>
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
          const x = margin + loadStartPos * scaleX - (loadLengthMM * scaleX) / 2;
          const y = margin + 30 + (validFrameWidth * scaleY) / 2 - (loadWidthMM * scaleY) / 2;
          const loadValue = load.magnitude * loadArea;
          return (
            <g key={index}>
              <rect
                x={Math.max(margin, validateNumber(x, margin))}
                y={Math.max(margin + 30, validateNumber(y, margin + 30))}
                width={validatePositive(Math.min(loadLengthMM * scaleX, validFrameLength * scaleX), 10)}
                height={validatePositive(Math.min(loadWidthMM * scaleY, validFrameWidth * scaleY), 10)}
                fill="rgba(255, 0, 0, 0.3)"
                stroke="red"
                strokeWidth="1"
              />
              <text
                x={
                  Math.max(margin, validateNumber(x, margin)) +
                  validatePositive(Math.min(loadLengthMM * scaleX, validFrameLength * scaleX), 10) / 2
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
  cornerReactions?: { R1: number; R2: number; R3: number; R4: number }
}

const CornerLoadsDiagram: React.FC<CornerLoadsDiagramProps> = ({
  frameLength,
  frameWidth,
  loads,
  cornerReactionForce,
  cornerReactions,
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
        { x: frameRect.x, y: frameRect.y, label: "R1", reaction: cornerReactions?.R1 || cornerReactionForce },
        { x: frameRect.x + frameRect.width, y: frameRect.y, label: "R2", reaction: cornerReactions?.R2 || cornerReactionForce },
        { x: frameRect.x, y: frameRect.y + frameRect.height, label: "R3", reaction: cornerReactions?.R3 || cornerReactionForce },
        { x: frameRect.x + frameRect.width, y: frameRect.y + frameRect.height, label: "R4", reaction: cornerReactions?.R4 || cornerReactionForce },
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
            {corner.reaction.toFixed(0)}N
          </text>
        </g>
      ))}

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
          const x = margin + loadStartPos * scaleX - (loadLengthMM * scaleX) / 2;
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
              <text
                x={
                  Math.max(margin, validateNumber(x, margin)) +
                  validatePositive(Math.min(loadLengthMM * scaleX, validFrameLength * scaleX), 10) / 2
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
    try {
      // Clone the SVG to avoid modifying the original
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      
      // Get actual dimensions from SVG
      const svgWidth = svg.getAttribute('width') 
        ? parseFloat(svg.getAttribute('width')!) 
        : svg.viewBox?.baseVal?.width || width;
      const svgHeight = svg.getAttribute('height') 
        ? parseFloat(svg.getAttribute('height')!) 
        : svg.viewBox?.baseVal?.height || height;
      
      // Ensure cloned SVG has explicit width and height for proper rendering
      if (!clonedSvg.hasAttribute('width')) {
        clonedSvg.setAttribute('width', svgWidth.toString());
      }
      if (!clonedSvg.hasAttribute('height')) {
        clonedSvg.setAttribute('height', svgHeight.toString());
      }
      
      // Preserve viewBox if it exists
      if (svg.viewBox?.baseVal) {
        const viewBox = svg.viewBox.baseVal;
        clonedSvg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
      }
      
      // Set preserveAspectRatio if it exists
      if (svg.hasAttribute('preserveAspectRatio')) {
        clonedSvg.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio')!);
      } else {
        clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      
      // Serialize the SVG
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clonedSvg);
      
      // Remove any script tags for security
      svgString = svgString.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      
      // Add XML declaration for compatibility
      if (!svgString.startsWith('<?xml')) {
        svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;
      }
      
      // Use a more robust encoding method
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new window.Image();
      
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error('SVG to image conversion timeout'));
      }, 10000); // 10 second timeout
      
      img.onload = function () {
        clearTimeout(timeout);
        try {
          // Use higher resolution for better quality (2x for retina-like quality)
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d', { 
            willReadFrequently: false,
            alpha: false // Opaque background for better PDF compatibility
          });
          
          if (!ctx) {
            URL.revokeObjectURL(url);
            return reject(new Error('Canvas context not available'));
          }
          
          // White background for PDF
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Enable image smoothing for better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw the image scaled up
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Get the data URL
          const dataUrl = canvas.toDataURL('image/png', 1.0); // Maximum quality
          
          // Clean up
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(new Error(`Failed to convert SVG to PNG: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      
      img.onerror = function (e) {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG as image. The SVG may contain unsupported elements or external resources.'));
      };
      
      img.src = url;
    } catch (error) {
      reject(new Error(`SVG conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
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
  const [loads, setLoads] = useState<Load[]>([{ type: "Point Load", magnitude: 1000, startPosition: 500, unit: "N" }])
  const [shearForceData, setShearForceData] = useState<Array<{ x: number; y: number }>>([])
  const [bendingMomentData, setBendingMomentData] = useState<Array<{ x: number; y: number }>>([])
  const [deflectionData, setDeflectionData] = useState<Array<{ x: number; y: number }>>([])
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
    cornerReactions: { R1: 0, R2: 0, R3: 0, R4: 0 }, // Individual corner reactions
    maxDeflection: 0,
    totalAppliedLoad: 0,
  })
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // Helper function to convert kg to N
  const kgToN = (kg: number): number => kg * 9.81

  // Helper function to convert N to kg
  const nToKg = (n: number): number => n / 9.81

  // Helper function to get load magnitude in N
  const getLoadMagnitudeInN = (load: Load): number => {
    return load.unit === "kg" ? kgToN(load.magnitude) : load.magnitude
  }

  // Reset loads when analysis type changes
  useEffect(() => {
    if (analysisType === "Simple Beam") {
      setLoads([{ type: "Point Load", magnitude: 1000, startPosition: 500, unit: "N" }])
    } else {
      // For base frame, start first load at position 0
      setLoads([{ type: "Distributed Load", magnitude: 1000, startPosition: 0, loadLength: 500, loadWidth: frameWidth, unit: "N" }])
    }
  }, [analysisType, frameWidth])

  const addLoad = () => {
    if (loads.length < 10) {
      // Calculate the end position of the last load to set as start position for new load
      let nextStartPosition = 0
      
      if (loads.length > 0) {
        const lastLoad = loads[loads.length - 1]
        
        if (lastLoad.type === "Distributed Load") {
          if (analysisType === "Base Frame" && lastLoad.loadLength) {
            // For base frame: end position = startPosition + loadLength
            nextStartPosition = lastLoad.startPosition + lastLoad.loadLength
          } else if (lastLoad.area) {
            // For simple beam: calculate length from area (assuming square)
            const sideLengthMM = Math.sqrt(lastLoad.area) * 1000
            nextStartPosition = lastLoad.startPosition + sideLengthMM
          } else {
            // Fallback: use startPosition + default length
            nextStartPosition = lastLoad.startPosition + 500
          }
        } else if (lastLoad.type === "Uniform Load" && lastLoad.endPosition) {
          // For uniform load: end position is explicitly defined
          nextStartPosition = lastLoad.endPosition
        } else {
          // For point load: use startPosition (point loads have no length)
          // But for sequential loads, we'll add a small offset
          nextStartPosition = lastLoad.startPosition + 100
        }
      } else {
        // First load starts at 0
        nextStartPosition = 0
      }
      
      // Ensure the start position doesn't exceed the frame/beam length
      const maxLength = analysisType === "Simple Beam" ? beamLength : frameLength
      nextStartPosition = Math.min(nextStartPosition, maxLength)
      
      const newLoad: Load =
        analysisType === "Simple Beam"
          ? { type: "Point Load", magnitude: 1000, startPosition: nextStartPosition, unit: "N" }
          : analysisType === "Base Frame"
          ? { type: "Distributed Load", magnitude: 1000, startPosition: nextStartPosition, loadLength: 500, loadWidth: frameWidth, unit: "N" }
          : { type: "Distributed Load", magnitude: 1000, startPosition: nextStartPosition, area: 0.5, unit: "N" }
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
          if (newLoad.type === "Distributed Load") {
            // For baseframe, use length and width; for simple beam, use area
            if (analysisType === "Base Frame") {
              if (!newLoad.loadLength) {
                newLoad.loadLength = 500 // Default 500mm length
              }
              if (!newLoad.loadWidth) {
                newLoad.loadWidth = frameWidth // Default to frame width
              }
            } else {
              // For simple beam, use area
              if (!newLoad.area) {
                newLoad.area = 0.5
              }
            }
          }
          if (!newLoad.unit) {
            newLoad.unit = "N"
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

    // Calculate total applied loads (convert to N if needed)
    let totalAppliedLoad = 0
    loads.forEach((load) => {
      const magnitudeInN = getLoadMagnitudeInN(load)
      if (load.type === "Distributed Load") {
        // For distributed loads: magnitude (N/m²) × area (m²) = total load (N)
        let loadArea = 0
        if (analysisType === "Base Frame" && load.loadLength && load.loadWidth) {
          // For baseframe: use length × width
          loadArea = (load.loadLength * load.loadWidth) / 1_000_000 // Convert mm² to m²
        } else if (load.area) {
          // For simple beam: use area directly
          loadArea = load.area
        }
        if (loadArea > 0) {
          totalAppliedLoad += magnitudeInN * loadArea
        }
      } else if (load.type === "Uniform Load" && load.endPosition) {
        // For uniform loads: magnitude (N/m) × length (m) = total load (N)
        const loadLength = (load.endPosition - load.startPosition) / 1000
        totalAppliedLoad += magnitudeInN * loadLength
      } else {
        // For point loads: magnitude is already in Newtons
        totalAppliedLoad += magnitudeInN
      }
    })

    let maxShearForce = 0
    let maxBendingMoment = 0
    let frameWeightN = 0
    let totalBeams = 0
    let loadPerBeam = 0
    let cornerReactionForce = 0
    let cornerReactions = { R1: 0, R2: 0, R3: 0, R4: 0 }

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
        const magnitudeInN = getLoadMagnitudeInN(load)

        if (load.type === "Point Load") {
          const a = loadStartPositionM - leftSupportM
          const b = rightSupportM - loadStartPositionM
          if (spanLength > 0) {
            R1 += (magnitudeInN * b) / spanLength
            R2 += (magnitudeInN * a) / spanLength
          }
        } else if (load.type === "Uniform Load") {
          const loadEndPositionM = load.endPosition! / 1000
          const loadStartM = Math.max(loadStartPositionM, leftSupportM)
          const loadEndM = Math.min(loadEndPositionM, rightSupportM)

          if (loadEndM > loadStartM) {
            const loadLengthM = loadEndM - loadStartM
            const totalLoad = magnitudeInN * loadLengthM
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
          const magnitudeInN = getLoadMagnitudeInN(load)
          if (load.type === "Point Load" && x > load.startPosition / 1000) {
            moment -= magnitudeInN * (x - load.startPosition / 1000)
          } else if (load.type === "Uniform Load") {
            const loadStartM = load.startPosition / 1000
            const loadEndM = load.endPosition! / 1000
            if (x > loadStartM) {
              const loadedLength = Math.min(x - loadStartM, loadEndM - loadStartM)
              const loadCentroid = loadStartM + loadedLength / 2
              moment -= magnitudeInN * loadedLength * (x - loadCentroid)
            }
          }
        })

        maxBendingMoment = Math.max(maxBendingMoment, Math.abs(moment))
      }
    } else {
      // Base frame analysis - Calculate corner reactions based on load positions
      totalBeams = 4
      const framePerimeter = 2 * (frameLengthM + frameWidthM)
      frameWeightN = beamVolume * framePerimeter * beamDensity * 9.81

      // Initialize corner reactions (R1=top-left, R2=top-right, R3=bottom-left, R4=bottom-right)
      let R1 = 0, R2 = 0, R3 = 0, R4 = 0

      // Distribute each load to corners based on its position
      loads.forEach((load) => {
        const magnitudeInN = getLoadMagnitudeInN(load)
        let loadWeight = 0
        let loadCenterX = 0
        let loadCenterY = frameWidthM / 2 // Default to center in width

        if (load.type === "Distributed Load") {
          let loadLengthMM = 0
          let loadWidthMM = 0
          
          if (load.loadLength && load.loadWidth) {
            // For baseframe: use length and width
            loadLengthMM = validatePositive(load.loadLength, 100)
            loadWidthMM = validatePositive(load.loadWidth, 100)
            loadWeight = magnitudeInN * (loadLengthMM * loadWidthMM) / 1_000_000
            // Load center position
            loadCenterX = (load.startPosition + loadLengthMM / 2) / 1000 // Convert to meters
            loadCenterY = (frameWidth - loadWidthMM / 2) / 1000 // Convert to meters, from top
          } else if (load.area) {
            // For simple beam compatibility: assume square load
            const sideLengthMM = Math.sqrt(validatePositive(load.area, 1)) * 1000
            loadWeight = magnitudeInN * load.area
            loadCenterX = (load.startPosition + sideLengthMM / 2) / 1000
            loadCenterY = frameWidthM / 2
          } else {
            return // Skip invalid load
          }
        } else if (load.type === "Point Load") {
          loadWeight = magnitudeInN
          loadCenterX = load.startPosition / 1000
          loadCenterY = frameWidthM / 2
        } else if (load.type === "Uniform Load" && load.endPosition) {
          const loadLengthM = (load.endPosition - load.startPosition) / 1000
          loadWeight = magnitudeInN * loadLengthM
          loadCenterX = (load.startPosition + load.endPosition) / 2000
          loadCenterY = frameWidthM / 2
        } else {
          return // Skip invalid load
        }

        // Distribute load to corners based on position using area method
        // Each corner gets load proportional to the area of rectangle from that corner to load center
        // R1 (top-left): area from (0,0) to (loadCenterX, loadCenterY)
        const areaR1 = loadCenterX * loadCenterY
        // R2 (top-right): area from (loadCenterX, 0) to (frameLengthM, loadCenterY)
        const areaR2 = (frameLengthM - loadCenterX) * loadCenterY
        // R3 (bottom-left): area from (0, loadCenterY) to (loadCenterX, frameWidthM)
        const areaR3 = loadCenterX * (frameWidthM - loadCenterY)
        // R4 (bottom-right): area from (loadCenterX, loadCenterY) to (frameLengthM, frameWidthM)
        const areaR4 = (frameLengthM - loadCenterX) * (frameWidthM - loadCenterY)

        const totalArea = frameLengthM * frameWidthM

        if (totalArea > 0) {
          R1 += loadWeight * (areaR1 / totalArea)
          R2 += loadWeight * (areaR2 / totalArea)
          R3 += loadWeight * (areaR3 / totalArea)
          R4 += loadWeight * (areaR4 / totalArea)
        }
      })

      // Add frame weight distributed equally to all corners
      const frameWeightPerCorner = frameWeightN / 4
      R1 += frameWeightPerCorner
      R2 += frameWeightPerCorner
      R3 += frameWeightPerCorner
      R4 += frameWeightPerCorner

      // Calculate critical beam length (longer of the two sides)
      const criticalBeamLength = Math.max(frameLengthM, frameWidthM)

      // For analysis, use the maximum corner reaction
      const maxCornerReaction = Math.max(R1, R2, R3, R4)
      
      // Calculate equivalent uniform load for critical beam analysis
      // This is used for stress calculations
      loadPerBeam = totalAppliedLoad / 4
      const uniformLoadPerMeter = loadPerBeam / criticalBeamLength
      maxShearForce = (uniformLoadPerMeter * criticalBeamLength) / 2
      maxBendingMoment = (uniformLoadPerMeter * Math.pow(criticalBeamLength, 2)) / 8

      // Store individual corner reactions
      cornerReactionForce = maxCornerReaction
      cornerReactions = { R1, R2, R3, R4 }
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
      cornerReactionForce: Number(cornerReactionForce.toFixed(2)),
      cornerReactions: {
        R1: Number(cornerReactions.R1.toFixed(2)),
        R2: Number(cornerReactions.R2.toFixed(2)),
        R3: Number(cornerReactions.R3.toFixed(2)),
        R4: Number(cornerReactions.R4.toFixed(2)),
      },
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
        const magnitudeInN = getLoadMagnitudeInN(load)
        if (load.type === "Point Load") {
          const a = loadStartPositionM - leftSupportM
          const b = rightSupportM - loadStartPositionM
          if (spanLength > 0) {
            R1 += (magnitudeInN * b) / spanLength
            R2 += (magnitudeInN * a) / spanLength
          }
        } else if (load.type === "Uniform Load") {
          const loadEndPositionM = load.endPosition! / 1000
          const loadStartM = Math.max(loadStartPositionM, leftSupportM)
          const loadEndM = Math.min(loadEndPositionM, rightSupportM)
          if (loadEndM > loadStartM) {
            const loadLengthM = loadEndM - loadStartM
            const totalLoad = magnitudeInN * loadLengthM
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

      // Calculate E and I for deflection
      const materialProps = material === "Custom" ? customMaterial : standardMaterials[material]
      const E = materialProps.elasticModulus * 1e9 // Pa
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
          const magnitudeInN = getLoadMagnitudeInN(load)
          if (load.type === "Point Load" && xM >= load.startPosition / 1000) {
            shear -= magnitudeInN
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
          const magnitudeInN = getLoadMagnitudeInN(load)
          if (load.type === "Point Load" && xM > load.startPosition / 1000) {
            moment -= magnitudeInN * (xM - load.startPosition / 1000)
          } else if (load.type === "Uniform Load") {
            const loadStartM = load.startPosition / 1000
            const loadEndM = load.endPosition! / 1000
            if (xM > loadStartM) {
              const loadedLength = Math.min(xM - loadStartM, loadEndM - loadStartM)
              const loadCentroid = loadStartM + loadedLength / 2
              moment -= magnitudeInN * loadedLength * (xM - loadCentroid)
            }
          }
        })
        // Deflection: superposition for all point and uniform loads
        if (E > 0 && I > 0) {
          // Point loads
          loads.forEach((load) => {
            const magnitudeInN = getLoadMagnitudeInN(load)
            if (load.type === "Point Load") {
              const P = magnitudeInN
              const a = (load.startPosition - leftSupport) / 1000
              const b = (rightSupport - load.startPosition) / 1000
              const L = spanLength
              if (xM <= a) {
                delta += (P * b * xM * (L * L - b * b - xM * xM)) / (6 * L * E * I)
              } else {
                delta += (P * a * (L - xM) * (2 * L * xM - xM * xM - a * a)) / (6 * L * E * I)
              }
            } else if (load.type === "Uniform Load") {
              // Uniform load over a segment
              const w = magnitudeInN
              const a = (load.startPosition - leftSupport) / 1000
              const b = (load.endPosition! - leftSupport) / 1000
              const L = spanLength
              // Only apply if xM is within the loaded region
              // Use superposition: break into loaded region and unloaded region
              // For each x, if x < a: no effect; if x > b: use full loaded region; if a <= x <= b: partial
              // For simplicity, treat as full span if load covers the whole beam
              // Use standard formula for uniform load over full span:
              // δ(x) = (w x (L^3 - 2Lx^2 + x^3)) / (24 E I)
              // For partial uniform load, a more complex formula is needed, but for now, approximate as full span if a=0 and b=L
              if (a === 0 && b === L) {
                delta += (w * xM * (Math.pow(L, 3) - 2 * L * xM * xM + Math.pow(xM, 3))) / (24 * E * I)
              }
              // For partial uniform load, skip for now (can be improved)
            }
          })
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

      // Helper function to add section headers with professional styling
      const addSectionHeader = (title: string, x: number, y: number): number => {
        // Background bar
        pdf.setFillColor(41, 128, 185)
        pdf.rect(x - 5, y - 8, contentWidth + 10, 12, "F")
        
        // Title text
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(255, 255, 255)
        pdf.text(title, x, y + 2)
        
        // Reset colors
        pdf.setTextColor(0, 0, 0)
        pdf.setFont("helvetica", "normal")
        return y + 10
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

      // Title Page - Professional Design
      // Header bar
      pdf.setFillColor(41, 128, 185)
      pdf.rect(0, 0, pageWidth, 30, "F")
      
      // Title
      pdf.setFontSize(28)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(255, 255, 255)
      pdf.text("STRUCTURAL LOAD ANALYSIS REPORT", pageWidth / 2, 20, { align: "center" })
      
      // Reset text color
      pdf.setTextColor(0, 0, 0)
      
      // Main title
      pdf.setFontSize(32)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(41, 128, 185)
      pdf.text(analysisType === "Simple Beam" ? "BEAM ANALYSIS" : "BASEFRAME ANALYSIS", pageWidth / 2, 70, { align: "center" })
      
      // Subtitle
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(100, 100, 100)
      pdf.text("Structural Engineering Analysis & Design", pageWidth / 2, 85, { align: "center" })
      
      // Decorative line
      pdf.setLineWidth(2)
      pdf.setDrawColor(41, 128, 185)
      pdf.line(pageWidth / 2 - 60, 100, pageWidth / 2 + 60, 100)
      
      // Date and time
      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(0, 0, 0)
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
      
      // Information box
      const infoBoxY = 130
      pdf.setFillColor(245, 247, 250)
      pdf.rect(margin, infoBoxY, contentWidth, 50, "F")
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(margin, infoBoxY, contentWidth, 50)
      
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      pdf.text("Report Information", margin + 5, infoBoxY + 8)
      pdf.setFont("helvetica", "normal")
      pdf.text(`Date: ${dateStr}`, margin + 5, infoBoxY + 18)
      pdf.text(`Time: ${timeStr}`, margin + 5, infoBoxY + 28)
      pdf.text(`Prepared by: hbradroc@uwo.ca`, margin + 5, infoBoxY + 38)
      
      // Analysis type badge
      pdf.setFillColor(41, 128, 185)
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      const badgeText = analysisType.toUpperCase()
      const badgeWidth = pdf.getTextWidth(badgeText) + 10
      pdf.rect(pageWidth - margin - badgeWidth, infoBoxY + 8, badgeWidth, 12, "F")
      pdf.text(badgeText, pageWidth - margin - badgeWidth / 2, infoBoxY + 16, { align: "center" })
      
      // Reset colors
      pdf.setTextColor(0, 0, 0)
      
      // Footer line
      pdf.setDrawColor(41, 128, 185)
      pdf.setLineWidth(1)
      pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30)

      // Declare yOffset at the top before any use
      let yOffset = 0;

      // Add Table of Contents page
      pdf.addPage()
      yOffset = 30
      yOffset = addSectionHeader("TABLE OF CONTENTS", margin, yOffset)
      yOffset += 15

      // TOC entries with dotted lines
      pdf.setFontSize(11)
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.3)
      
      const tocEntries = [
        { title: "1. CONFIGURATION", page: "4" },
        { title: "2. LOADING CONDITIONS", page: "5" },
        { title: "3. ANALYSIS RESULTS", page: "6" },
        { title: "4. STRUCTURAL DIAGRAMS", page: "7" },
        { title: "5. FORCE DIAGRAMS", page: "8" },
      ]
      
      tocEntries.forEach((entry, index) => {
        pdf.setFont("helvetica", "bold")
        pdf.text(entry.title, margin, yOffset)
        
        // Dotted line
        const dotStartX = margin + pdf.getTextWidth(entry.title) + 5
        const dotEndX = pageWidth - margin - 20
        const dotY = yOffset - 2
        for (let x = dotStartX; x < dotEndX; x += 2) {
          pdf.circle(x, dotY, 0.3, "F")
        }
        
        pdf.setFont("helvetica", "normal")
        pdf.text(entry.page, pageWidth - margin - 10, yOffset, { align: "right" })
        yOffset += 18
      })

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

      // Create a table for loads
      const loadTableStartY = yOffset
      const loadRowHeight = 10
      const loadColWidths = [contentWidth * 0.15, contentWidth * 0.35, contentWidth * 0.25, contentWidth * 0.25]
      
      // Table header
      pdf.setFillColor(41, 128, 185)
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.rect(margin, loadTableStartY, contentWidth, loadRowHeight, "F")
      pdf.text("Load #", margin + 2, loadTableStartY + 7)
      pdf.text("Type", margin + loadColWidths[0] + 2, loadTableStartY + 7)
      pdf.text("Description", margin + loadColWidths[0] + loadColWidths[1] + 2, loadTableStartY + 7)
      pdf.text("Total Load (N)", margin + loadColWidths[0] + loadColWidths[1] + loadColWidths[2] + 2, loadTableStartY + 7)
      
      let currentLoadY = loadTableStartY + loadRowHeight
      pdf.setTextColor(0, 0, 0)
      pdf.setFont("helvetica", "normal")
      
      loads.forEach((load, index) => {
        let loadValue = 0
        let loadDescription = ""
        let loadType = load.type

        if (load.type === "Distributed Load") {
          if (analysisType === "Base Frame" && load.loadLength && load.loadWidth) {
            // Base frame distributed load
            const loadArea = (load.loadLength * load.loadWidth) / 1_000_000 // Convert mm² to m²
            loadValue = load.magnitude * loadArea
            loadDescription = `${load.loadLength}mm × ${load.loadWidth}mm (${loadArea.toFixed(4)} m²)`
          } else if (load.area) {
            // Simple beam distributed load
            loadValue = load.magnitude * load.area
            loadDescription = `${load.area} m² area`
          }
          loadType = `Distributed (${load.magnitude} N/m²)`
        } else if (load.type === "Uniform Load" && load.endPosition) {
          const loadLength = (load.endPosition - load.startPosition) / 1000
          loadValue = load.magnitude * loadLength
          loadDescription = `${loadLength.toFixed(2)} m length`
          loadType = `Uniform (${load.magnitude} N/m)`
        } else {
          loadValue = load.magnitude
          loadDescription = `Position: ${load.startPosition} mm`
          loadType = `Point Load`
        }

        // Alternate row color
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(margin, currentLoadY, contentWidth, loadRowHeight, "F")
        }

        pdf.text(`${index + 1}`, margin + 2, currentLoadY + 7)
        pdf.text(loadType, margin + loadColWidths[0] + 2, currentLoadY + 7)
        pdf.text(loadDescription, margin + loadColWidths[0] + loadColWidths[1] + 2, currentLoadY + 7)
        pdf.text(loadValue.toFixed(1), margin + loadColWidths[0] + loadColWidths[1] + loadColWidths[2] + 2, currentLoadY + 7)
        
        currentLoadY += loadRowHeight
      })
      
      // Table border
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(margin, loadTableStartY, contentWidth, currentLoadY - loadTableStartY)
      
      yOffset = currentLoadY + 10

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
        results_data.push(["Maximum Corner Reaction", results.cornerReactionForce.toFixed(2), "N"])
      }

      // Check if table will fit on current page
      const rowHeight = 8
      const tableHeight = results_data.length * rowHeight
      const requiredSpace = tableHeight + 20 // Extra space for padding
      
      if (yOffset + requiredSpace > pageHeight - 60) {
        // Start new page if table won't fit
        pdf.addPage()
        yOffset = 30
      }

      // Add table manually with improved styling
      const tableStartY = yOffset
      const colWidths = [contentWidth * 0.5, contentWidth * 0.3, contentWidth * 0.2]
      let currentY = tableStartY

      // Table header with better styling
      pdf.setFillColor(41, 128, 185)
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.rect(margin, currentY, contentWidth, rowHeight, "F")
      pdf.text(results_data[0][0], margin + 3, currentY + 6)
      pdf.text(results_data[0][1], margin + colWidths[0] + 3, currentY + 6)
      pdf.text(results_data[0][2], margin + colWidths[0] + colWidths[1] + 3, currentY + 6)
      currentY += rowHeight

      // Table body with improved formatting
      pdf.setTextColor(0, 0, 0)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      results_data.slice(1).forEach((row, index) => {
        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(margin, currentY, contentWidth, rowHeight, "F")
        } else {
          pdf.setFillColor(255, 255, 255)
          pdf.rect(margin, currentY, contentWidth, rowHeight, "F")
        }

        // Highlight important values
        if (row[0].includes("Safety Factor")) {
          pdf.setFont("helvetica", "bold")
          const safetyFactor = parseFloat(row[1])
          if (safetyFactor < 1.5) {
            pdf.setTextColor(200, 0, 0) // Red for low safety factor
          } else if (safetyFactor < 2.0) {
            pdf.setTextColor(255, 140, 0) // Orange for moderate safety factor
          } else {
            pdf.setTextColor(0, 150, 0) // Green for good safety factor
          }
        } else {
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0)
        }

        pdf.text(row[0], margin + 3, currentY + 6)
        pdf.text(row[1], margin + colWidths[0] + 3, currentY + 6)
        pdf.text(row[2], margin + colWidths[0] + colWidths[1] + 3, currentY + 6)
        currentY += rowHeight
      })

      // Add border around table
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(margin, tableStartY, contentWidth, currentY - tableStartY)
      
      // Reset text color
      pdf.setTextColor(0, 0, 0)

      yOffset = currentY + 20

      // Add corner reactions table for Base Frame
      if (analysisType === "Base Frame" && results.cornerReactions) {
        if (yOffset + 50 > pageHeight - 60) {
          pdf.addPage()
          yOffset = 30
        }
        
        yOffset += 10
        yOffset = addSubsectionHeader("Corner Reaction Forces", margin, yOffset)
        yOffset += 5
        
        const cornerTableStartY = yOffset
        const cornerRowHeight = 8
        const cornerColWidths = [contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.25]
        
        // Table header
        pdf.setFillColor(41, 128, 185)
        pdf.setTextColor(255, 255, 255)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(9)
        pdf.rect(margin, cornerTableStartY, contentWidth, cornerRowHeight, "F")
        pdf.text("R1 (Top-Left)", margin + 2, cornerTableStartY + 6)
        pdf.text("R2 (Top-Right)", margin + cornerColWidths[0] + 2, cornerTableStartY + 6)
        pdf.text("R3 (Bottom-Left)", margin + cornerColWidths[0] + cornerColWidths[1] + 2, cornerTableStartY + 6)
        pdf.text("R4 (Bottom-Right)", margin + cornerColWidths[0] + cornerColWidths[1] + cornerColWidths[2] + 2, cornerTableStartY + 6)
        
        let cornerY = cornerTableStartY + cornerRowHeight
        pdf.setTextColor(0, 0, 0)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(9)
        
        // Data row
        pdf.setFillColor(250, 250, 250)
        pdf.rect(margin, cornerY, contentWidth, cornerRowHeight, "F")
        pdf.text(`${results.cornerReactions.R1.toFixed(2)} N`, margin + 2, cornerY + 6)
        pdf.text(`${results.cornerReactions.R2.toFixed(2)} N`, margin + cornerColWidths[0] + 2, cornerY + 6)
        pdf.text(`${results.cornerReactions.R3.toFixed(2)} N`, margin + cornerColWidths[0] + cornerColWidths[1] + 2, cornerY + 6)
        pdf.text(`${results.cornerReactions.R4.toFixed(2)} N`, margin + cornerColWidths[0] + cornerColWidths[1] + cornerColWidths[2] + 2, cornerY + 6)
        cornerY += cornerRowHeight
        
        // Table border
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(0.5)
        pdf.rect(margin, cornerTableStartY, contentWidth, cornerY - cornerTableStartY)
        
        yOffset = cornerY + 15
      }

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
        // Professional diagram frame
        pdf.setFillColor(250, 250, 250);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD");
        // Add image with error handling
        try {
          pdf.addImage(structureImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        } catch (error) {
          console.warn("Failed to add structure image to PDF:", error);
          // Fallback: try with reduced size if image is too large
          const fallbackWidth = diagramWidth * 0.8;
          const fallbackHeight = diagramHeight * 0.8;
          pdf.addImage(structureImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight);
        }
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
        pdf.setFillColor(250, 250, 250);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD");
        try {
          pdf.addImage(structureImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        } catch (error) {
          console.warn("Failed to add frame structure image to PDF:", error);
          // Fallback: try with reduced size
          const fallbackWidth = diagramWidth * 0.8;
          const fallbackHeight = diagramHeight * 0.8;
          pdf.addImage(structureImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight);
        }
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
            try {
              pdf.addImage(cornerImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
            } catch (error) {
              console.warn("Failed to add corner loads image to PDF:", error);
              // Fallback: try with reduced size
              const fallbackWidth = diagramWidth * 0.8;
              const fallbackHeight = diagramHeight * 0.8;
              pdf.addImage(cornerImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight);
            }
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
        pdf.setFillColor(250, 250, 250);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD");
        try {
          pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        } catch (error) {
          console.warn("Failed to add diagram image to PDF:", error);
          // Fallback: try with reduced size if image is too large
          const fallbackWidth = diagramWidth * 0.8;
          const fallbackHeight = diagramHeight * 0.8;
          pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight);
        }
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
        pdf.setFillColor(250, 250, 250);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD");
        try {
          pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        } catch (error) {
          console.warn("Failed to add diagram image to PDF:", error);
          // Fallback: try with reduced size if image is too large
          const fallbackWidth = diagramWidth * 0.8;
          const fallbackHeight = diagramHeight * 0.8;
          pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight);
        }
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
        pdf.setFillColor(250, 250, 250);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD");
        try {
          pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight);
        } catch (error) {
          console.warn("Failed to add diagram image to PDF:", error);
          // Fallback: try with reduced size if image is too large
          const fallbackWidth = diagramWidth * 0.8;
          const fallbackHeight = diagramHeight * 0.8;
          pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight);
        }
        yOffset += diagramHeight + 15;
      } catch (err) {
        yOffset = addWrappedText("[Deflection Diagram could not be captured]", margin, yOffset, contentWidth, 6, 10);
        yOffset += 10;
      }

      // Add professional headers and footers to all pages
      const pageCount = pdf.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        
        // Header line
        pdf.setDrawColor(41, 128, 185)
        pdf.setLineWidth(0.5)
        pdf.line(margin, 25, pageWidth - margin, 25)
        
        // Header text
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(100, 100, 100)
        pdf.text("Structural Load Analysis Report", margin, 20)
        pdf.text(analysisType, pageWidth - margin, 20, { align: "right" })
        
        // Footer line
        pdf.setDrawColor(200, 200, 200)
        pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)
        
        // Footer text
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "italic")
        pdf.setTextColor(100, 100, 100)
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 12, { align: "center" })
        pdf.text("Confidential - For Internal Use Only", margin, pageHeight - 12)
        pdf.text(`Generated: ${now.toLocaleDateString()}`, pageWidth - margin, pageHeight - 12, { align: "right" })
        
        // Reset text color
        pdf.setTextColor(0, 0, 0)
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
    <div className="container mx-auto p-4 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen" style={{ fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif' }}>
      <Head>
        <title>Enhanced Load Calculator</title>
        <link rel="icon" href="/placeholder-logo.png" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calculator className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enhanced Load Calculator</h1>
            <p className="text-sm text-gray-600">Structural Engineering Analysis Tool</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="mailto:hbradroc@uwo.ca" 
            title="Email hbradroc@uwo.ca" 
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          >
            <Mail className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">hbradroc@uwo.ca</span>
          </a>
          <Button 
            onClick={handleDownloadPDF} 
            disabled={isGeneratingPDF} 
            size="sm"
            className="flex items-center gap-2"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download PDF
              </>
            )}
          </Button>
          <HelpDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Configuration
            </CardTitle>
            <CardDescription className="text-sm">Select analysis type and enter beam properties.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <Label htmlFor="analysis-type" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                Analysis Type
              </Label>
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
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="beam-length" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Beam Length (mm)
                  </Label>
                  <Input
                    type="number"
                    id="beam-length"
                    value={beamLength}
                    onChange={(e) => setBeamLength(validatePositive(Number(e.target.value), 1000))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="left-support" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Left Support (mm)
                  </Label>
                  <Input
                    type="number"
                    id="left-support"
                    value={leftSupport}
                    onChange={(e) => setLeftSupport(validateNumber(Number(e.target.value), 0))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="right-support" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Right Support (mm)
                  </Label>
                  <Input
                    type="number"
                    id="right-support"
                    value={rightSupport}
                    onChange={(e) => setRightSupport(validatePositive(Number(e.target.value), beamLength))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="frame-length" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Frame Length (mm)
                  </Label>
                  <Input
                    type="number"
                    id="frame-length"
                    value={frameLength}
                    onChange={(e) => setFrameLength(validatePositive(Number(e.target.value), 2000))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="frame-width" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Frame Width (mm)
                  </Label>
                  <Input
                    type="number"
                    id="frame-width"
                    value={frameWidth}
                    onChange={(e) => setFrameWidth(validatePositive(Number(e.target.value), 1000))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cross-Section Dimensions Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              Cross-Section Dimensions
            </CardTitle>
            <CardDescription className="text-sm">Enter the dimensions of the beam cross-section.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <Label htmlFor="beam-cross-section" className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                Cross Section
              </Label>
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

            <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
              <BeamCrossSectionImage type={beamCrossSection} />
            </div>

            {beamCrossSection === "Rectangular" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="width" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Width (mm)
                  </Label>
                  <Input
                    type="number"
                    id="width"
                    value={width}
                    onChange={(e) => setWidth(validatePositive(Number(e.target.value), 100))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="height" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Height (mm)
                  </Label>
                  <Input
                    type="number"
                    id="height"
                    value={height}
                    onChange={(e) => setHeight(validatePositive(Number(e.target.value), 218))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {(beamCrossSection === "I Beam" || beamCrossSection === "C Channel") && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="height" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Height (H, mm)
                  </Label>
                  <Input
                    type="number"
                    id="height"
                    value={height}
                    onChange={(e) => setHeight(validatePositive(Number(e.target.value), 218))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="flange-width" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Flange Width (bf, mm)
                  </Label>
                  <Input
                    type="number"
                    id="flange-width"
                    value={flangeWidth}
                    onChange={(e) => setFlangeWidth(validatePositive(Number(e.target.value), 66))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="flange-thickness" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Flange Thickness (tf, mm)
                  </Label>
                  <Input
                    type="number"
                    id="flange-thickness"
                    value={flangeThickness}
                    onChange={(e) => setFlangeThickness(validatePositive(Number(e.target.value), 3))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="web-thickness" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Web Thickness (tw, mm)
                  </Label>
                  <Input
                    type="number"
                    id="web-thickness"
                    value={webThickness}
                    onChange={(e) => setWebThickness(validatePositive(Number(e.target.value), 44.8))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {beamCrossSection === "Circular" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="diameter" className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Diameter (D, mm)
                  </Label>
                  <Input
                    type="number"
                    id="diameter"
                    value={diameter}
                    onChange={(e) => setDiameter(validatePositive(Number(e.target.value), 100))}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Loads Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-orange-600" />
              Loads
            </CardTitle>
            <CardDescription className="text-sm">Add and manage loads applied to the beam.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            {loads.map((load, index) => (
              <div key={index} className="border border-gray-200 p-4 rounded-lg bg-gray-50">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Label htmlFor={`load-type-${index}`} className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-gray-500" />
                    Load Type
                  </Label>
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
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Label htmlFor={`load-magnitude-${index}`} className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    Magnitude
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      id={`load-magnitude-${index}`}
                      value={load.magnitude}
                      onChange={(e) => updateLoad(index, { magnitude: validateNumber(Number(e.target.value), 1000) })}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <Select
                      value={load.unit || "N"}
                      onValueChange={(value) => updateLoad(index, { unit: value as "N" | "kg" })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N">N</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Conversion tooltip */}
                <div className="mb-4 p-2 bg-blue-50 rounded border border-blue-200">
                  <div className="text-xs text-blue-700">
                    <div className="flex items-center gap-2">
                      <Info className="w-3 h-3" />
                      <span className="font-medium">Load Conversion:</span>
                    </div>
                    <div className="mt-1">
                      {load.unit === "kg" ? (
                        <>
                          <span className="font-mono">{load.magnitude} kg</span> = <span className="font-mono">{(load.magnitude * 9.81).toFixed(1)} N</span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono">{load.magnitude} N</span> = <span className="font-mono">{(load.magnitude / 9.81).toFixed(1)} kg</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Label htmlFor={`load-position-${index}`} className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Start Position (mm)
                  </Label>
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
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                {load.type === "Uniform Load" && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Label htmlFor={`load-end-position-${index}`} className="flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-gray-500" />
                      End Position (mm)
                    </Label>
                    <Input
                      type="number"
                      id={`load-end-position-${index}`}
                      value={load.endPosition || load.startPosition + 100}
                      onChange={(e) =>
                        updateLoad(index, {
                          endPosition: validateNumber(Number(e.target.value), load.startPosition + 100),
                        })
                      }
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                )}
                {load.type === "Distributed Load" && (
                  <>
                    {analysisType === "Base Frame" ? (
                      <>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <Label htmlFor={`load-length-${index}`} className="flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-gray-500" />
                            Component Length (mm)
                          </Label>
                          <Input
                            type="number"
                            id={`load-length-${index}`}
                            min={1}
                            step={1}
                            max={frameLength}
                            value={load.loadLength || 500}
                            onChange={(e) => {
                              let val = Math.max(1, Number(e.target.value));
                              if (val > frameLength) val = frameLength;
                              updateLoad(index, { loadLength: val });
                            }}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <Label htmlFor={`load-width-${index}`} className="flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-gray-500" />
                            Component Width (mm)
                          </Label>
                          <Input
                            type="number"
                            id={`load-width-${index}`}
                            min={1}
                            step={1}
                            max={frameWidth}
                            value={load.loadWidth || frameWidth}
                            onChange={(e) => {
                              let val = Math.max(1, Number(e.target.value));
                              if (val > frameWidth) val = frameWidth;
                              updateLoad(index, { loadWidth: val });
                            }}
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <Label htmlFor={`load-area-${index}`} className="flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-gray-500" />
                          Area (m²)
                        </Label>
                        <Input
                          type="number"
                          id={`load-area-${index}`}
                          min={0.1}
                          step={0.1}
                          max={((beamLength * width) / 1_000_000).toFixed(2)}
                          value={load.area || 0.5}
                          onChange={(e) => {
                            let val = Math.max(0.1, Number(e.target.value));
                            const maxArea = (beamLength * width) / 1_000_000;
                            if (val > maxArea) val = maxArea;
                            updateLoad(index, { area: val });
                          }}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </>
                )}
                <Button variant="destructive" size="sm" onClick={() => removeLoad(index)} className="w-full">
                  Remove Load
                </Button>
              </div>
            ))}
            <Button onClick={addLoad} disabled={loads.length >= 10} className="w-full">
              Add Load
            </Button>
          </CardContent>
        </Card>

        {/* Material Properties Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Material Properties
            </CardTitle>
            <CardDescription className="text-sm">Select material and view its properties.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <Label htmlFor="material" className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                Material
              </Label>
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
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="yield-strength" className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    Yield Strength (MPa)
                  </Label>
                  <Input
                    type="number"
                    id="yield-strength"
                    value={customMaterial.yieldStrength}
                    onChange={(e) =>
                      setCustomMaterial({ ...customMaterial, yieldStrength: validateNumber(Number(e.target.value), 0) })
                    }
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="elastic-modulus" className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    Elastic Modulus (GPa)
                  </Label>
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
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label htmlFor="density" className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    Density (kg/m³)
                  </Label>
                  <Input
                    type="number"
                    id="density"
                    value={customMaterial.density}
                    onChange={(e) =>
                      setCustomMaterial({ ...customMaterial, density: validateNumber(Number(e.target.value), 0) })
                    }
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Label className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    Yield Strength (MPa)
                  </Label>
                  <Input type="text" value={standardMaterials[material].yieldStrength} readOnly className="bg-gray-50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    Elastic Modulus (GPa)
                  </Label>
                  <Input type="text" value={standardMaterials[material].elasticModulus} readOnly className="bg-gray-50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    Density (kg/m³)
                  </Label>
                  <Input type="text" value={standardMaterials[material].density} readOnly className="bg-gray-50" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card className="shadow-sm border-gray-200 lg:col-span-2">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              Analysis Results
            </CardTitle>
            <CardDescription className="text-sm">View the calculated results and safety factors.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{results.maxShearForce}</div>
                <div className="text-sm text-gray-600">Max Shear Force (N)</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">{results.maxBendingMoment}</div>
                <div className="text-sm text-gray-600">Max Bending Moment (N·m)</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-600">{results.maxNormalStress}</div>
                <div className="text-sm text-gray-600">Max Normal Stress (MPa)</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">{results.maxShearStress}</div>
                <div className="text-sm text-gray-600">Max Shear Stress (MPa)</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">{results.safetyFactor}</div>
                <div className="text-sm text-gray-600">Safety Factor</div>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="text-2xl font-bold text-indigo-600">{(results.maxDeflection * 1000).toFixed(3)}</div>
                <div className="text-sm text-gray-600">Max Deflection (mm)</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-gray-600 group relative">
                  {frameWeight}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    <div className="font-mono">{(frameWeight / 9.81).toFixed(1)} kg</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">Structure Weight (N)</div>
              </div>
              {analysisType === "Base Frame" && (
                <div className="text-center p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <div className="text-2xl font-bold text-teal-600">{results.cornerReactionForce}</div>
                  <div className="text-sm text-gray-600">Corner Reaction (N)</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagrams Section */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Structural Diagrams</h2>
        </div>

        {/* Structure Diagram */}
        <Card className="mb-6 shadow-sm border-gray-200">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <Ruler className="w-5 h-5 text-blue-600" />
              Structure Layout
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {analysisType === "Simple Beam" ? (
              <BeamDiagram beamLength={beamLength} leftSupport={leftSupport} rightSupport={rightSupport} loads={loads} />
            ) : (
              <FrameDiagram frameLength={frameLength} frameWidth={frameWidth} loads={loads} />
            )}
          </CardContent>
        </Card>

        {/* Corner Loads Diagram (for Base Frame only) */}
        {analysisType === "Base Frame" && (
          <Card className="mb-6 shadow-sm border-gray-200">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Corner Loads Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <CornerLoadsDiagram
                frameLength={frameLength}
                frameWidth={frameWidth}
                loads={loads}
                cornerReactionForce={results.cornerReactionForce}
                cornerReactions={results.cornerReactions}
              />
            </CardContent>
          </Card>
        )}

        {/* Force Diagrams */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shear Force Diagram */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Shear Force Diagram
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div id="shear-force-diagram" style={{ width: "100%", height: 250 }}>
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
            </CardContent>
          </Card>

          {/* Bending Moment Diagram */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Bending Moment Diagram
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div id="bending-moment-diagram" style={{ width: "100%", height: 250 }}>
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
            </CardContent>
          </Card>

          {/* Deflection Diagram */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                Deflection Diagram
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div id="deflection-diagram" style={{ width: "100%", height: 250 }}>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
