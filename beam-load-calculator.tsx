"use client"

import { useCallback, useEffect, useState } from "react"
import type React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { HelpCircle, Calculator, Settings, Loader2, FileText, BarChart3, Ruler, Package, Mail, Download, Info, Tag } from "lucide-react"
import { jsPDF } from "jspdf"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import Head from "next/head"

// Import from modules
import type { Load, Section, Results } from "./types"
import { standardMaterials } from "./constants"
import { validateNumber, validatePositive } from "./utils/validation"
import { getLoadMagnitudeInN, convertSectionWeightToN } from "./utils/conversions"
import { svgToPngDataUrl } from "./utils/svgToPng"
import { BeamDiagram, FrameDiagram, CornerLoadsDiagram } from "./components/diagrams"
import { HelpDialog } from "./components/HelpDialog"
import { BeamCrossSectionImage } from "./components/BeamCrossSectionImage"

// All components are now imported from modules - no local definitions needed

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
  const [sections, setSections] = useState<Section[]>([])
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
  const lbsToN = (lbs: number): number => lbs * 4.44822 // 1 pound-force = 4.44822 Newtons

  // Helper function to convert N to kg
  const nToKg = (n: number): number => n / 9.81

  // Helper function to get load magnitude in N
  const getLoadMagnitudeInN = (load: Load): number => {
    if (load.unit === "kg") {
      return kgToN(load.magnitude)
    } else if (load.unit === "lbs") {
      return lbsToN(load.magnitude)
    }
    return load.magnitude // Default to N
  }

  // Reset loads when analysis type changes
  useEffect(() => {
    if (analysisType === "Simple Beam") {
      setLoads([{ type: "Point Load", magnitude: 1000, startPosition: 500, unit: "N", name: "Load 1" }])
    } else {
      // For base frame, start first load at position 0
      setLoads([{ type: "Distributed Load", magnitude: 1000, startPosition: 0, loadLength: 500, loadWidth: frameWidth, unit: "N", name: "Load 1" }])
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
          ? { type: "Point Load", magnitude: 1000, startPosition: nextStartPosition, unit: "N", name: `Load ${loads.length + 1}` }
          : analysisType === "Base Frame"
          ? { type: "Distributed Load", magnitude: 1000, startPosition: nextStartPosition, loadLength: 500, loadWidth: frameWidth, unit: "N", name: `Load ${loads.length + 1}` }
          : { type: "Distributed Load", magnitude: 1000, startPosition: nextStartPosition, area: 0.5, unit: "N", name: `Load ${loads.length + 1}` }
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

  // Section management functions
  const addSection = () => {
    const maxLength = analysisType === "Simple Beam" ? beamLength : frameLength
    let newStartPosition = 0
    if (sections.length > 0) {
      const lastSection = sections[sections.length - 1]
      newStartPosition = lastSection.endPosition
    }
    const newSection: Section = {
      id: `section-${Date.now()}`,
      startPosition: newStartPosition,
      endPosition: Math.min(newStartPosition + 1000, maxLength),
      casingWeight: 0,
      casingWeightUnit: "N",
      primaryLoad: 0,
      primaryLoadUnit: "N",
      name: `Section ${sections.length + 1}`,
    }
    setSections([...sections, newSection])
  }

  const removeSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id))
    // Remove sectionId from loads that reference this section
    setLoads(loads.map((load) => (load.sectionId === id ? { ...load, sectionId: undefined } : load)))
  }

  const updateSection = (id: string, updatedSection: Partial<Section>) => {
    setSections(
      sections.map((section) => {
        if (section.id === id) {
          return { ...section, ...updatedSection }
        }
        return section
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
        // Each corner gets load proportional to the area of rectangle from load center to OPPOSITE corner
        // This ensures loads on the left give more reaction to left corners, etc.
        // R1 (top-left at 0,0): area from load center to bottom-right corner
        const areaR1 = (frameLengthM - loadCenterX) * (frameWidthM - loadCenterY)
        // R2 (top-right at frameLengthM, 0): area from load center to bottom-left corner
        const areaR2 = loadCenterX * (frameWidthM - loadCenterY)
        // R3 (bottom-left at 0, frameWidthM): area from load center to top-right corner
        const areaR3 = (frameLengthM - loadCenterX) * loadCenterY
        // R4 (bottom-right at frameLengthM, frameWidthM): area from load center to top-left corner
        const areaR4 = loadCenterX * loadCenterY

        const totalArea = frameLengthM * frameWidthM

        if (totalArea > 0) {
          R1 += loadWeight * (areaR1 / totalArea)
          R2 += loadWeight * (areaR2 / totalArea)
          R3 += loadWeight * (areaR3 / totalArea)
          R4 += loadWeight * (areaR4 / totalArea)
        }
      })

      // Process section-level loads (casing weight and primary loads)
      sections.forEach((section) => {
        const sectionLengthM = (section.endPosition - section.startPosition) / 1000
        const sectionStartM = section.startPosition / 1000
        const sectionEndM = section.endPosition / 1000
        const sectionCenterX = (sectionStartM + sectionEndM) / 2
        const sectionCenterY = frameWidthM / 2

        // Convert section casing weight to N
        let casingWeightN = 0
        if (section.casingWeightUnit === "kg") {
          casingWeightN = section.casingWeight * 9.81
        } else if (section.casingWeightUnit === "lbs") {
          casingWeightN = section.casingWeight * 4.44822
        } else {
          casingWeightN = section.casingWeight
        }

        // Convert section primary load to N
        let primaryLoadN = 0
        if (section.primaryLoadUnit === "kg") {
          primaryLoadN = section.primaryLoad * 9.81
        } else if (section.primaryLoadUnit === "lbs") {
          primaryLoadN = section.primaryLoad * 4.44822
        } else {
          primaryLoadN = section.primaryLoad
        }

        // Primary load is distributed evenly across the section area
        const sectionAreaM2 = sectionLengthM * frameWidthM
        const primaryLoadPerM2 = sectionAreaM2 > 0 ? primaryLoadN / sectionAreaM2 : 0

        // Distribute casing weight and primary load to corners using area method
        const totalSectionLoad = casingWeightN + primaryLoadN

        // Use area method to distribute to corners
        const areaR1 = (frameLengthM - sectionCenterX) * (frameWidthM - sectionCenterY)
        const areaR2 = sectionCenterX * (frameWidthM - sectionCenterY)
        const areaR3 = (frameLengthM - sectionCenterX) * sectionCenterY
        const areaR4 = sectionCenterX * sectionCenterY
        const totalArea = frameLengthM * frameWidthM

        if (totalArea > 0) {
          R1 += totalSectionLoad * (areaR1 / totalArea)
          R2 += totalSectionLoad * (areaR2 / totalArea)
          R3 += totalSectionLoad * (areaR3 / totalArea)
          R4 += totalSectionLoad * (areaR4 / totalArea)
        }

        // Add primary load as distributed load to totalAppliedLoad
        totalAppliedLoad += primaryLoadN
        // Add casing weight to totalAppliedLoad
        totalAppliedLoad += casingWeightN
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
        // Wait longer to ensure diagrams are fully rendered
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const svg = document.getElementById(svgId) as SVGSVGElement | null;
        if (!svg) {
          console.error(`SVG with id '${svgId}' not found in DOM`);
          throw new Error(`SVG with id '${svgId}' not found in DOM. Make sure the chart is visible on the page before downloading the PDF.`);
        }
        
        // Scroll element into view to ensure it's rendered
        svg.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check if SVG is visible
        const rect = svg.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          console.warn(`SVG with id '${svgId}' has zero dimensions. It may not be visible.`);
        }
        
        let width = fallbackWidth;
        let height = fallbackHeight;
        if (svg.hasAttribute("width")) width = Number(svg.getAttribute("width")) || fallbackWidth;
        if (svg.hasAttribute("height")) height = Number(svg.getAttribute("height")) || fallbackHeight;
        
        // Use actual rendered dimensions if available
        if (rect.width > 0 && rect.height > 0) {
          width = rect.width;
          height = rect.height;
        }
        
        try {
          const dataUrl = await svgToPngDataUrl(svg, width, height);
          if (!dataUrl || dataUrl.length === 0) {
            throw new Error("Empty data URL returned from SVG conversion");
          }
          return dataUrl;
        } catch (error) {
          console.error(`Failed to convert SVG ${svgId} to PNG:`, error);
          throw error;
        }
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

      // Skip Table of Contents to reduce clutter - go straight to content
      // Add a new page for the first section
      pdf.addPage()
      yOffset = 30

      // 1. CONFIGURATION SECTION - Simplified
      yOffset = addSectionHeader("1. CONFIGURATION", margin, yOffset)
      yOffset += 10

      // Create a compact table for configuration
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      pdf.text("Property", margin, yOffset)
      pdf.text("Value", margin + contentWidth * 0.5, yOffset)
      yOffset += 8
      
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.3)
      pdf.line(margin, yOffset - 2, margin + contentWidth, yOffset - 2)
      
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      
      if (analysisType === "Simple Beam") {
        pdf.text("Beam Length", margin, yOffset)
        pdf.text(`${beamLength} mm`, margin + contentWidth * 0.5, yOffset)
        yOffset += 7
        pdf.text("Span Length", margin, yOffset)
        pdf.text(`${rightSupport - leftSupport} mm`, margin + contentWidth * 0.5, yOffset)
        yOffset += 7
      } else {
        pdf.text("Frame Length", margin, yOffset)
        pdf.text(`${frameLength} mm`, margin + contentWidth * 0.5, yOffset)
        yOffset += 7
        pdf.text("Frame Width", margin, yOffset)
        pdf.text(`${frameWidth} mm`, margin + contentWidth * 0.5, yOffset)
        yOffset += 7
      }
      
      pdf.text("Cross Section", margin, yOffset)
      pdf.text(beamCrossSection, margin + contentWidth * 0.5, yOffset)
      yOffset += 7
      
      pdf.text("Material", margin, yOffset)
      pdf.text(material, margin + contentWidth * 0.5, yOffset)
      yOffset += 7
      
      const materialProps = material === "Custom" ? customMaterial : standardMaterials[material]
      if (materialProps.yieldStrength > 0) {
        pdf.text("Yield Strength", margin, yOffset)
        pdf.text(`${materialProps.yieldStrength} MPa`, margin + contentWidth * 0.5, yOffset)
        yOffset += 7
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

      // 3. ANALYSIS RESULTS - Simplified
      yOffset += 15
      yOffset = addSectionHeader("3. ANALYSIS RESULTS", margin, yOffset)
      yOffset += 10

      // Create a simplified results table with only key metrics
      const results_data = [
        ["Parameter", "Value", "Unit"],
        ["Maximum Shear Force", results.maxShearForce.toFixed(1), "N"],
        ["Maximum Bending Moment", results.maxBendingMoment.toFixed(1), "N·m"],
        ["Maximum Normal Stress", results.maxNormalStress.toFixed(1), "MPa"],
        ["Safety Factor", results.safetyFactor.toFixed(2), "-"],
        ["Maximum Deflection", (results.maxDeflection * 1000).toFixed(2), "mm"],
      ]

      if (analysisType === "Base Frame") {
        results_data.push(["Maximum Corner Reaction", results.cornerReactionForce.toFixed(1), "N"])
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
      try {
        if (analysisType === "Simple Beam") {
          structureImg = await captureSVGAsImage("beam-structure-diagram", 500, 250)
          if (!structureImg) {
            console.warn("Failed to capture beam structure diagram, using placeholder");
            yOffset = addWrappedText("[Beam Structure Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 10);
            yOffset += 10;
          } else {
            const svg = document.getElementById("beam-structure-diagram") as SVGSVGElement | null
            const origWidth = svg?.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500;
            const origHeight = svg?.hasAttribute("height") ? Number(svg.getAttribute("height")) : 250;
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
          }
        } else {
          console.log("Capturing frame structure diagram...");
          // Scroll to make sure diagram is visible
          const frameSvg = document.getElementById("frame-structure-diagram");
          if (frameSvg) {
            frameSvg.scrollIntoView({ behavior: 'instant', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          structureImg = await captureSVGAsImage("frame-structure-diagram", 500, 450)
          console.log("Frame diagram captured:", structureImg ? "Success" : "Failed");
          if (!structureImg) {
            console.warn("Failed to capture frame structure diagram, using placeholder");
            yOffset = addWrappedText("[Frame Structure Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 10);
            yOffset += 10;
          } else {
            const svg = document.getElementById("frame-structure-diagram") as SVGSVGElement | null
            const origWidth = svg?.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500;
            const origHeight = svg?.hasAttribute("height") ? Number(svg.getAttribute("height")) : 450;
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
        }
      } catch (error) {
        console.error("Error capturing structure diagram:", error);
        yOffset = addWrappedText(`[Structure Diagram Error: ${error instanceof Error ? error.message : 'Unknown error'}]`, margin, yOffset, contentWidth, 6, 10);
        yOffset += 10;
      }

      // Corner Loads Diagram (for Base Frame only)
      if (analysisType === "Base Frame") {
        try {
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
          yOffset += 10
          console.log("Capturing corner loads diagram...");
          // Scroll to make sure diagram is visible
          if (svg) {
            svg.scrollIntoView({ behavior: 'instant', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          const cornerImg = await captureSVGAsImage("corner-loads-diagram", origWidth, origHeight)
          console.log("Corner loads diagram captured:", cornerImg ? "Success" : "Failed");
          if (cornerImg) {
            const diagramX = (pageWidth - diagramWidth) / 2;
            pdf.setFillColor(250, 250, 250);
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.5);
            pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD");
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
          } else {
            yOffset = addWrappedText("[Corner Loads Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 10);
            yOffset += 10;
          }
        } catch (error) {
          console.error("Error capturing corner loads diagram:", error);
          yOffset = addWrappedText(`[Corner Loads Diagram Error: ${error instanceof Error ? error.message : 'Unknown error'}]`, margin, yOffset, contentWidth, 6, 10);
          yOffset += 10;
        }
      }

      // 5. FORCE DIAGRAMS
      pdf.addPage()
      yOffset = 30
      yOffset = addSectionHeader("5. FORCE DIAGRAMS", margin, yOffset)
      yOffset += 10

      // Shear Force Diagram
      yOffset = addSubsectionHeader("5.1 Shear Force Diagram", margin, yOffset)
      yOffset += 10
      try {
        console.log("Capturing shear force diagram...");
        const container = document.getElementById("shear-force-diagram");
        if (!container) throw new Error("Shear force diagram container not found in DOM");
        container.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        const svg = container.querySelector("svg") as SVGSVGElement | null;
        if (!svg) throw new Error("Shear force diagram SVG not found in DOM");
        const rect = svg.getBoundingClientRect();
        const origWidth = rect.width > 0 ? rect.width : (svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248);
        const origHeight = rect.height > 0 ? rect.height : (svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300);
        const aspect = origHeight / origWidth;
        const diagramWidth = 180;
        const diagramHeight = Math.round(diagramWidth * aspect);
        const diagramX = (pageWidth - diagramWidth) / 2;
        const img = await svgToPngDataUrl(svg, origWidth, origHeight);
        console.log("Shear force diagram captured:", img ? "Success" : "Failed");
        if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG");
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
        console.error("Error capturing shear force diagram:", err);
        yOffset = addWrappedText(`[Shear Force Diagram Error: ${err instanceof Error ? err.message : 'Could not be captured'}]`, margin, yOffset, contentWidth, 6, 10);
        yOffset += 10;
      }

      // Bending Moment Diagram
      yOffset = addSubsectionHeader("5.2 Bending Moment Diagram", margin, yOffset)
      yOffset += 10
      try {
        console.log("Capturing bending moment diagram...");
        const container = document.getElementById("bending-moment-diagram");
        if (!container) throw new Error("Bending moment diagram container not found in DOM");
        container.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        const svg = container.querySelector("svg") as SVGSVGElement | null;
        if (!svg) throw new Error("Bending moment diagram SVG not found in DOM");
        const rect = svg.getBoundingClientRect();
        const origWidth = rect.width > 0 ? rect.width : (svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248);
        const origHeight = rect.height > 0 ? rect.height : (svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300);
        const aspect = origHeight / origWidth;
        const diagramWidth = 180;
        const diagramHeight = Math.round(diagramWidth * aspect);
        const diagramX = (pageWidth - diagramWidth) / 2;
        const img = await svgToPngDataUrl(svg, origWidth, origHeight);
        console.log("Bending moment diagram captured:", img ? "Success" : "Failed");
        if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG");
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
        console.error("Error capturing bending moment diagram:", err);
        yOffset = addWrappedText(`[Bending Moment Diagram Error: ${err instanceof Error ? err.message : 'Could not be captured'}]`, margin, yOffset, contentWidth, 6, 10);
        yOffset += 10;
      }

      // Deflection Diagram
      yOffset = addSubsectionHeader("5.3 Deflection Diagram", margin, yOffset)
      yOffset += 10
      try {
        console.log("Capturing deflection diagram...");
        const container = document.getElementById("deflection-diagram");
        if (!container) throw new Error("Deflection diagram container not found in DOM");
        container.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        const svg = container.querySelector("svg") as SVGSVGElement | null;
        if (!svg) throw new Error("Deflection diagram SVG not found in DOM");
        const rect = svg.getBoundingClientRect();
        const origWidth = rect.width > 0 ? rect.width : (svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248);
        const origHeight = rect.height > 0 ? rect.height : (svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300);
        const aspect = origHeight / origWidth;
        const diagramWidth = 180;
        const diagramHeight = Math.round(diagramWidth * aspect);
        const diagramX = (pageWidth - diagramWidth) / 2;
        const img = await svgToPngDataUrl(svg, origWidth, origHeight);
        console.log("Deflection diagram captured:", img ? "Success" : "Failed");
        if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG");
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
        console.error("Error capturing deflection diagram:", err);
        yOffset = addWrappedText(`[Deflection Diagram Error: ${err instanceof Error ? err.message : 'Could not be captured'}]`, margin, yOffset, contentWidth, 6, 10);
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

        {/* Sections Management Card (for Base Frame only) */}
        {analysisType === "Base Frame" && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-4 border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ruler className="w-5 h-5 text-purple-600" />
                Sections Management
              </CardTitle>
              <CardDescription className="text-sm">
                Define sections with casing weight and primary loads. Section dividers will appear in diagrams.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-600">
                  {sections.length} section{sections.length !== 1 ? "s" : ""} defined
                </span>
                <Button onClick={addSection} variant="outline" size="sm" disabled={sections.length >= 10}>
                  <Package className="w-4 h-4 mr-2" />
                  Add Section
                </Button>
              </div>

              {sections.map((section, index) => (
                <div key={section.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gray-700">{section.name || `Section ${index + 1}`}</h4>
                    <Button
                      onClick={() => removeSection(section.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`section-name-${section.id}`}>Section Name</Label>
                      <Input
                        id={`section-name-${section.id}`}
                        value={section.name || ""}
                        onChange={(e) => updateSection(section.id, { name: e.target.value })}
                        placeholder={`Section ${index + 1}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`section-start-${section.id}`}>Start Position (mm)</Label>
                      <Input
                        type="number"
                        id={`section-start-${section.id}`}
                        value={section.startPosition}
                        onChange={(e) =>
                          updateSection(section.id, {
                            startPosition: validateNumber(Number(e.target.value), 0),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`section-end-${section.id}`}>End Position (mm)</Label>
                      <Input
                        type="number"
                        id={`section-end-${section.id}`}
                        value={section.endPosition}
                        onChange={(e) =>
                          updateSection(section.id, {
                            endPosition: validatePositive(Number(e.target.value), section.startPosition + 100),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`section-length-${section.id}`}>Length (mm)</Label>
                      <Input
                        type="number"
                        id={`section-length-${section.id}`}
                        value={section.endPosition - section.startPosition}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <Label htmlFor={`section-casing-${section.id}`}>Casing Weight</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          id={`section-casing-${section.id}`}
                          value={section.casingWeight}
                          onChange={(e) =>
                            updateSection(section.id, {
                              casingWeight: validateNumber(Number(e.target.value), 0),
                            })
                          }
                          className="flex-1"
                        />
                        <Select
                          value={section.casingWeightUnit}
                          onValueChange={(value) =>
                            updateSection(section.id, { casingWeightUnit: value as "N" | "kg" | "lbs" })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="N">N</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="lbs">lbs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`section-primary-${section.id}`}>Primary Load (distributed evenly)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          id={`section-primary-${section.id}`}
                          value={section.primaryLoad}
                          onChange={(e) =>
                            updateSection(section.id, {
                              primaryLoad: validateNumber(Number(e.target.value), 0),
                            })
                          }
                          className="flex-1"
                        />
                        <Select
                          value={section.primaryLoadUnit}
                          onValueChange={(value) =>
                            updateSection(section.id, { primaryLoadUnit: value as "N" | "kg" | "lbs" })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="N">N</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="lbs">lbs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {sections.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No sections defined. Click "Add Section" to create one.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                  <Label htmlFor={`load-name-${index}`} className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-500" />
                    Load Name
                  </Label>
                  <Input
                    type="text"
                    id={`load-name-${index}`}
                    value={load.name || `Load ${index + 1}`}
                    onChange={(e) => updateLoad(index, { name: e.target.value })}
                    placeholder={`Load ${index + 1}`}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
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
                      onValueChange={(value) => updateLoad(index, { unit: value as "N" | "kg" | "lbs" })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N">N</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lbs">lbs</SelectItem>
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
                          <span className="font-mono">{load.magnitude} kg</span> = <span className="font-mono">{(load.magnitude * 9.81).toFixed(1)} N</span> = <span className="font-mono">{(load.magnitude * 2.20462).toFixed(1)} lbs</span>
                        </>
                      ) : load.unit === "lbs" ? (
                        <>
                          <span className="font-mono">{load.magnitude} lbs</span> = <span className="font-mono">{(load.magnitude * 4.44822).toFixed(1)} N</span> = <span className="font-mono">{(load.magnitude / 2.20462).toFixed(1)} kg</span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono">{load.magnitude} N</span> = <span className="font-mono">{(load.magnitude / 9.81).toFixed(1)} kg</span> = <span className="font-mono">{(load.magnitude / 4.44822).toFixed(1)} lbs</span>
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
              <FrameDiagram frameLength={frameLength} frameWidth={frameWidth} loads={loads} sections={sections} />
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
                sections={sections}
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
              <div id="shear-force-diagram" style={{ width: "100%", height: 250, minWidth: 0, minHeight: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
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
              <div id="bending-moment-diagram" style={{ width: "100%", height: 250, minWidth: 0, minHeight: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
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
              <div id="deflection-diagram" style={{ width: "100%", height: 250, minWidth: 0, minHeight: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
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
