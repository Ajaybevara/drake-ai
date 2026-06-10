// static/well_log_viewer/js/las_utils.js

// /**
//  * Fetches the content of a LAS file from the server.
//  * @param {string} filename - The name of the LAS file.
//  * @returns {Promise<string>} A promise that resolves with the text content of the file.
//  */

/**
 * Fetches the content of a LAS file from the server.
 * @param {string} projectName - The name of the project.
 * @param {string|null} wellName - The name of the well (null for spliced files).
 * @param {string} filename - The name of the LAS file.
 * @returns {Promise<string>} A promise that resolves with the text content of the file.
 */
async function fetchLasFile(projectName, wellName, filename) {
    let url;
    if (wellName) {
        // Source file URL
        url = `/get_las/${encodeURIComponent(projectName)}/${encodeURIComponent(wellName)}/${encodeURIComponent(filename)}`;
    } else {
        // Spliced file URL (no well name)
        url = `/get_las/${encodeURIComponent(projectName)}/${encodeURIComponent(filename)}`;
    }
    console.log("Fetching LAS from URL:", url); // Log the URL being fetched

    const response = await fetch(url);
    if (!response.ok) {
        const errorText = await response.text().catch(() => `HTTP error! status: ${response.status}`);
        // Try parsing as JSON for more specific error, fallback to text
        let specificError = errorText;
        try {
            const errorData = JSON.parse(errorText);
            specificError = errorData.error || errorText;
        } catch (e) { /* Ignore JSON parse error, use text */ }
        throw new Error(`Failed to fetch ${filename}: ${specificError}`);
    }
    return response.text();
}



/**
 * Parses LAS file content into a structured JSON object.
 * Handles basic LAS 2.0 structure.
 * @param {string} lasContent - The raw text content of the LAS file.
 * @param {string} filename - The original filename (for reference).
 * @returns {object} Parsed LAS data including headers, well info, curve info, parameters, and data.
 */
function parseLAS(lasContent, filename = 'unknown') {
    const lines = lasContent.split(/\r?\n/);
    const lasData = {
        filename: filename,
        versionInfo: {},
        wellInfo: {},
        curveInfo: [],
        paramInfo: [],
        other: '',
        data: {}, // Will hold arrays for each curve { DEPT: [...], GR: [...], ... }
        asciiLogDataStartIndex: -1,
        parsingErrors: []
    };

    let currentSection = null; // e.g., '~V', '~W', '~C', '~P', '~A'
    let headerLines = { '~V': [], '~W': [], '~C': [], '~P': [] };

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // Skip empty lines
        if (trimmedLine === '') {
            return;
        }

        // Detect section headers
        if (trimmedLine.startsWith('~')) {
            currentSection = trimmedLine.substring(0, 2).toUpperCase(); // Get section like ~V, ~W etc.
            if (currentSection === '~A') {
                lasData.asciiLogDataStartIndex = index + 1;
                // The rest of the file is data, stop header processing
                return;
            }
            // Reset headerLines for the new section if needed, or handle differently based on spec
             if (!headerLines[currentSection]) {
                 headerLines[currentSection] = []; // Initialize if section not standard
             }
            return; // Skip the section header line itself
        }

        // Ignore comment lines unless inside ~Other
        if (trimmedLine.startsWith('#') && currentSection !== '~O') {
            return;
        }

        // Process lines based on the current section
        if (currentSection && headerLines[currentSection] && lasData.asciiLogDataStartIndex === -1) {
            headerLines[currentSection].push(line); // Store the original line
            parseHeaderLine(line, currentSection, lasData);
        } else if (currentSection === '~O') {
             lasData.other += line + '\n';
        }
    });

    // --- Data Section Parsing ---
    if (lasData.asciiLogDataStartIndex !== -1 && lasData.curveInfo.length > 0) {
        const curveMnemonics = lasData.curveInfo.map(c => c.mnemonic);
        const nullValue = parseFloat(lasData.wellInfo.NULL?.value) || -999.25; // Get NULL value or use default

        // Initialize data arrays
        curveMnemonics.forEach(mnemonic => {
            lasData.data[mnemonic] = [];
        });

        const numCurves = curveMnemonics.length;

        for (let i = lasData.asciiLogDataStartIndex; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                continue; // Skip empty lines and comments in data
            }

            // Split by whitespace (handles multiple spaces)
            const values = trimmedLine.split(/\s+/);

            if (values.length < numCurves) {
                // Handle potential wrap text if WRAP=YES (more complex, basic handling here)
                if (lasData.versionInfo.WRAP?.value?.toUpperCase() !== 'YES') {
                     lasData.parsingErrors.push(`Line ${i + 1}: Expected ${numCurves} values, found ${values.length}. Skipping line.`);
                     console.warn(`LAS Parsing Warning (${filename}): Line ${i + 1}: Expected ${numCurves} values, found ${values.length}. Data: "${trimmedLine}"`);
                }
                // Basic WRAP handling would require looking ahead/behind, omitted for brevity
                continue; // Skip lines that don't match expected columns (unless WRAP=YES)
            }


            values.slice(0, numCurves).forEach((valueStr, curveIndex) => {
                const mnemonic = curveMnemonics[curveIndex];
                const value = parseFloat(valueStr);

                // Store the value (or null if it matches the NULL definition)
                // Be careful with floating point comparisons
                if (isNaN(value) || Math.abs(value - nullValue) < 0.0001) {
                    lasData.data[mnemonic].push(null);
                } else {
                    lasData.data[mnemonic].push(value);
                }
            });
        }
    } else if (lasData.asciiLogDataStartIndex === -1) {
         lasData.parsingErrors.push("Could not find the '~A' data section header.");
         console.warn(`LAS Parsing Warning (${filename}): Could not find the '~A' data section header.`);
    } else if (lasData.curveInfo.length === 0) {
         lasData.parsingErrors.push("Found '~A' section but no curves defined in '~C'.");
         console.warn(`LAS Parsing Warning (${filename}): Found '~A' section but no curves defined in '~C'.`);
    }


    return lasData;
}

/**
 * Helper to parse a single header line based on LAS 2.0 format.
 * Mnemonic.Unit Data Description...
 * @param {string} line - The line to parse.
 * @param {string} section - The current section ('~V', '~W', '~C', '~P').
 * @param {object} lasData - The main data object to populate.
 */
function parseHeaderLine(line, section, lasData) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('#')) return; // Skip comments

    // Regex to capture Mnemonic, Unit, Value, and Description
    // Allows for empty units. Handles values potentially including spaces before description.
    // Mnem.Unit Value    : Description
    // GR  .GAPI 123.45   : Gamma Ray Log
    const match = trimmedLine.match(/^(\w+)\s*\.(\S*)\s+([^:]+?)\s*:\s*(.*)$/);

    if (match) {
        const mnemonic = match[1].trim();
        const unit = match[2].trim();
        const value = match[3].trim(); // Keep value as string initially
        const description = match[4].trim();
        const entry = { mnemonic, unit, value, description };

        switch (section) {
            case '~V':
                lasData.versionInfo[mnemonic] = entry;
                break;
            case '~W':
                lasData.wellInfo[mnemonic] = entry;
                break;
            case '~C':
                // Check for duplicate mnemonics in Curve Info
                if (!lasData.curveInfo.find(c => c.mnemonic === mnemonic)) {
                     lasData.curveInfo.push(entry);
                } else {
                     lasData.parsingErrors.push(`Duplicate mnemonic '${mnemonic}' found in ~C section.`);
                     console.warn(`LAS Parsing Warning (${lasData.filename}): Duplicate mnemonic '${mnemonic}' found in ~C section.`);
                }
                break;
            case '~P':
                lasData.paramInfo.push(entry);
                break;
        }
    } else {
         lasData.parsingErrors.push(`Could not parse header line in section ${section}: "${line}"`);
         console.warn(`LAS Parsing Warning (${lasData.filename}): Could not parse header line in section ${section}: "${line}"`);
    }
}


// export { fetchLasFile, parseLAS };
// Keep parseLAS function as it was

export { fetchLasFile, parseLAS };