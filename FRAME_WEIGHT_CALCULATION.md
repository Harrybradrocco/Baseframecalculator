# Frame Weight Calculation Explanation

## Overview
The frame weight is calculated based on the cross-sectional area of the beam profile, the total length of all frame members, the material density, and gravity.

## Formula

```
Frame Weight (N) = Cross-Sectional Area (m²) × Total Frame Length (m) × Density (kg/m³) × Gravity (9.81 m/s²)
```

Or in steps:
1. **Cross-Sectional Area** = Area of the beam profile (calculated based on beam type)
2. **Total Frame Length** = Perimeter of the frame = 2 × (Length + Width)
3. **Volume** = Cross-Sectional Area × Total Frame Length
4. **Mass** = Volume × Density
5. **Weight** = Mass × Gravity

## Detailed Calculation

### Step 1: Calculate Cross-Sectional Area
The cross-sectional area depends on the beam profile selected:

#### Rectangular Beam
```
Area = Width × Height
```

#### I-Beam
```
Area = 2 × (Flange Width × Flange Thickness) + (Height - 2 × Flange Thickness) × Web Thickness
```

#### C-Channel
```
Area = 2 × (Flange Width × Flange Thickness) + (Height - 2 × Flange Thickness) × Web Thickness
```

#### Circular Beam
```
Area = π × (Diameter/2)²
```

### Step 2: Calculate Total Frame Length
For a rectangular frame with 4 beams:
```
Total Length = 2 × Frame Length + 2 × Frame Width
            = 2 × (Frame Length + Frame Width)
            = Perimeter
```

This accounts for:
- 2 beams of length = Frame Length
- 2 beams of length = Frame Width

### Step 3: Calculate Volume
```
Volume (m³) = Cross-Sectional Area (m²) × Total Frame Length (m)
```

### Step 4: Calculate Weight
```
Weight (N) = Volume (m³) × Density (kg/m³) × 9.81 (m/s²)
```

## Example Calculation

Given:
- **Beam Type**: Rectangular
- **Width**: 100 mm = 0.1 m
- **Height**: 218 mm = 0.218 m
- **Frame Length**: 2000 mm = 2.0 m
- **Frame Width**: 1000 mm = 1.0 m
- **Material Density**: 7850 kg/m³ (steel)

### Step 1: Cross-Sectional Area
```
Area = 0.1 m × 0.218 m = 0.0218 m²
```

### Step 2: Total Frame Length
```
Total Length = 2 × (2.0 m + 1.0 m) = 6.0 m
```

### Step 3: Volume
```
Volume = 0.0218 m² × 6.0 m = 0.1308 m³
```

### Step 4: Weight
```
Weight = 0.1308 m³ × 7850 kg/m³ × 9.81 m/s²
      = 10,070 N
      = 1,026 kg
```

## Verification

To verify the calculation is correct:

1. **Check Units**: Ensure all units are consistent (meters, kg, N)
2. **Check Formula**: Volume = Area × Length is correct
3. **Check Density**: Material density should match standard values:
   - Steel: ~7850 kg/m³
   - Aluminum: ~2700 kg/m³
   - Concrete: ~2400 kg/m³
4. **Check Gravity**: 9.81 m/s² is standard Earth gravity

## Common Issues

### Issue 1: Weight Always Shows Same Value
**Possible Causes:**
- Calculations not updating when inputs change
- Default values being used
- React state not updating properly

**Solution:**
- Check browser console for calculation logs (in development mode)
- Verify all input fields are connected to state
- Check that `useEffect` dependencies include all relevant inputs

### Issue 2: Weight Seems Too High/Low
**Possible Causes:**
- Incorrect unit conversions (mm vs m)
- Wrong density value
- Incorrect cross-sectional area calculation

**Solution:**
- Verify all inputs are in correct units
- Check material density matches your material
- Manually calculate using the formula above

### Issue 3: Weight Doesn't Match Expected Value
**Possible Causes:**
- Frame structure assumption (4 beams) may not match actual structure
- Additional frame members not accounted for
- Different beam profiles for different sides

**Solution:**
- The current calculation assumes 4 identical beams forming a rectangle
- If your frame has additional members (diagonals, cross-braces), they're not included
- If different sides use different beam profiles, only one profile is used

## Manual Verification Steps

1. **Calculate Cross-Sectional Area manually**
   - Use the appropriate formula for your beam type
   - Convert all dimensions to meters

2. **Calculate Total Frame Length manually**
   - Measure or calculate the perimeter
   - Convert to meters

3. **Calculate Volume manually**
   - Multiply area × length

4. **Calculate Weight manually**
   - Multiply volume × density × 9.81

5. **Compare with App Result**
   - Check if values match
   - If they don't match, check each step for errors

## Notes

- The frame weight is distributed equally to all 4 corners (R1, R2, R3, R4)
- Each corner receives: Frame Weight / 4
- The frame weight is also included in `totalAppliedLoad` for stress/deflection calculations
- The calculation assumes all 4 beams have the same cross-sectional profile
- The calculation assumes a simple rectangular frame (no additional members)

