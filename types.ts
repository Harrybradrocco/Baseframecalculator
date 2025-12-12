export interface Section {
  id: string
  startPosition: number // mm
  endPosition: number // mm
  casingWeight: number // Total casing weight for this section
  casingWeightUnit: "N" | "kg" | "lbs"
  primaryLoad: number // Primary load for this section (distributed evenly)
  primaryLoadUnit: "N" | "kg" | "lbs"
  name?: string // Optional section name
}

export interface Load {
  type: "Point Load" | "Uniform Load" | "Distributed Load"
  magnitude: number
  startPosition: number
  endPosition?: number
  area?: number // For backward compatibility and simple beam
  loadLength?: number // Length of distributed load component (mm) - for baseframe
  loadWidth?: number // Width of distributed load component (mm) - for baseframe
  unit?: "N" | "kg" | "lbs" // Add unit field
  name?: string // Name/label for the load to display in diagrams
  sectionId?: string // Optional: associate load with a section
}

export interface MaterialProperties {
  yieldStrength: number
  elasticModulus: number
  density: number
  poissonsRatio: number
  thermalExpansion: number
}

export interface Results {
  maxShearForce: number
  maxBendingMoment: number
  maxNormalStress: number
  maxShearStress: number
  safetyFactor: number
  totalBeams: number
  loadPerBeam: number
  momentOfInertia: number
  sectionModulus: number
  cornerReactionForce: number
  cornerReactions: { R1: number; R2: number; R3: number; R4: number }
  maxDeflection: number
  totalAppliedLoad: number
}

