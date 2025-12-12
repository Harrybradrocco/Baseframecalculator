# Code Refactoring Structure

This document explains the modular structure of the refactored codebase.

## File Structure

```
Baseframecalculator/
├── types.ts                          # TypeScript interfaces (Load, Section, Results, etc.)
├── constants.ts                      # Constants (standardMaterials)
├── utils/
│   ├── validation.ts                # Validation helper functions
│   ├── conversions.ts               # Unit conversion functions
│   └── svgToPng.ts                  # SVG to PNG conversion utility
├── components/
│   ├── diagrams/
│   │   ├── BeamDiagram.tsx          # Beam structure diagram component
│   │   ├── FrameDiagram.tsx         # Frame structure diagram component
│   │   ├── CornerLoadsDiagram.tsx   # Corner loads diagram component
│   │   └── index.ts                 # Diagram exports
│   ├── BeamCrossSectionImage.tsx     # Cross-section visualization
│   └── HelpDialog.tsx               # Help dialog component
└── beam-load-calculator.tsx          # Main component (simplified)
```

## Module Responsibilities

### `types.ts`
- Defines all TypeScript interfaces used across the application
- `Load`, `Section`, `MaterialProperties`, `Results`

### `constants.ts`
- Contains material property constants
- `standardMaterials` object with material definitions

### `utils/validation.ts`
- `validateNumber()` - Validates numeric inputs
- `validatePositive()` - Ensures positive values

### `utils/conversions.ts`
- `kgToN()` - Convert kilograms to Newtons
- `lbsToN()` - Convert pounds to Newtons
- `getLoadMagnitudeInN()` - Get load magnitude in Newtons
- `convertSectionWeightToN()` - Convert section weight to Newtons

### `utils/svgToPng.ts`
- `svgToPngDataUrl()` - Converts SVG elements to PNG data URLs for PDF generation

### `components/diagrams/`
- **BeamDiagram**: Renders beam structure with supports and loads
- **FrameDiagram**: Renders base frame structure with loads and sections
- **CornerLoadsDiagram**: Renders corner reaction forces visualization

### `components/HelpDialog.tsx`
- Help dialog with calculation formulas and explanations

### `components/BeamCrossSectionImage.tsx`
- Visual representation of different beam cross-sections

## Benefits

1. **Maintainability**: Each module has a single responsibility
2. **Reusability**: Components and utilities can be reused
3. **Testability**: Smaller modules are easier to test
4. **Readability**: Main file is much shorter and easier to understand
5. **Collaboration**: Multiple developers can work on different modules

## Usage

Import from modules as needed:

```typescript
import type { Load, Section } from "./types"
import { standardMaterials } from "./constants"
import { validatePositive } from "./utils/validation"
import { getLoadMagnitudeInN } from "./utils/conversions"
import { BeamDiagram, FrameDiagram } from "./components/diagrams"
```

