# Weight Import Feature - User Guide

## Overview

The weight import feature allows you to extract weight information from external sources (JSON or CSV files) and automatically populate sections and loads in the app. This eliminates manual data entry and reduces errors.

## How to Access

1. Navigate to the **Sections Management** card (only visible for "Base Frame" analysis type)
2. Click the **"Import Weights"** button next to "Add Section"
3. The import dialog will open

## Supported Formats

### JSON Format

The JSON format supports importing:
- Frame dimensions
- Sections with weights (casing, baseframe, roof, primary loads)
- Components with positions and weights
- Total weights for automatic distribution

**Example JSON:**
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
      "sectionIndex": 0,
      "position": 500,
      "weight": 150,
      "weightUnit": "kg",
      "loadType": "Point Load"
    }
  ]
}
```

### CSV Format

The CSV format is simpler and supports:
- Sections with weights
- Components with positions and weights

**Example CSV:**
```csv
Type,Name,Section,Position (mm),Weight,Unit,Load Type,Length (mm),Width (mm)
Section,Section 1,1,0-1000,2000,N,Distributed,1000,1000
Component,Fan,1,500,150,kg,Point Load,,
Component,Filter,1,200,75,kg,Point Load,,
```

**CSV Column Requirements:**
- **Type**: Must be "Section" or "Component"
- **Name**: Optional name/label
- **Section**: Section number (1-based) or name
- **Position (mm)**: Position in mm (for sections: "start-end" format)
- **Weight**: Weight value
- **Unit**: "N", "kg", or "lbs"
- **Load Type**: "Point Load", "Distributed Load", or "Uniform Load"
- **Length (mm)**: Optional, for distributed loads
- **Width (mm)**: Optional, for distributed loads

## Import Process

1. **Select Format**: Choose JSON or CSV
2. **Upload File**: Click "Upload File" and select your file, OR
3. **Paste Data**: Paste your data directly into the text area
4. **Parse Data**: Click "Parse Data" to validate and preview
5. **Review Preview**: Check the preview to see what will be imported
6. **Apply Import**: Click "Apply Import" to populate the app

## Features

### Automatic Unit Conversion
- All weights are converted to Newtons internally
- Original units are preserved for display
- Supports: N, kg, lbs

### Section Mapping
Components can be assigned to sections by:
- Section ID (from imported sections)
- Section name
- Section index (0-based)

### Position Calculation
- Component positions are relative to section start
- Automatically converted to absolute positions
- Validated against frame boundaries

### Load Type Detection
- **Point Load**: Single weight at a position
- **Distributed Load**: Weight distributed over an area
- **Uniform Load**: Weight distributed over a length

## Template Download

Click "Download Template" to get a sample JSON file with the correct structure. You can use this as a starting point for your own data.

## Use Cases

### Use Case 1: Import from MATLAB Calculator
1. Export section and component data from MATLAB
2. Convert to JSON format (see template)
3. Import into web app
4. Automatically populate sections and loads

### Use Case 2: Import from Spreadsheet
1. Create CSV file with component weights and positions
2. Use the CSV format shown above
3. Import and auto-generate loads

### Use Case 3: Import from Component Database
1. Export component list with weights
2. Format as JSON or CSV
3. Import to automatically create loads

## Data Validation

The import process validates:
- ✅ Required fields are present
- ✅ Weight values are positive
- ✅ Positions are within frame bounds
- ✅ Section boundaries are valid
- ✅ Unit conversions are correct

## Error Handling

If import fails:
- Error message will explain the issue
- Check file format matches expected structure
- Verify units are correct (N, kg, lbs)
- Ensure positions are within frame dimensions

## Tips

1. **Start with Template**: Download the template to see the correct format
2. **Test with Small Data**: Import a few sections/components first
3. **Check Preview**: Always review the preview before applying
4. **Backup First**: Consider saving current configuration before importing
5. **Edit After Import**: You can still edit sections and loads after importing

## Limitations

- Maximum 10 sections (same as manual entry)
- Maximum 10 loads (same as manual entry)
- CSV format is simpler than JSON (fewer options)
- File size should be reasonable (< 1MB recommended)

## Future Enhancements

Potential future improvements:
- Excel (.xlsx) file support
- CAD file weight extraction
- Direct integration with component databases
- Batch import from multiple files
- Export current configuration for backup

## Support

For issues or questions:
- Check the preview to see what will be imported
- Verify your data format matches the examples
- Use the template as a reference
- Review error messages for specific issues
