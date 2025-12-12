import { jsPDF } from "jspdf"
import type { Load, Section, Results } from "../types"
import type { MaterialProperties } from "../types"
import { standardMaterials } from "../constants"
import { svgToPngDataUrl } from "./svgToPng"
import { getLoadMagnitudeInN } from "./conversions"

interface PDFGenerationParams {
  analysisType: "Simple Beam" | "Base Frame"
  beamLength: number
  frameLength: number
  frameWidth: number
  leftSupport: number
  rightSupport: number
  beamCrossSection: string
  material: keyof typeof standardMaterials
  customMaterial: MaterialProperties
  loads: Load[]
  sections: Section[]
  results: Results
}

export async function generatePDF(params: PDFGenerationParams): Promise<void> {
  const {
    analysisType,
    beamLength,
    frameLength,
    frameWidth,
    leftSupport,
    rightSupport,
    beamCrossSection,
    material,
    customMaterial,
    loads,
    sections,
    results,
  } = params

  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - 2 * margin

  // Set default font
  pdf.setFont("helvetica")

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
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const svg = document.getElementById(svgId) as SVGSVGElement | null
    if (!svg) {
      console.error(`SVG with id '${svgId}' not found in DOM`)
      throw new Error(`SVG with id '${svgId}' not found in DOM. Make sure the chart is visible on the page before downloading the PDF.`)
    }
    
    // Scroll element into view to ensure it's rendered
    svg.scrollIntoView({ behavior: 'instant', block: 'center' })
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Check if SVG is visible
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      console.warn(`SVG with id '${svgId}' has zero dimensions. It may not be visible.`)
    }
    
    let width = fallbackWidth
    let height = fallbackHeight
    if (svg.hasAttribute("width")) width = Number(svg.getAttribute("width")) || fallbackWidth
    if (svg.hasAttribute("height")) height = Number(svg.getAttribute("height")) || fallbackHeight
    
    // Use actual rendered dimensions if available
    if (rect.width > 0 && rect.height > 0) {
      width = rect.width
      height = rect.height
    }
    
    try {
      const dataUrl = await svgToPngDataUrl(svg, width, height)
      if (!dataUrl || dataUrl.length === 0) {
        throw new Error("Empty data URL returned from SVG conversion")
      }
      return dataUrl
    } catch (error) {
      console.error(`Failed to convert SVG ${svgId} to PNG:`, error)
      throw error
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

  // Add a new page for the first section
  pdf.addPage()
  let yOffset = 30

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
      loadValue = getLoadMagnitudeInN(load)
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
        console.warn("Failed to capture beam structure diagram, using placeholder")
        yOffset = addWrappedText("[Beam Structure Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 10)
        yOffset += 10
      } else {
        const svg = document.getElementById("beam-structure-diagram") as SVGSVGElement | null
        const origWidth = svg?.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500
        const origHeight = svg?.hasAttribute("height") ? Number(svg.getAttribute("height")) : 250
        const aspect = origHeight / origWidth
        const diagramWidth = 200
        const diagramHeight = Math.round(diagramWidth * aspect)
        const diagramX = (pageWidth - diagramWidth) / 2
        // Professional diagram frame
        pdf.setFillColor(250, 250, 250)
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(0.5)
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
        // Add image with error handling
        try {
          pdf.addImage(structureImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
        } catch (error) {
          console.warn("Failed to add structure image to PDF:", error)
          // Fallback: try with reduced size if image is too large
          const fallbackWidth = diagramWidth * 0.8
          const fallbackHeight = diagramHeight * 0.8
          pdf.addImage(structureImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
        }
        yOffset += diagramHeight + 15
      }
    } else {
      console.log("Capturing frame structure diagram...")
      // Scroll to make sure diagram is visible
      const frameSvg = document.getElementById("frame-structure-diagram")
      if (frameSvg) {
        frameSvg.scrollIntoView({ behavior: 'instant', block: 'center' })
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      structureImg = await captureSVGAsImage("frame-structure-diagram", 500, 450)
      console.log("Frame diagram captured:", structureImg ? "Success" : "Failed")
      if (!structureImg) {
        console.warn("Failed to capture frame structure diagram, using placeholder")
        yOffset = addWrappedText("[Frame Structure Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 10)
        yOffset += 10
      } else {
        const svg = document.getElementById("frame-structure-diagram") as SVGSVGElement | null
        const origWidth = svg?.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500
        const origHeight = svg?.hasAttribute("height") ? Number(svg.getAttribute("height")) : 450
        const aspect = origHeight / origWidth
        const diagramWidth = 200
        const diagramHeight = Math.round(diagramWidth * aspect)
        const diagramX = (pageWidth - diagramWidth) / 2
        pdf.setFillColor(250, 250, 250)
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(0.5)
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
        try {
          pdf.addImage(structureImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
        } catch (error) {
          console.warn("Failed to add frame structure image to PDF:", error)
          // Fallback: try with reduced size
          const fallbackWidth = diagramWidth * 0.8
          const fallbackHeight = diagramHeight * 0.8
          pdf.addImage(structureImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
        }
        yOffset += diagramHeight + 15
      }
    }
  } catch (error) {
    console.error("Error capturing structure diagram:", error)
    yOffset = addWrappedText(`[Structure Diagram Error: ${error instanceof Error ? error.message : 'Unknown error'}]`, margin, yOffset, contentWidth, 6, 10)
    yOffset += 10
  }

  // Corner Loads Diagram (for Base Frame only)
  if (analysisType === "Base Frame") {
    try {
      // Estimate required height for header + diagram + padding
      const diagramHeaderHeight = 10
      const diagramPadding = 15
      const diagramWidth = 200
      const svg = document.getElementById("corner-loads-diagram") as SVGSVGElement | null
      let origWidth = 500, origHeight = 450, aspect = origHeight / origWidth
      if (svg) {
        origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500
        origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 450
        aspect = origHeight / origWidth
      }
      const diagramHeight = Math.round(diagramWidth * aspect)
      const requiredHeight = diagramHeaderHeight + diagramHeight + diagramPadding + 10
      if (yOffset + requiredHeight > pageHeight - margin) {
        pdf.addPage()
        yOffset = 30
      }
      yOffset = addSubsectionHeader("4.2 Corner Loads Analysis", margin, yOffset)
      yOffset += 10
      console.log("Capturing corner loads diagram...")
      // Scroll to make sure diagram is visible
      if (svg) {
        svg.scrollIntoView({ behavior: 'instant', block: 'center' })
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      const cornerImg = await captureSVGAsImage("corner-loads-diagram", origWidth, origHeight)
      console.log("Corner loads diagram captured:", cornerImg ? "Success" : "Failed")
      if (cornerImg) {
        const diagramX = (pageWidth - diagramWidth) / 2
        pdf.setFillColor(250, 250, 250)
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(0.5)
        pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
        try {
          pdf.addImage(cornerImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
        } catch (error) {
          console.warn("Failed to add corner loads image to PDF:", error)
          // Fallback: try with reduced size
          const fallbackWidth = diagramWidth * 0.8
          const fallbackHeight = diagramHeight * 0.8
          pdf.addImage(cornerImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
        }
        yOffset += diagramHeight + 15
      } else {
        yOffset = addWrappedText("[Corner Loads Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 10)
        yOffset += 10
      }
    } catch (error) {
      console.error("Error capturing corner loads diagram:", error)
      yOffset = addWrappedText(`[Corner Loads Diagram Error: ${error instanceof Error ? error.message : 'Unknown error'}]`, margin, yOffset, contentWidth, 6, 10)
      yOffset += 10
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
    console.log("Capturing shear force diagram...")
    const container = document.getElementById("shear-force-diagram")
    if (!container) throw new Error("Shear force diagram container not found in DOM")
    container.scrollIntoView({ behavior: 'instant', block: 'center' })
    await new Promise(resolve => setTimeout(resolve, 800)) // Increased wait time for Recharts to render
    const svg = container.querySelector("svg") as SVGSVGElement | null
    if (!svg) {
      // Try alternative: look for SVG in nested elements
      const nestedSvg = container.querySelector("div > svg") as SVGSVGElement | null
      if (!nestedSvg) throw new Error("Shear force diagram SVG not found in DOM")
      const rect = nestedSvg.getBoundingClientRect()
      const origWidth = rect.width > 0 ? rect.width : 1248
      const origHeight = rect.height > 0 ? rect.height : 300
      const aspect = origHeight / origWidth
      const diagramWidth = 180
      const diagramHeight = Math.round(diagramWidth * aspect)
      const diagramX = (pageWidth - diagramWidth) / 2
      const img = await svgToPngDataUrl(nestedSvg, origWidth, origHeight)
      if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG")
      pdf.setFillColor(250, 250, 250)
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
      try {
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
      } catch (error) {
        console.warn("Failed to add diagram image to PDF:", error)
        const fallbackWidth = diagramWidth * 0.8
        const fallbackHeight = diagramHeight * 0.8
        pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
      }
      yOffset += diagramHeight + 15
    } else {
      const rect = svg.getBoundingClientRect()
      const origWidth = rect.width > 0 ? rect.width : (svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248)
      const origHeight = rect.height > 0 ? rect.height : (svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300)
      const aspect = origHeight / origWidth
      const diagramWidth = 180
      const diagramHeight = Math.round(diagramWidth * aspect)
      const diagramX = (pageWidth - diagramWidth) / 2
      const img = await svgToPngDataUrl(svg, origWidth, origHeight)
      console.log("Shear force diagram captured:", img ? "Success" : "Failed")
      if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG")
      pdf.setFillColor(250, 250, 250)
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
      try {
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
      } catch (error) {
        console.warn("Failed to add diagram image to PDF:", error)
        const fallbackWidth = diagramWidth * 0.8
        const fallbackHeight = diagramHeight * 0.8
        pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
      }
      yOffset += diagramHeight + 15
    }
  } catch (err) {
    console.error("Error capturing shear force diagram:", err)
    yOffset = addWrappedText(`[Shear Force Diagram Error: ${err instanceof Error ? err.message : 'Could not be captured'}]`, margin, yOffset, contentWidth, 6, 10)
    yOffset += 10
  }

  // Bending Moment Diagram
  yOffset = addSubsectionHeader("5.2 Bending Moment Diagram", margin, yOffset)
  yOffset += 10
  try {
    console.log("Capturing bending moment diagram...")
    const container = document.getElementById("bending-moment-diagram")
    if (!container) throw new Error("Bending moment diagram container not found in DOM")
    container.scrollIntoView({ behavior: 'instant', block: 'center' })
    await new Promise(resolve => setTimeout(resolve, 800)) // Increased wait time
    const svg = container.querySelector("svg") as SVGSVGElement | null
    if (!svg) {
      const nestedSvg = container.querySelector("div > svg") as SVGSVGElement | null
      if (!nestedSvg) throw new Error("Bending moment diagram SVG not found in DOM")
      const rect = nestedSvg.getBoundingClientRect()
      const origWidth = rect.width > 0 ? rect.width : 1248
      const origHeight = rect.height > 0 ? rect.height : 300
      const aspect = origHeight / origWidth
      const diagramWidth = 180
      const diagramHeight = Math.round(diagramWidth * aspect)
      const diagramX = (pageWidth - diagramWidth) / 2
      const img = await svgToPngDataUrl(nestedSvg, origWidth, origHeight)
      if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG")
      pdf.setFillColor(250, 250, 250)
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
      try {
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
      } catch (error) {
        console.warn("Failed to add diagram image to PDF:", error)
        const fallbackWidth = diagramWidth * 0.8
        const fallbackHeight = diagramHeight * 0.8
        pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
      }
      yOffset += diagramHeight + 15
    } else {
      const rect = svg.getBoundingClientRect()
      const origWidth = rect.width > 0 ? rect.width : (svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248)
      const origHeight = rect.height > 0 ? rect.height : (svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300)
      const aspect = origHeight / origWidth
      const diagramWidth = 180
      const diagramHeight = Math.round(diagramWidth * aspect)
      const diagramX = (pageWidth - diagramWidth) / 2
      const img = await svgToPngDataUrl(svg, origWidth, origHeight)
      console.log("Bending moment diagram captured:", img ? "Success" : "Failed")
      if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG")
      pdf.setFillColor(250, 250, 250)
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
      try {
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
      } catch (error) {
        console.warn("Failed to add diagram image to PDF:", error)
        const fallbackWidth = diagramWidth * 0.8
        const fallbackHeight = diagramHeight * 0.8
        pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
      }
      yOffset += diagramHeight + 15
    }
  } catch (err) {
    console.error("Error capturing bending moment diagram:", err)
    yOffset = addWrappedText(`[Bending Moment Diagram Error: ${err instanceof Error ? err.message : 'Could not be captured'}]`, margin, yOffset, contentWidth, 6, 10)
    yOffset += 10
  }

  // Deflection Diagram
  yOffset = addSubsectionHeader("5.3 Deflection Diagram", margin, yOffset)
  yOffset += 10
  try {
    console.log("Capturing deflection diagram...")
    const container = document.getElementById("deflection-diagram")
    if (!container) throw new Error("Deflection diagram container not found in DOM")
    container.scrollIntoView({ behavior: 'instant', block: 'center' })
    await new Promise(resolve => setTimeout(resolve, 800)) // Increased wait time
    const svg = container.querySelector("svg") as SVGSVGElement | null
    if (!svg) {
      const nestedSvg = container.querySelector("div > svg") as SVGSVGElement | null
      if (!nestedSvg) throw new Error("Deflection diagram SVG not found in DOM")
      const rect = nestedSvg.getBoundingClientRect()
      const origWidth = rect.width > 0 ? rect.width : 1248
      const origHeight = rect.height > 0 ? rect.height : 300
      const aspect = origHeight / origWidth
      const diagramWidth = 180
      const diagramHeight = Math.round(diagramWidth * aspect)
      const diagramX = (pageWidth - diagramWidth) / 2
      const img = await svgToPngDataUrl(nestedSvg, origWidth, origHeight)
      if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG")
      pdf.setFillColor(250, 250, 250)
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
      try {
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
      } catch (error) {
        console.warn("Failed to add diagram image to PDF:", error)
        const fallbackWidth = diagramWidth * 0.8
        const fallbackHeight = diagramHeight * 0.8
        pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
      }
      yOffset += diagramHeight + 15
    } else {
      const rect = svg.getBoundingClientRect()
      const origWidth = rect.width > 0 ? rect.width : (svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248)
      const origHeight = rect.height > 0 ? rect.height : (svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300)
      const aspect = origHeight / origWidth
      const diagramWidth = 180
      const diagramHeight = Math.round(diagramWidth * aspect)
      const diagramX = (pageWidth - diagramWidth) / 2
      const img = await svgToPngDataUrl(svg, origWidth, origHeight)
      console.log("Deflection diagram captured:", img ? "Success" : "Failed")
      if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG")
      pdf.setFillColor(250, 250, 250)
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(diagramX - 5, yOffset - 5, diagramWidth + 10, diagramHeight + 10, "FD")
      try {
        pdf.addImage(img, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
      } catch (error) {
        console.warn("Failed to add diagram image to PDF:", error)
        const fallbackWidth = diagramWidth * 0.8
        const fallbackHeight = diagramHeight * 0.8
        pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
      }
      yOffset += diagramHeight + 15
    }
  } catch (err) {
    console.error("Error capturing deflection diagram:", err)
    yOffset = addWrappedText(`[Deflection Diagram Error: ${err instanceof Error ? err.message : 'Could not be captured'}]`, margin, yOffset, contentWidth, 6, 10)
    yOffset += 10
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
}

