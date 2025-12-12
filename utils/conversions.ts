import type { Load } from "../types"

// Unit conversion functions
export const kgToN = (kg: number): number => kg * 9.81
export const lbsToN = (lbs: number): number => lbs * 4.44822 // 1 pound-force = 4.44822 Newtons

// Helper function to get load magnitude in N
export const getLoadMagnitudeInN = (load: Load): number => {
  if (load.unit === "kg") {
    return kgToN(load.magnitude)
  } else if (load.unit === "lbs") {
    return lbsToN(load.magnitude)
  }
  return load.magnitude // Default to N
}

// Convert section weight to N
export const convertSectionWeightToN = (weight: number, unit: "N" | "kg" | "lbs"): number => {
  if (unit === "kg") {
    return weight * 9.81
  } else if (unit === "lbs") {
    return weight * 4.44822
  }
  return weight
}

