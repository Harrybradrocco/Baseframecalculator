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
    console.log('Starting OCR worker creation...')
    if (onProgress) onProgress(5)
    
    // Create worker with error handling
    worker = await createWorker('eng', 1, {
      logger: (m) => {
        console.log('OCR progress:', m)
        if (onProgress) {
          if (m.status === 'loading tesseract core') {
            onProgress(10)
          } else if (m.status === 'initializing tesseract') {
            onProgress(20)
          } else if (m.status === 'loading language traineddata') {
            onProgress(30)
          } else if (m.status === 'initializing api') {
            onProgress(40)
          } else if (m.status === 'recognizing text') {
            const progress = 40 + Math.round(m.progress * 60) // 40-100%
            onProgress(progress)
          }
        }
      },
    })
    
    console.log('Worker created, starting recognition...')
    if (onProgress) onProgress(50)
    
    // Add timeout to prevent hanging
    const recognitionPromise = worker.recognize(imageFile)
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('OCR timeout after 60 seconds')), 60000)
    )
    
    const { data: { text } } = await Promise.race([recognitionPromise, timeoutPromise])
    
    console.log('OCR completed, extracted text length:', text.length)
    if (onProgress) onProgress(100)
    
    return text
  } catch (error) {
    console.error('OCR error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`OCR failed: ${errorMessage}. Make sure tesseract.js is properly installed.`)
  } finally {
    if (worker) {
      try {
        await worker.terminate()
        console.log('OCR worker terminated')
      } catch (err) {
        console.warn('Error terminating worker:', err)
      }
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
