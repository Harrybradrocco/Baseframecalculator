import type React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { HelpCircle } from "lucide-react"

export const HelpDialog: React.FC = () => {
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
          <div className="space-y-6 p-4">
            {/* Shear Force */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Shear Force</h3>
              <p className="text-sm text-gray-600 mb-2">For simply supported beam:</p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">V(x) = R₁ - ΣPᵢ - Σwᵢ(x - aᵢ)</p>
              <p className="text-sm text-gray-600">
                Where R₁ = left reaction, Pᵢ = point loads, wᵢ = distributed loads, aᵢ = load positions
              </p>
            </section>

            {/* Bending Moment */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Bending Moment</h3>
              <p className="text-sm text-gray-600 mb-2">For simply supported beam:</p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">M(x) = R₁(x - a) - ΣPᵢ(x - aᵢ) - Σwᵢ(x - aᵢ)²/2</p>
              <p className="text-sm text-gray-600">
                Where R₁ = left reaction, a = left support position, Pᵢ = point loads, wᵢ = distributed loads
              </p>
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

            {/* Base Frame Analysis - Corner Reactions */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Base Frame Analysis - Corner Reactions</h3>
              <p className="text-sm text-gray-600 mb-2">
                For base frame analysis, loads are distributed to four corner reactions (R1, R2, R3, R4) using the <strong>area method</strong>:
              </p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-2">
                Rᵢ = Σ(Pⱼ × Aᵢⱼ / A_total) + Frame Weight / 4
              </p>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>Where:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Pⱼ = load weight (in Newtons)</li>
                  <li>Aᵢⱼ = area of rectangle from load center to the <strong>opposite</strong> corner i</li>
                  <li>A_total = total frame area (L × W)</li>
                  <li>Frame Weight = weight of the frame structure itself, distributed equally to all 4 corners</li>
                </ul>
                <p className="mt-2"><strong>Corner positions:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>R1 = Top-left corner (0, 0)</li>
                  <li>R2 = Top-right corner (L, 0)</li>
                  <li>R3 = Bottom-left corner (0, W)</li>
                  <li>R4 = Bottom-right corner (L, W)</li>
                </ul>
                <p className="mt-2"><strong>Area calculation for each corner:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>For R1 (top-left): A₁ = (L - x_load) × (W - y_load)</li>
                  <li>For R2 (top-right): A₂ = x_load × (W - y_load)</li>
                  <li>For R3 (bottom-left): A₃ = (L - x_load) × y_load</li>
                  <li>For R4 (bottom-right): A₄ = x_load × y_load</li>
                </ul>
                <p className="mt-2 text-xs italic">
                  Where x_load and y_load are the load center coordinates. This method ensures loads closer to a corner produce higher reactions at that corner.
                </p>
              </div>
            </section>

            {/* Stress Calculations */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Stress Calculations</h3>
              
              <div className="mb-3">
                <h4 className="font-medium text-sm mb-2">Normal Stress (Bending Stress):</h4>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-2">
                  σ = M / S
                </p>
                <p className="text-sm text-gray-600">
                  Where M = maximum bending moment (N·m), S = section modulus (m³). Result is in Pa, converted to MPa (1 MPa = 10⁶ Pa).
                </p>
              </div>

              <div className="mb-3">
                <h4 className="font-medium text-sm mb-2">Shear Stress:</h4>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-2">
                  τ = 1.5 × V / A
                </p>
                <p className="text-sm text-gray-600">
                  Where V = maximum shear force (N), A = cross-sectional area (m²). The factor 1.5 accounts for the maximum shear stress in rectangular sections (occurs at the neutral axis). Result is in Pa, converted to MPa.
                </p>
              </div>

              <div className="mb-3">
                <h4 className="font-medium text-sm mb-2">Safety Factor:</h4>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-2">
                  SF = σ_yield / σ_max
                </p>
                <p className="text-sm text-gray-600">
                  Where σ_yield = material yield strength (MPa), σ_max = maximum normal stress (MPa). A safety factor ≥ 2.0 is typically recommended for structural applications.
                </p>
              </div>
            </section>

            {/* Cross-Sectional Properties */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Cross-Sectional Properties</h3>
              
              <div className="mb-3">
                <h4 className="font-medium text-sm mb-2">Moment of Inertia (I):</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside ml-2">
                  <li><strong>Rectangular:</strong> I = b·h³/12</li>
                  <li><strong>I-Beam:</strong> I = 2(I_flange + I_parallel) + I_web</li>
                  <li><strong>C-Channel:</strong> I = 2·I_flange + I_web</li>
                  <li><strong>Circular:</strong> I = π·d⁴/64</li>
                </ul>
              </div>

              <div className="mb-3">
                <h4 className="font-medium text-sm mb-2">Section Modulus (S):</h4>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-2">
                  S = I / c
                </p>
                <p className="text-sm text-gray-600">
                  Where I = moment of inertia, c = distance from neutral axis to extreme fiber (typically h/2 for symmetric sections).
                </p>
              </div>
            </section>

            {/* Units */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Units Used</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Length: millimeters (mm)</li>
                <li>• Force: Newtons (N), kilograms (kg), or pounds (lbs)</li>
                <li>• Stress: Megapascals (MPa)</li>
                <li>• Deflection: millimeters (mm)</li>
                <li>• Moment: Newton-meters (N·m)</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

