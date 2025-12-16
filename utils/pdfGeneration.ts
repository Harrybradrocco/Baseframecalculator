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

  // Initial wait to ensure page is fully loaded
  await new Promise(resolve => setTimeout(resolve, 500))

  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 25 // Increased margin for LaTeX style
  const contentWidth = pageWidth - 2 * margin

  // LaTeX-style fonts: Times Roman for body, Helvetica for headers
  pdf.setFont("times", "normal") // Serif font for body text

  // Helper function to add wrapped text with LaTeX-style formatting
  const addWrappedText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    fontSize = 10,
    fontStyle: "normal" | "bold" | "italic" = "normal",
  ): number => {
    pdf.setFontSize(fontSize)
    pdf.setFont("times", fontStyle)
    const lines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(lines, x, y)
    return y + lines.length * lineHeight
  }

  // LaTeX-style section headers (clean, minimal)
  const addSectionHeader = (title: string, x: number, y: number): number => {
    // Subtle underline instead of colored bar
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.5)
    pdf.line(x, y + 2, x + contentWidth, y + 2)
    
    // Title text in sans-serif, bold
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(0, 0, 0)
    pdf.text(title, x, y)
    
    // Reset to serif for body
    pdf.setFont("times", "normal")
    return y + 8
  }

  // LaTeX-style subsection headers
  const addSubsectionHeader = (title: string, x: number, y: number): number => {
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(0, 0, 0)
    pdf.text(title, x, y)
    pdf.setFont("times", "normal")
    return y + 6
  }

  // Helper to add a professional table with borders
  const addTable = (
    headers: string[],
    rows: string[][],
    startX: number,
    startY: number,
    colWidths: number[],
    rowHeight: number = 8,
  ): number => {
    const tableWidth = colWidths.reduce((a, b) => a + b, 0)
    
    // Draw table borders
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.5)
    
    // Top border
    pdf.line(startX, startY, startX + tableWidth, startY)
    // Bottom border
    pdf.line(startX, startY + rowHeight * (rows.length + 1), startX + tableWidth, startY + rowHeight * (rows.length + 1))
    // Left and right borders
    pdf.line(startX, startY, startX, startY + rowHeight * (rows.length + 1))
    pdf.line(startX + tableWidth, startY, startX + tableWidth, startY + rowHeight * (rows.length + 1))
    
    // Header row
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    let currentX = startX
    headers.forEach((header, i) => {
      pdf.line(currentX, startY, currentX, startY + rowHeight * (rows.length + 1)) // Vertical line
      pdf.text(header, currentX + 3, startY + rowHeight - 3)
      currentX += colWidths[i]
    })
    
    // Header separator line
    pdf.line(startX, startY + rowHeight, startX + tableWidth, startY + rowHeight)
    
    // Data rows
    pdf.setFont("times", "normal")
    pdf.setFontSize(9)
    rows.forEach((row, rowIndex) => {
      currentX = startX
      row.forEach((cell, colIndex) => {
        pdf.line(currentX, startY + rowHeight * (rowIndex + 1), currentX, startY + rowHeight * (rowIndex + 2)) // Vertical line
        pdf.text(cell, currentX + 3, startY + rowHeight * (rowIndex + 2) - 3)
        currentX += colWidths[colIndex]
      })
    })
    
    return startY + rowHeight * (rows.length + 1) + 10
  }

  // Helper to capture a DOM node as PNG using svgToPngDataUrl
  const captureSVGAsImage = async (svgId: string, fallbackWidth: number, fallbackHeight: number) => {
    // Wait a bit for any pending renders
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Try to find the SVG element - multiple strategies
    let svg = document.getElementById(svgId) as SVGSVGElement | null
    
    // Strategy 1: Direct ID lookup
    if (!svg) {
      svg = document.querySelector(`svg#${svgId}`) as SVGSVGElement | null
    }
    
    // Strategy 2: Search all SVGs
    if (!svg) {
      const allSvgs = document.querySelectorAll('svg')
      for (const s of allSvgs) {
        if (s.id === svgId || s.getAttribute('id') === svgId) {
          svg = s as SVGSVGElement
          break
        }
      }
    }
    
    // Strategy 3: Find by partial ID match
    if (!svg) {
      const allSvgs = document.querySelectorAll('svg[id]')
      for (const s of allSvgs) {
        const id = s.getAttribute('id') || ''
        if (id.includes(svgId.replace('-', '')) || svgId.includes(id.replace('-', ''))) {
          svg = s as SVGSVGElement
          break
        }
      }
    }
    
    if (!svg) {
      console.error(`SVG with id '${svgId}' not found in DOM. Available SVGs:`, 
        Array.from(document.querySelectorAll('svg[id]')).map(s => s.id))
      throw new Error(`SVG with id '${svgId}' not found in DOM. Make sure the diagram is visible before generating PDF.`)
    }
    
    // Ensure SVG and all parents are visible
    let element: HTMLElement | null = svg
    while (element) {
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        element.style.display = 'block'
        element.style.visibility = 'visible'
        element.style.opacity = '1'
      }
      element = element.parentElement
    }
    
    // Scroll into view and wait for render
    svg.scrollIntoView({ behavior: 'instant', block: 'center' })
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Force multiple reflows to ensure rendering
    void svg.offsetHeight
    void svg.offsetWidth
    await new Promise(resolve => setTimeout(resolve, 300))
    void svg.getBoundingClientRect()
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const rect = svg.getBoundingClientRect()
    console.log(`SVG ${svgId} dimensions:`, { 
      rect: { width: rect.width, height: rect.height },
      attributes: { 
        width: svg.getAttribute('width'), 
        height: svg.getAttribute('height') 
      }
    })
    
    // Get dimensions from SVG attributes first, then from bounding rect
    let width = fallbackWidth
    let height = fallbackHeight
    
    if (svg.hasAttribute("width")) {
      const attrWidth = Number(svg.getAttribute("width"))
      if (!isNaN(attrWidth) && attrWidth > 0) width = attrWidth
    }
    if (svg.hasAttribute("height")) {
      const attrHeight = Number(svg.getAttribute("height"))
      if (!isNaN(attrHeight) && attrHeight > 0) height = attrHeight
    }
    
    // Use bounding rect if it has valid dimensions (prefer actual rendered size)
    if (rect.width > 0 && rect.height > 0) {
      width = rect.width
      height = rect.height
    }
    
    // Ensure minimum dimensions
    if (width <= 0) width = fallbackWidth
    if (height <= 0) height = fallbackHeight
    
    console.log(`Capturing SVG ${svgId} at ${width}x${height}`)
    
    try {
      const dataUrl = await svgToPngDataUrl(svg, width, height)
      if (!dataUrl || dataUrl.length === 0) {
        throw new Error("Empty data URL returned from SVG conversion")
      }
      console.log(`Successfully captured SVG ${svgId}, data URL length: ${dataUrl.length}`)
      return dataUrl
    } catch (error) {
      console.error(`Failed to convert SVG ${svgId} to PNG:`, error)
      throw error
    }
  }

  // LaTeX-style Title Page - Clean and minimal
  // Title in large serif font
  pdf.setFontSize(18)
  pdf.setFont("times", "bold")
  pdf.setTextColor(0, 0, 0)
  pdf.text(analysisType === "Simple Beam" ? "Beam Analysis Report" : "Baseframe Analysis Report", pageWidth / 2, 50, { align: "center" })
  
  // Subtitle
  pdf.setFontSize(12)
  pdf.setFont("times", "normal")
  pdf.setTextColor(60, 60, 60)
  pdf.text("Structural Engineering Analysis", pageWidth / 2, 65, { align: "center" })
  
  // Horizontal rule
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.line(margin, 80, pageWidth - margin, 80)
  
  // Date and time
  pdf.setFontSize(10)
  pdf.setFont("times", "normal")
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
  
  // Information in a clean table format
  const infoY = 100
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  pdf.text("Report Information", margin, infoY)
  pdf.setFont("times", "normal")
  pdf.setFontSize(9)
  pdf.text(`Date: ${dateStr}`, margin, infoY + 10)
  pdf.text(`Time: ${timeStr}`, margin, infoY + 18)
  pdf.text(`Prepared by: hbradroc@uwo.ca`, margin, infoY + 26)
  pdf.text(`Analysis Type: ${analysisType}`, margin, infoY + 34)
  
  // Footer line
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30)

  // Add a new page for the first section
  pdf.addPage()
  let yOffset = 40

  // 1. CONFIGURATION SECTION
  yOffset = addSectionHeader("1. Configuration", margin, yOffset)
  yOffset += 8

  // Configuration data in table format
  const configData: string[][] = []
  if (analysisType === "Simple Beam") {
    configData.push(["Beam Length", `${beamLength} mm`])
    configData.push(["Span Length", `${rightSupport - leftSupport} mm`])
  } else {
    configData.push(["Frame Length", `${frameLength} mm`])
    configData.push(["Frame Width", `${frameWidth} mm`])
  }
  configData.push(["Cross Section", beamCrossSection])
  configData.push(["Material", material])
  
  const materialProps = material === "Custom" ? customMaterial : standardMaterials[material]
  if (materialProps.yieldStrength > 0) {
    configData.push(["Yield Strength", `${materialProps.yieldStrength} MPa`])
  }

  const configColWidths = [contentWidth * 0.4, contentWidth * 0.6]
  yOffset = addTable(
    ["Property", "Value"],
    configData,
    margin,
    yOffset,
    configColWidths,
    7
  )

  // 2. LOADING CONDITIONS
  if (yOffset > pageHeight - 80) {
    pdf.addPage()
    yOffset = 40
  }
  yOffset += 5
  yOffset = addSectionHeader("2. Loading Conditions", margin, yOffset)
  yOffset += 8

  pdf.setFont("times", "normal")
  pdf.setFontSize(10)
  pdf.text(`Total Applied Load: ${results.totalAppliedLoad.toFixed(1)} N`, margin, yOffset)
  yOffset += 10

  // Loads table
  const loadTableData: string[][] = []
  loads.forEach((load, index) => {
    let loadValue = 0
    let loadDescription = ""
    let loadType = load.type

    if (load.type === "Distributed Load") {
      if (analysisType === "Base Frame" && load.loadLength && load.loadWidth) {
        const loadArea = (load.loadLength * load.loadWidth) / 1_000_000
        loadValue = load.magnitude * loadArea
        loadDescription = `${load.loadLength} mm × ${load.loadWidth} mm`
      } else if (load.area) {
        loadValue = load.magnitude * load.area
        loadDescription = `${load.area} m²`
      }
      loadType = `Distributed (${load.magnitude} N/m²)`
    } else if (load.type === "Uniform Load" && load.endPosition) {
      const loadLength = (load.endPosition - load.startPosition) / 1000
      loadValue = load.magnitude * loadLength
      loadDescription = `${loadLength.toFixed(2)} m`
      loadType = `Uniform (${load.magnitude} N/m)`
    } else {
      loadValue = getLoadMagnitudeInN(load)
      loadDescription = `${load.startPosition} mm`
      loadType = `Point Load`
    }

    loadTableData.push([
      `${index + 1}`,
      loadType,
      loadDescription,
      `${loadValue.toFixed(1)} N`
    ])
  })

  const loadColWidths = [contentWidth * 0.1, contentWidth * 0.35, contentWidth * 0.25, contentWidth * 0.3]
  yOffset = addTable(
    ["#", "Type", "Description", "Total Load (N)"],
    loadTableData,
    margin,
    yOffset,
    loadColWidths,
    8
  )

  if (analysisType === "Base Frame") {
    pdf.setFont("times", "normal")
    pdf.setFontSize(9)
    pdf.text(`Load per Member: ${results.loadPerBeam.toFixed(1)} N (distributed equally among 4 members)`, margin, yOffset)
    yOffset += 8
  }

  if (yOffset > pageHeight - 60) {
    pdf.addPage()
    yOffset = 40
  }

  // 3. ANALYSIS RESULTS
  yOffset += 10
  yOffset = addSectionHeader("3. Analysis Results", margin, yOffset)
  yOffset += 8

  const resultsData: string[][] = [
    ["Maximum Shear Force", `${results.maxShearForce.toFixed(1)}`, "N"],
    ["Maximum Bending Moment", `${results.maxBendingMoment.toFixed(1)}`, "N·m"],
    ["Maximum Normal Stress", `${results.maxNormalStress.toFixed(1)}`, "MPa"],
    ["Safety Factor", `${results.safetyFactor.toFixed(2)}`, "-"],
    ["Maximum Deflection", `${(results.maxDeflection * 1000).toFixed(2)}`, "mm"],
  ]

  if (analysisType === "Base Frame") {
    resultsData.push(["Maximum Corner Reaction", `${results.cornerReactionForce.toFixed(1)}`, "N"])
  }

  // Better column widths to fit within page
  const resultsColWidths = [contentWidth * 0.55, contentWidth * 0.25, contentWidth * 0.2]
  yOffset = addTable(
    ["Parameter", "Value", "Unit"],
    resultsData,
    margin,
    yOffset,
    resultsColWidths,
    7
  )

  // Corner reactions table for Base Frame
  if (analysisType === "Base Frame" && results.cornerReactions) {
    if (yOffset + 50 > pageHeight - 60) {
      pdf.addPage()
      yOffset = 40
    }
    
    yOffset += 5
    yOffset = addSubsectionHeader("Corner Reaction Forces", margin, yOffset)
    yOffset += 5
    
    // Format corner reactions with proper labels
    const cornerData: string[][] = [
      [
        `R₁ (Top-Left): ${results.cornerReactions.R1.toFixed(1)} N`,
        `R₂ (Top-Right): ${results.cornerReactions.R2.toFixed(1)} N`
      ],
      [
        `R₃ (Bottom-Left): ${results.cornerReactions.R3.toFixed(1)} N`,
        `R₄ (Bottom-Right): ${results.cornerReactions.R4.toFixed(1)} N`
      ]
    ]
    
    // Use 2 columns instead of 4 to fit better
    const cornerColWidths = [contentWidth * 0.5, contentWidth * 0.5]
    yOffset = addTable(
      ["Corner", "Corner"],
      cornerData,
      margin,
      yOffset,
      cornerColWidths,
      8
    )
  }

  // 4. STRUCTURAL DIAGRAMS
  // Find and scroll to diagrams section to ensure they're rendered
  // First, try to find the Structural Diagrams heading
  const allHeadings = Array.from(document.querySelectorAll('h2, h3'))
  const diagramsHeading = allHeadings.find(el => 
    el.textContent?.toLowerCase().includes('structural') || 
    el.textContent?.toLowerCase().includes('diagram')
  )
  
  if (diagramsHeading) {
    (diagramsHeading as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'start' })
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Also try to find and scroll to the actual SVG elements
  const targetSvgIds = analysisType === "Simple Beam" 
    ? ["beam-structure-diagram"]
    : ["frame-structure-diagram", "corner-loads-diagram"]
  
  for (const svgId of targetSvgIds) {
    const svg = document.getElementById(svgId) || 
                document.querySelector(`svg#${svgId}`) ||
                Array.from(document.querySelectorAll('svg')).find(s => s.id === svgId)
    if (svg) {
      (svg as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' })
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  // Final wait to ensure everything is rendered
  await new Promise(resolve => setTimeout(resolve, 500))
  
  pdf.addPage()
  yOffset = 40
  yOffset = addSectionHeader("4. Structural Diagrams", margin, yOffset)
  yOffset += 10

  // Structure Diagram
  yOffset = addSubsectionHeader("4.1 Structure Layout", margin, yOffset)
  yOffset += 8
  let structureImg: string | null = null
  try {
    if (analysisType === "Simple Beam") {
      // Wait a bit to ensure page is ready
      await new Promise(resolve => setTimeout(resolve, 200))
      
      let svg = document.getElementById("beam-structure-diagram") as SVGSVGElement | null
      if (!svg) {
        // Try alternative search
        const allSvgs = document.querySelectorAll('svg[id="beam-structure-diagram"]')
        if (allSvgs.length > 0) {
          svg = allSvgs[0] as SVGSVGElement
        }
      }
      
      if (!svg) {
        console.warn("Beam Structure Diagram not found, adding placeholder text")
        yOffset = addWrappedText("[Beam Structure Diagram - Not found in DOM. Please ensure the diagram is visible before generating PDF.]", margin, yOffset, contentWidth, 6, 9)
        yOffset += 10
      } else {
        // Use the improved capture function
        const origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 500
        const origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 250
        structureImg = await captureSVGAsImage("beam-structure-diagram", origWidth, origHeight)
        if (!structureImg) {
          yOffset = addWrappedText("[Beam Structure Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 9)
          yOffset += 10
        } else {
          const aspect = origHeight / origWidth
          const maxDiagramWidth = contentWidth * 0.9
          const diagramWidth = Math.min(maxDiagramWidth, 160)
          const diagramHeight = Math.round(diagramWidth * aspect)
          // Ensure diagram fits on page
          if (yOffset + diagramHeight > pageHeight - 40) {
            pdf.addPage()
            yOffset = 40
          }
          const diagramX = (pageWidth - diagramWidth) / 2
          pdf.setDrawColor(0, 0, 0)
          pdf.setLineWidth(0.5)
          pdf.rect(diagramX - 3, yOffset - 3, diagramWidth + 6, diagramHeight + 6)
          try {
            pdf.addImage(structureImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
          } catch (error) {
            console.warn("Failed to add structure image to PDF:", error)
            const fallbackWidth = diagramWidth * 0.8
            const fallbackHeight = diagramHeight * 0.8
            pdf.addImage(structureImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
          }
          yOffset += diagramHeight + 12
        }
      }
    } else {
      // Wait a bit to ensure page is ready
      await new Promise(resolve => setTimeout(resolve, 200))
      
      let frameSvg = document.getElementById("frame-structure-diagram") as SVGSVGElement | null
      if (!frameSvg) {
        // Try alternative search
        const allSvgs = document.querySelectorAll('svg[id="frame-structure-diagram"]')
        if (allSvgs.length > 0) {
          frameSvg = allSvgs[0] as SVGSVGElement
        }
      }
      
      if (!frameSvg) {
        console.warn("Frame Structure Diagram not found, adding placeholder text")
        yOffset = addWrappedText("[Frame Structure Diagram - Not found in DOM. Please ensure the diagram is visible before generating PDF.]", margin, yOffset, contentWidth, 6, 9)
        yOffset += 10
      } else {
        // Use the improved capture function
        const origWidth = frameSvg.hasAttribute("width") ? Number(frameSvg.getAttribute("width")) : 500
        const origHeight = frameSvg.hasAttribute("height") ? Number(frameSvg.getAttribute("height")) : 450
        structureImg = await captureSVGAsImage("frame-structure-diagram", origWidth, origHeight)
        if (!structureImg) {
          yOffset = addWrappedText("[Frame Structure Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 9)
          yOffset += 10
        } else {
          const aspect = origHeight / origWidth
          const maxDiagramWidth = contentWidth * 0.9
          const diagramWidth = Math.min(maxDiagramWidth, 160)
          const diagramHeight = Math.round(diagramWidth * aspect)
          // Ensure diagram fits on page
          if (yOffset + diagramHeight > pageHeight - 40) {
            pdf.addPage()
            yOffset = 40
          }
          const diagramX = (pageWidth - diagramWidth) / 2
          pdf.setDrawColor(0, 0, 0)
          pdf.setLineWidth(0.5)
          pdf.rect(diagramX - 3, yOffset - 3, diagramWidth + 6, diagramHeight + 6)
          try {
            pdf.addImage(structureImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
          } catch (error) {
            console.warn("Failed to add frame structure image to PDF:", error)
            const fallbackWidth = diagramWidth * 0.8
            const fallbackHeight = diagramHeight * 0.8
            pdf.addImage(structureImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
          }
          yOffset += diagramHeight + 12
        }
      }
    }
  } catch (error) {
    console.error("Error capturing structure diagram:", error)
    yOffset = addWrappedText(`[Structure Diagram Error: ${error instanceof Error ? error.message : 'Unknown error'}]`, margin, yOffset, contentWidth, 6, 9)
    yOffset += 10
  }

  // Corner Loads Diagram (for Base Frame only)
  if (analysisType === "Base Frame") {
    try {
      // Wait a bit to ensure page is ready
      await new Promise(resolve => setTimeout(resolve, 200))
      
      let svg = document.getElementById("corner-loads-diagram") as SVGSVGElement | null
      if (!svg) {
        // Try alternative search
        const allSvgs = document.querySelectorAll('svg[id="corner-loads-diagram"]')
        if (allSvgs.length > 0) {
          svg = allSvgs[0] as SVGSVGElement
        }
      }
      
      if (!svg) {
        console.warn("Corner Loads Diagram not found, adding placeholder text")
        yOffset = addWrappedText("[Corner Loads Diagram - Not found in DOM. Please ensure the diagram is visible before generating PDF.]", margin, yOffset, contentWidth, 6, 9)
        yOffset += 10
      } else {
        // Use the improved capture function
        const origWidth = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 700
        const origHeight = svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 520
        const aspect = origHeight / origWidth
        const maxDiagramWidth = contentWidth * 0.9
        const diagramWidth = Math.min(maxDiagramWidth, 160)
        const diagramHeight = Math.round(diagramWidth * aspect)
        const requiredHeight = diagramHeight + 20
        if (yOffset + requiredHeight > pageHeight - 40) {
          pdf.addPage()
          yOffset = 40
        }
        yOffset = addSubsectionHeader("4.2 Corner Loads Analysis", margin, yOffset)
        yOffset += 8
        const cornerImg = await captureSVGAsImage("corner-loads-diagram", origWidth, origHeight)
        if (cornerImg) {
          const diagramX = (pageWidth - diagramWidth) / 2
          pdf.setDrawColor(0, 0, 0)
          pdf.setLineWidth(0.5)
          pdf.rect(diagramX - 3, yOffset - 3, diagramWidth + 6, diagramHeight + 6)
          try {
            pdf.addImage(cornerImg, "PNG", diagramX, yOffset, diagramWidth, diagramHeight)
          } catch (error) {
            console.warn("Failed to add corner loads image to PDF:", error)
            const fallbackWidth = diagramWidth * 0.8
            const fallbackHeight = diagramHeight * 0.8
            pdf.addImage(cornerImg, "PNG", (pageWidth - fallbackWidth) / 2, yOffset, fallbackWidth, fallbackHeight)
          }
          yOffset += diagramHeight + 12
        } else {
          yOffset = addWrappedText("[Corner Loads Diagram - Unable to capture]", margin, yOffset, contentWidth, 6, 9)
          yOffset += 10
        }
      }
    } catch (error) {
      console.error("Error capturing corner loads diagram:", error)
      yOffset = addWrappedText(`[Corner Loads Diagram Error: ${error instanceof Error ? error.message : 'Unknown error'}]`, margin, yOffset, contentWidth, 6, 9)
      yOffset += 10
    }
  }

  // 5. FORCE DIAGRAMS
  pdf.addPage()
  yOffset = 40
  yOffset = addSectionHeader("5. Force Diagrams", margin, yOffset)
  yOffset += 10

  // Helper function for force diagrams
  const addForceDiagram = async (diagramId: string, title: string, yPos: number): Promise<number> => {
    yPos = addSubsectionHeader(title, margin, yPos)
    yPos += 8
    try {
      const container = document.getElementById(diagramId)
      if (!container) throw new Error(`${title} container not found in DOM`)
      container.scrollIntoView({ behavior: 'instant', block: 'center' })
      await new Promise(resolve => setTimeout(resolve, 800))
      const svg = container.querySelector("svg") as SVGSVGElement | null
      if (!svg) {
        const nestedSvg = container.querySelector("div > svg") as SVGSVGElement | null
        if (!nestedSvg) throw new Error(`${title} SVG not found in DOM`)
        const rect = nestedSvg.getBoundingClientRect()
        const origWidth = rect.width > 0 ? rect.width : 1248
        const origHeight = rect.height > 0 ? rect.height : 300
        const aspect = origHeight / origWidth
        const maxDiagramWidth = contentWidth * 0.9
        const diagramWidth = Math.min(maxDiagramWidth, 160)
        const diagramHeight = Math.round(diagramWidth * aspect)
        // Check if diagram fits on page
        if (yPos + diagramHeight > pageHeight - 40) {
          pdf.addPage()
          yPos = 40
          yPos = addSubsectionHeader(title, margin, yPos)
          yPos += 8
        }
        const diagramX = (pageWidth - diagramWidth) / 2
        const img = await svgToPngDataUrl(nestedSvg, origWidth, origHeight)
        if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG")
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.5)
        pdf.rect(diagramX - 3, yPos - 3, diagramWidth + 6, diagramHeight + 6)
        try {
          pdf.addImage(img, "PNG", diagramX, yPos, diagramWidth, diagramHeight)
        } catch (error) {
          console.warn("Failed to add diagram image to PDF:", error)
          const fallbackWidth = diagramWidth * 0.8
          const fallbackHeight = diagramHeight * 0.8
          pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yPos, fallbackWidth, fallbackHeight)
        }
        return yPos + diagramHeight + 15
      } else {
        const rect = svg.getBoundingClientRect()
        const origWidth = rect.width > 0 ? rect.width : (svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 1248)
        const origHeight = rect.height > 0 ? rect.height : (svg.hasAttribute("height") ? Number(svg.getAttribute("height")) : 300)
        const aspect = origHeight / origWidth
        const maxDiagramWidth = contentWidth * 0.9
        const diagramWidth = Math.min(maxDiagramWidth, 160)
        const diagramHeight = Math.round(diagramWidth * aspect)
        // Check if diagram fits on page
        if (yPos + diagramHeight > pageHeight - 40) {
          pdf.addPage()
          yPos = 40
          yPos = addSubsectionHeader(title, margin, yPos)
          yPos += 8
        }
        const diagramX = (pageWidth - diagramWidth) / 2
        const img = await svgToPngDataUrl(svg, origWidth, origHeight)
        if (!img || img.length === 0) throw new Error("Failed to convert SVG to PNG")
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.5)
        pdf.rect(diagramX - 3, yPos - 3, diagramWidth + 6, diagramHeight + 6)
        try {
          pdf.addImage(img, "PNG", diagramX, yPos, diagramWidth, diagramHeight)
        } catch (error) {
          console.warn("Failed to add diagram image to PDF:", error)
          const fallbackWidth = diagramWidth * 0.8
          const fallbackHeight = diagramHeight * 0.8
          pdf.addImage(img, "PNG", (pageWidth - fallbackWidth) / 2, yPos, fallbackWidth, fallbackHeight)
        }
        return yPos + diagramHeight + 15
      }
    } catch (err) {
      console.error(`Error capturing ${title}:`, err)
      return addWrappedText(`[${title} Error: ${err instanceof Error ? err.message : 'Could not be captured'}]`, margin, yPos, contentWidth, 6, 9) + 10
    }
  }

  // Shear Force Diagram
  yOffset = await addForceDiagram("shear-force-diagram", "5.1 Shear Force Diagram", yOffset)
  
  // Bending Moment Diagram
  if (yOffset > pageHeight - 100) {
    pdf.addPage()
    yOffset = 40
  }
  yOffset = await addForceDiagram("bending-moment-diagram", "5.2 Bending Moment Diagram", yOffset)
  
  // Deflection Diagram
  if (yOffset > pageHeight - 100) {
    pdf.addPage()
    yOffset = 40
  }
  yOffset = await addForceDiagram("deflection-diagram", "5.3 Deflection Diagram", yOffset)

  // LaTeX-style headers and footers on all pages
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    
    // Header line (subtle)
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.3)
    pdf.line(margin, 20, pageWidth - margin, 20)
    
    // Header text
    pdf.setFontSize(8)
    pdf.setFont("times", "normal")
    pdf.setTextColor(0, 0, 0)
    pdf.text("Structural Load Analysis Report", margin, 16)
    pdf.text(analysisType, pageWidth - margin, 16, { align: "right" })
    
    // Footer line (subtle)
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.3)
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
    
    // Footer text
    pdf.setFontSize(8)
    pdf.setFont("times", "italic")
    pdf.setTextColor(0, 0, 0)
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" })
    pdf.text(`Generated: ${now.toLocaleDateString()}`, pageWidth - margin, pageHeight - 10, { align: "right" })
    
    // Reset text color
    pdf.setTextColor(0, 0, 0)
  }

  // Save the PDF
  const fileName = `${analysisType.toLowerCase().replace(" ", "_")}_analysis_report_${new Date().toISOString().split("T")[0]}.pdf`
  pdf.save(fileName)
}
