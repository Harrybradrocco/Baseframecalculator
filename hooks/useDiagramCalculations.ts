import { useCallback } from "react"
import type { Load, Results } from "../types"
import type { MaterialProperties } from "../types"
import { standardMaterials } from "../constants"
import { validatePositive } from "../utils/validation"
import { getLoadMagnitudeInN } from "../utils/conversions"

interface UseDiagramCalculationsParams {
  analysisType: "Simple Beam" | "Base Frame"
  beamLength: number
  frameLength: number
  frameWidth: number
  leftSupport: number
  rightSupport: number
  loads: Load[]
  results: Results
  material: keyof typeof standardMaterials
  customMaterial: MaterialProperties
  setShearForceData: (data: Array<{ x: number; y: number }>) => void
  setBendingMomentData: (data: Array<{ x: number; y: number }>) => void
  setDeflectionData: (data: Array<{ x: number; y: number }>) => void
}

export function useDiagramCalculations(params: UseDiagramCalculationsParams) {
  const {
    analysisType,
    beamLength,
    frameLength,
    frameWidth,
    leftSupport,
    rightSupport,
    loads,
    results,
    material,
    customMaterial,
    setShearForceData,
    setBendingMomentData,
    setDeflectionData,
  } = params

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
        // Add left reaction (only if we're past the left support)
        if (xM >= leftSupportM) shear += R1
        // Subtract right reaction (only if we're past the right support)
        if (xM >= rightSupportM) shear -= R2
        // Subtract loads
        loads.forEach((load) => {
          const magnitudeInN = getLoadMagnitudeInN(load)
          if (load.type === "Point Load") {
            // Point load: subtract if we're past the load position
            const loadPosM = load.startPosition / 1000
            if (xM > loadPosM) {
              shear -= magnitudeInN
            }
          } else if (load.type === "Uniform Load" && load.endPosition) {
            // Uniform load: subtract load per unit length times loaded length up to x
            const loadStartM = load.startPosition / 1000
            const loadEndM = load.endPosition / 1000
            if (xM > loadStartM) {
              const loadedLength = Math.min(xM - loadStartM, loadEndM - loadStartM)
              shear -= magnitudeInN * loadedLength
            }
          } else if (load.type === "Distributed Load") {
            // Distributed load: similar to uniform load but based on area
            const loadStartM = load.startPosition / 1000
            let loadLengthM = 0
            if (load.loadLength) {
              loadLengthM = load.loadLength / 1000
            } else if (load.area) {
              loadLengthM = Math.sqrt(load.area)
            }
            if (loadLengthM > 0 && xM > loadStartM) {
              const loadedLength = Math.min(xM - loadStartM, loadLengthM)
              // For distributed load, magnitude is per m², so we need to multiply by width
              let loadWidthM = 1 // Default 1m width if not specified
              if (load.loadWidth) {
                loadWidthM = load.loadWidth / 1000
              } else if (load.area && loadLengthM > 0) {
                loadWidthM = load.area / loadLengthM
              }
              shear -= magnitudeInN * loadedLength * loadWidthM
            }
          }
        })
        // Calculate moment
        // Moment from left reaction (only if past left support)
        if (xM >= leftSupportM) {
          moment = R1 * (xM - leftSupportM)
        }
        // Moment from right reaction (only if past right support, subtract because it's downward)
        if (xM >= rightSupportM) {
          moment -= R2 * (xM - rightSupportM)
        }
        // Moment from loads
        loads.forEach((load) => {
          const magnitudeInN = getLoadMagnitudeInN(load)
          if (load.type === "Point Load") {
            // Point load: moment = force × distance from load to point x
            const loadPosM = load.startPosition / 1000
            if (xM > loadPosM) {
              moment -= magnitudeInN * (xM - loadPosM)
            }
          } else if (load.type === "Uniform Load" && load.endPosition) {
            // Uniform load: moment from distributed load
            const loadStartM = load.startPosition / 1000
            const loadEndM = load.endPosition / 1000
            if (xM > loadStartM) {
              const loadedLength = Math.min(xM - loadStartM, loadEndM - loadStartM)
              const loadCentroid = loadStartM + loadedLength / 2
              // Total load = w × length, moment = total load × distance from centroid
              moment -= magnitudeInN * loadedLength * (xM - loadCentroid)
            }
          } else if (load.type === "Distributed Load") {
            // Distributed load: similar to uniform but with area
            const loadStartM = load.startPosition / 1000
            let loadLengthM = 0
            let loadWidthM = 1
            if (load.loadLength && load.loadWidth) {
              loadLengthM = load.loadLength / 1000
              loadWidthM = load.loadWidth / 1000
            } else if (load.area) {
              loadLengthM = Math.sqrt(load.area)
              loadWidthM = load.area / loadLengthM
            }
            if (loadLengthM > 0 && xM > loadStartM) {
              const loadedLength = Math.min(xM - loadStartM, loadLengthM)
              const loadCentroid = loadStartM + loadedLength / 2
              // Total load = magnitude (N/m²) × loaded area
              moment -= magnitudeInN * loadedLength * loadWidthM * (xM - loadCentroid)
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
      // Base frame - show critical beam analysis with equivalent uniform load
      // Note: This uses a uniform load approximation for the force diagrams.
      // The actual corner reactions are calculated using the area method which accounts
      // for non-uniform load distribution. The force diagrams show the equivalent
      // uniform load per beam for visualization purposes.
      const criticalLength = Math.max(validFrameLength, validFrameWidth)
      const criticalLengthM = criticalLength / 1000
      // Total load divided by 4 beams, then by length to get load per meter per beam
      const uniformLoadPerMeter = results.totalAppliedLoad / 4 / criticalLengthM
      // Use momentOfInertia from results (already calculated)
      const materialProps = material === "Custom" ? customMaterial : standardMaterials[material]
      const E = materialProps.elasticModulus * 1e9 // Pa
      const I = results.momentOfInertia
      for (let i = 0; i < numPoints; i++) {
        const x = i * dx
        const xM = x / 1000
        // For simply supported beam with uniform load w (N/m):
        // Shear V(x) = wL/2 - wx  (linear, max at supports)
        // Moment M(x) = (wL/2)x - (wx²/2) = wx(L-x)/2  (parabolic, max at center)
        // Deflection: δ(x) = (w x (L^3 - 2Lx^2 + x^3)) / (24 E I)  (max at center)
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
    setShearForceData,
    setBendingMomentData,
    setDeflectionData,
  ])

  return { calculateDiagrams }
}

