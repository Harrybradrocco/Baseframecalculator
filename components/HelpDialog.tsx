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

            {/* Base Frame Analysis */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Base Frame Analysis</h3>
              <p className="text-sm text-gray-600 mb-2">
                For base frame analysis, loads are distributed to four corner reactions (R1, R2, R3, R4) using the area method:
              </p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                Rᵢ = Σ(Pⱼ × Aᵢⱼ / A_total)
              </p>
              <p className="text-sm text-gray-600">
                Where Pⱼ = load weight, Aᵢⱼ = area from load center to corner i, A_total = total frame area
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Corner positions: R1 (top-left), R2 (top-right), R3 (bottom-left), R4 (bottom-right)
              </p>
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

