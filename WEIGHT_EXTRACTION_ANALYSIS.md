# Weight Information Extraction and Utilization Analysis

## Current State

### Weight Information Already in Use
The app currently utilizes weight information in several ways:

1. **Section-Level Weights:**
   - `casingWeight`: Total casing weight per section
   - `baseframeWeight`: Baseframe weight per section length
   - `roofWeight`: Roof weight per section length
   - `primaryLoad`: Primary load distributed evenly across section

2. **Load Calculations:**
   - All section weights are converted to Newtons
   - Distributed to corner reactions using area method
   - Included in total applied load for stress/deflection calculations

3. **Frame Weight:**
   - Calculated from beam cross-section and material density (Simple Beam)
   - Sum of all section baseframe weights (Base Frame)
   - Distributed equally to all 4 corners

## Potential Weight Extraction Sources

### 1. **MATLAB Calculator Data Import**
**Format:** The MATLAB `BaseframeLoadCalculator.m` uses:
- Section data: `[Start Pos, Length, Casing Weight]`
- Component data: `[Section #, Position in Section, Weight]`
- Total weights: Roof and Baseframe weights for full length

**Implementation:**
- Create CSV/JSON import function
- Parse MATLAB-style data format
- Convert units (inches to mm, lbs to kg/N)
- Map to app's Section and Load structures

### 2. **Component Database/Spreadsheet**
**Format:** Excel/CSV with columns:
- Component Name/ID
- Weight (kg/lbs/N)
- Position (mm/in)
- Section assignment
- Dimensions (for distributed loads)

**Implementation:**
- File upload component
- Parse spreadsheet data
- Auto-generate Loads from component weights
- Group by section if section info available

### 3. **CAD File Weight Extraction**
**Format:** CAD files (STEP, IGES, etc.) contain:
- Component geometry
- Material properties
- Mass/weight information

**Implementation:**
- Requires CAD file parser library
- Extract mass/weight from CAD metadata
- Extract position from assembly structure
- More complex, may require backend service

### 4. **Bill of Materials (BOM) Import**
**Format:** BOM spreadsheets typically contain:
- Part numbers
- Quantities
- Weights per part
- Assembly positions

**Implementation:**
- Parse BOM format
- Calculate total weights per component
- Map to sections based on position data
- Generate loads automatically

## Recommended Implementation Approach

### Phase 1: CSV/JSON Import (Easiest, Most Practical)
**Benefits:**
- No external dependencies
- Works with existing MATLAB calculator data
- Easy to export from spreadsheets
- Supports manual data entry

**Format Example:**
```json
{
  "frameDimensions": {
    "length": 2000,
    "width": 1000,
    "units": "mm"
  },
  "sections": [
    {
      "name": "Section 1",
      "startPosition": 0,
      "endPosition": 1000,
      "casingWeight": 2000,
      "casingWeightUnit": "N",
      "baseframeWeight": 62,
      "baseframeWeightUnit": "kg",
      "roofWeight": 50,
      "roofWeightUnit": "kg"
    }
  ],
  "components": [
    {
      "name": "Fan",
      "sectionId": "section-1",
      "position": 500,
      "weight": 150,
      "weightUnit": "kg",
      "loadType": "Point Load"
    }
  ]
}
```

### Phase 2: Excel/CSV Spreadsheet Import
**Benefits:**
- Common format for engineering data
- Can handle large datasets
- Supports multiple sheets (sections, components)

**Format Example (CSV):**
```csv
Type,Name,Section,Position (mm),Weight,Unit,Load Type
Section,Section 1,1,0-1000,2000,N,Distributed
Component,Fan,1,500,150,kg,Point Load
Component,Filter,1,200,75,kg,Point Load
```

### Phase 3: Automatic Load Generation from Weights
**Benefits:**
- Reduces manual data entry
- Ensures consistency
- Can apply standard load distribution rules

**Logic:**
- Point loads: Use component weight directly
- Distributed loads: Calculate from weight density and area
- Section loads: Distribute evenly across section

## Implementation Plan

### Step 1: Create Weight Import Utility
- File upload component
- Parser for JSON/CSV formats
- Data validation
- Unit conversion

### Step 2: Map Imported Data to App Structures
- Convert to Section[] format
- Convert to Load[] format
- Handle unit conversions
- Validate positions and weights

### Step 3: Auto-Generate Loads from Weights
- Create Load objects from component weights
- Distribute section weights as uniform loads
- Calculate distributed load magnitudes from weight density

### Step 4: Integration with Existing UI
- Add "Import Weights" button
- Show import preview
- Allow editing before applying
- Save/load weight configurations

## Technical Considerations

### Unit Handling
- Support: N, kg, lbs
- Automatic conversion to internal format (N)
- Preserve original units for display

### Position Validation
- Ensure positions within frame/beam bounds
- Validate section boundaries
- Check for overlapping loads

### Data Mapping
- Section matching by name or position
- Component-to-section assignment
- Load type determination (Point vs Distributed)

### Error Handling
- Invalid file formats
- Missing required fields
- Unit conversion errors
- Position out of bounds

## Example Use Cases

### Use Case 1: Import from MATLAB Calculator
1. Export section and component data from MATLAB
2. Convert to JSON format
3. Import into web app
4. Automatically populate sections and loads
5. Calculate corner reactions

### Use Case 2: Import from Component Database
1. Export component list with weights and positions
2. Import CSV file
3. Auto-generate point loads for each component
4. Group by section if section info available
5. Calculate loads

### Use Case 3: Import from BOM
1. Export BOM with weights and assembly positions
2. Import spreadsheet
3. Map components to sections
4. Generate loads automatically
5. Review and adjust as needed

## Benefits

1. **Time Savings:** Reduces manual data entry
2. **Accuracy:** Eliminates transcription errors
3. **Consistency:** Standardized import format
4. **Flexibility:** Supports multiple data sources
5. **Traceability:** Can track weight sources

## Next Steps

1. **Investigate:** Determine most common data source format
2. **Prototype:** Create basic CSV/JSON import
3. **Test:** Validate with real project data
4. **Enhance:** Add Excel support if needed
5. **Document:** Create user guide for import format
