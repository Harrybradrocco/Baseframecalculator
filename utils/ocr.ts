/**
 * OCR Utility
 * 
 * This module provides functionality to extract text from images using OCR
 * and parse it into structured weight data.
 */

import { createWorker, type Worker } from 'tesseract.js'

/**
 * Extract text from an image using OCR
 */
export async function extractTextFromImage(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  let worker: Worker | null = null
  try {
    worker = await createWorker('eng')
    
    const { data: { text } } = await worker.recognize(imageFile, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const progress = Math.round(m.progress * 100)
          onProgress(progress)
        }
      },
    })
    
    return text
  } catch (error) {
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    if (worker) {
      await worker.terminate()
    }
  }
}

/**
 * Parse OCR text to extract table data
 * Attempts to identify table structure from OCR text
 */
export function parseOCRTextToTable(ocrText: string): string {
  const lines = ocrText.split('\n').filter(line => line.trim().length > 0)
  
  // Try to identify table structure
  // Look for common table patterns: numbers, section codes, function codes, weights
  
  // Find header row (usually contains "Section", "Function", "Weight")
  let headerIndex = -1
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].toLowerCase()
    if ((line.includes('section') && line.includes('no')) || 
        (line.includes('section') && line.includes('code')) ||
        (line.includes('function') && line.includes('code'))) {
      headerIndex = i
      break
    }
  }
  
  // If we found a header, use it and the following lines
  if (headerIndex >= 0) {
    const tableLines = [lines[headerIndex], ...lines.slice(headerIndex + 1)]
    return tableLines.join('\n')
  }
  
  // Otherwise, return all lines (user can manually clean up)
  return lines.join('\n')
}

/**
 * Process image and extract table data
 */
export async function processImageWithOCR(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const ocrText = await extractTextFromImage(imageFile, onProgress)
  const tableData = parseOCRTextToTable(ocrText)
  return tableData
}
