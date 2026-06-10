// static/well_log_viewer/js/plotter.js
// Ensure d3 is imported or available globally
// import * as d3 from "https://cdn.skypack.dev/d3@7";

class Plotter {
    constructor(containerSelector, config = {}) {
        this.containerSelector = containerSelector;
        this.container = d3.select(this.containerSelector);
        if (this.container.empty()) {
            throw new Error(`Plotter Error: Container selector "${containerSelector}" not found.`);
        }

        // Default config
        this.config = {
            margin: { top: 80, right: 20, bottom: 30, left: 50 }, // Increased top margin
            width: 300, // Default/initial width, can be dynamic
            height: 500, // Default/initial height
            depthAxisLabel: config.depthAxisLabel || 'DEPTH',
            gridLines: config.gridLines !== undefined ? config.gridLines : true,
            enableZoom: config.enableZoom !== undefined ? config.enableZoom : true,
            enableCursor: config.enableCursor !== undefined ? config.enableCursor : true,
            zoomHandler: config.zoomHandler || null
        };

        // Adjust dimensions based on container AFTER margins are set
        this._updateDimensions();

        // State for Multiple Curves
        this.curves = new Map(); // Map<curveId, { id, data: [], options: {}, xScale: null, path: null, xAxisG: null }>
        // Add property to store shared range calculated by Viewer
        this.sharedAutoXRange = null; // Will be set by Viewer

        // D3 Elements (initialize all properties)
        this.svg = null;
        this.g = null; // Main group for plot area
        this.yScale = null; // Shared Y (Depth) Scale
        this.yAxis = null;
        this.yAxisG = null; // Group for Y axis
        this.gridYG = null; // Y Grid Group
        this.gridXG = null; // X Grid Group
        this.clipId = `clip-${this.containerSelector.replace(/[^a-zA-Z0-9]/g, '') || Math.random().toString(36).substring(7)}`;
        this.zoom = null;
        this.overlay = null; // For zoom/cursor events
        this.cursorLineY = null; // Not currently used, but keeping for potential future use
        this.cursorLineX = null; // Single horizontal line for depth cursor
        this.cursorTexts = new Map(); // Map<curveId, d3TextSelection>
        this.pathsGroup = null; // Group for paths
        this.xAxesGroup = null; // Group for X axes
        this.cursorTextGroup = null; // Group for cursor text
        this.yAxisLabelElement = null; // Y axis label element

        // Create SVG and initial setup
        this._createSVG();
        if (this.config.enableZoom || this.config.enableCursor) {
            this._setupInteractivity();
        }
    }

    _updateDimensions() {
        const rect = this.container.node().getBoundingClientRect();
        this.config.width = rect.width > 0 ? rect.width : this.config.width;
        this.config.height = rect.height > 0 ? rect.height : this.config.height;

        this.innerWidth = this.config.width - this.config.margin.left - this.config.margin.right;
        this.innerHeight = this.config.height - this.config.margin.top - this.config.margin.bottom;

        if (this.innerWidth <= 0 || this.innerHeight <= 0) {
            console.warn(`Plotter Warning: Calculated inner dimensions are zero or negative for ${this.containerSelector}.`);
            this.innerWidth = Math.max(10, this.innerWidth); // Fallback minimum
            this.innerHeight = Math.max(50, this.innerHeight); // Fallback minimum
        }

        // Update clipping path and overlay if dimensions change
        if (this.svg) {
            this.svg.select(`#${this.clipId} rect`)
                .attr('width', this.innerWidth)
                .attr('height', this.innerHeight);
        }
        if (this.overlay) {
            this.overlay
                .attr('width', this.innerWidth)
                .attr('height', this.innerHeight);
            if (this.zoom) {
                this.zoom.extent([[0, 0], [this.innerWidth, this.innerHeight]]);
            }
        }
        // Update axis label positions on resize
        if(this.yAxisLabelElement) {
            this.yAxisLabelElement
                .attr('x', -(this.config.margin.top + this.innerHeight / 2)); // Re-center vertically
        }
    }

    _createSVG() {
        this.container.selectAll('svg').remove(); // Clear previous

        this.svg = this.container.append('svg')
            .attr('class', 'plot-svg')
            .attr('width', this.config.width)
            .attr('height', this.config.height)
            .attr('viewBox', `0 0 ${this.config.width} ${this.config.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Clipping Path
        this.svg.append('defs').append('clipPath')
            .attr('id', this.clipId)
            .append('rect')
            .attr('width', this.innerWidth)
            .attr('height', this.innerHeight);

        // Main Plot Group
        this.g = this.svg.append('g')
            .attr('transform', `translate(${this.config.margin.left}, ${this.config.margin.top})`);

        // Y Axis Placeholders
        this.yAxisG = this.g.append('g').attr('class', 'y-axis');
        this.yAxisLabelElement = this.svg.append('text')
            .attr('class', 'axis-label y-axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', 15)
            .attr('x', -(this.config.margin.top + this.innerHeight / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text(this.config.depthAxisLabel);

        // Grid Placeholders
        this.gridYG = this.g.append('g').attr('class', 'grid grid-y');
        this.gridXG = this.g.append('g').attr('class', 'grid grid-x');

        // Path Container
        this.pathsGroup = this.g.append('g')
            .attr('class', 'paths-group')
            .attr('clip-path', `url(#${this.clipId})`);

        // X Axes Container
        this.xAxesGroup = this.svg.append('g')
            .attr('class', 'x-axes-group')
            .attr('transform', `translate(${this.config.margin.left}, ${this.config.margin.top - 10})`); // Position near top margin

        // Cursor Text Group
        this.cursorTextGroup = this.g.append('g').attr('class', 'cursor-text-group');
    }

    _setupInteractivity() {
        if (this.overlay) this.overlay.remove();

        this.overlay = this.g.append("rect")
            .attr('class', 'overlay')
            .attr('width', this.innerWidth)
            .attr('height', this.innerHeight)
            .style('fill', 'none')
            .style('pointer-events', 'all');

        // Zoom
        if (this.config.enableZoom && this.config.zoomHandler) {
            this.zoom = d3.zoom()
                .extent([[0, 0], [this.innerWidth, this.innerHeight]])
                .scaleExtent([0.5, 500])
                .on("zoom", (event) => this._zoomed(event));

            this.overlay.call(this.zoom);
            this.overlay.on("dblclick.zoom", null);
        } else if (this.config.enableZoom && !this.config.zoomHandler) {
            console.warn("Plotter: Zoom enabled but no zoomHandler provided.");
        }

        // Cursor
        if (this.config.enableCursor) {
            this.cursorLineX = this.g.append("line")
                .attr("class", "cursor-line cursor-line-x")
                .style("display", "none");

            this.overlay
                .on("mouseenter.cursor", () => this._showCursor())
                .on("mouseleave.cursor", () => this._hideCursor())
                .on("mousemove.cursor", (event) => this._updateCursor(event));
        }
    }

    _zoomed(event) {
        if (this.config.zoomHandler && typeof this.config.zoomHandler.handleZoom === 'function') {
            this.config.zoomHandler.handleZoom(event.transform);
        }
    }

    _showCursor() {
        if (this.curves.size === 0) return;
        if (this.cursorLineX) this.cursorLineX.style("display", null);
        // Ensure cursorTextGroup exists before accessing children
        if(this.cursorTextGroup) {
            this.cursorTextGroup.selectAll(".cursor-text").style("display", null);
        }
        // Alternative: Manage visibility on the group itself
        // if (this.cursorTextGroup) this.cursorTextGroup.style("display", null);
    }

    _hideCursor() {
       if (this.cursorLineX) this.cursorLineX.style("display", "none");
       if(this.cursorTextGroup) {
            this.cursorTextGroup.selectAll(".cursor-text").style("display", "none");
       }
       // Alternative: Manage visibility on the group itself
       // if (this.cursorTextGroup) this.cursorTextGroup.style("display", "none");
    }

    _updateCursor(event) {
        // Check for existence of necessary elements
        if (!this.yScale || !this.g || !this.overlay || !this.cursorTextGroup || this.curves.size === 0) return;

        const [pointerX, pointerY] = d3.pointer(event, this.g.node());

        // Clamp pointer to plot area
        const clampedX = Math.max(0, Math.min(this.innerWidth, pointerX));
        const clampedY = Math.max(0, Math.min(this.innerHeight, pointerY));

        const depthAtCursor = this.yScale.invert(clampedY);

        // Update horizontal cursor line
        if (this.cursorLineX) {
            this.cursorLineX
                .attr("x1", 0)
                .attr("x2", this.innerWidth)
                .attr("y1", clampedY)
                .attr("y2", clampedY);
        }

        // --- Prepare text data for all curves + depth ---
        let depthText = `Depth: ${depthAtCursor.toFixed(2)}`;
        let textYOffset = -5; // Start just above the cursor line
        const textXBasePosition = clampedX; // Base X position for text block
        let depthBBoxHeight = 12; // Estimate initial height for depth text

        // Array to hold data for D3 data join
        const allCursorData = [{ id: 'depth-cursor-text', text: depthText, color: '#333', fontWeight: 'bold', yOffset: textYOffset }];

        // Iterate through curves to get their values and prepare text data
        this.curves.forEach((curve, curveId) => {
            // Ensure curve has a scale and data before trying to get value
            if (!curve.xScale || !curve.data || curve.data.length === 0) return;

            const valueAtCursor = curve.xScale.invert(clampedX); // Use curve-specific scale
            const curveLabel = curve.options.mnemonic || curveId;
            const curveUnit = curve.options.unit ? ` (${curve.options.unit})` : '';
            let valueString = valueAtCursor.toFixed(2); // Default formatting

            // Use exponential format for log scales if value is positive
            if (curve.options.scaleType === 'log' && valueAtCursor > 0) {
                valueString = valueAtCursor.toExponential(2);
            }

            const curveText = `${curveLabel}${curveUnit}: ${valueString}`;

            // Decrement Y offset *before* adding curve text data, using previous element's estimated height
            textYOffset -= depthBBoxHeight + 2; // Add small padding
            depthBBoxHeight = 12; // Reset for next curve estimation (can be refined)

            // Add curve data to the array
            allCursorData.push({
                id: curveId, // Use curveId as the unique ID for data binding
                text: curveText,
                color: curve.options.curveColor || '#000',
                fontWeight: 'normal',
                yOffset: textYOffset // Store calculated offset for positioning
            });
        });

        // --- Use D3 data join to create/update text elements ---
        const textSelection = this.cursorTextGroup.selectAll(".cursor-text")
            .data(allCursorData, d => d.id); // Use ID as the key function

        // Enter new text elements
        const enterSelection = textSelection.enter().append("text")
            .attr("class", d => `cursor-text cursor-text-${d.id}`)
            .style("display", null) // Make sure newly entered elements are visible
            .attr("y", d => clampedY + d.yOffset) // Set initial Y based on calculated offset
            .attr("fill", d => d.color)
            .style("font-size", "9px") // Consistent font size
            .style("font-weight", d => d.fontWeight);

        // Update existing text elements (including position and content)
        const updateSelection = textSelection
            .attr("y", d => clampedY + d.yOffset) // Update Y position
            .attr("fill", d => d.color) // Update color (might change)
            .style("font-weight", d => d.fontWeight) // Update weight
            .text(d => d.text); // Update text content

        // Merge enter and update selections for subsequent operations
        const mergedSelection = enterSelection.merge(updateSelection);

        // Remove old text elements
        textSelection.exit().remove();

        // --- Calculate max width and adjust X position/anchor ---
        let maxTextWidth = 0;
        mergedSelection.each(function() {
            try {
                // Get bounding box *after* text content is set
                const bbox = this.getBBox();
                maxTextWidth = Math.max(maxTextWidth, bbox.width);
            } catch (e) {
                // Ignore potential errors during rendering/transition
                // console.warn("Could not get BBox for cursor text:", e);
            }
        });

        // Determine final X position and anchor based on available space
        const padding = 10;
        let finalXPosition = textXBasePosition + padding; // Default position to the right
        let finalAnchor = "start"; // Default anchor

        // If text overflows to the right, position it to the left
        if (finalXPosition + maxTextWidth > this.innerWidth) {
            finalXPosition = textXBasePosition - padding;
            finalAnchor = "end";
        }

        // Apply final X position and anchor to all text elements
        // Also, check vertical boundary and adjust if text goes above the plot area
        mergedSelection
            .attr("x", finalXPosition)
            .attr("text-anchor", finalAnchor)
            .each(function(d) { // 'd' is the bound data object
                try {
                    const bbox = this.getBBox();
                    const currentY = clampedY + d.yOffset; // Y position relative to plot area <g>
                    // Check if the top of the text (currentY - bbox.height approx.) goes above y=0
                    // Note: BBox y is relative to the text element itself, need height
                    if (currentY - bbox.height < 0) {
                        // Simple fix: push block down below cursor line
                        // Calculate approximate total height of the text block
                        const totalTextHeight = allCursorData.length * (bbox.height + 2); // Use measured height + padding
                        // Adjust Y position based on how much it overlaps
                        const overlap = -(currentY - bbox.height);
                        // Shift down by overlap + padding OR shift entire block below line
                        // Simpler: Shift entire block to start below cursor line
                        // Calculate Y for the *top* element (depth text) to be just below cursor line
                         const depthElementOffsetY = allCursorData.find(item => item.id === 'depth-cursor-text').yOffset;
                         const shiftNeeded = clampedY + padding; // Start depth text below cursor
                         // Find offset relative to depth text yOffset
                         const relativeOffsetY = d.yOffset - depthElementOffsetY;
                         d3.select(this).attr("y", shiftNeeded + relativeOffsetY);

                    }
                } catch(e) { /* ignore errors */ }
            });

        // Update internal map (optional, might not be needed if using join correctly)
        // this.cursorTexts = new Map(mergedSelection.nodes().map(node => [d3.select(node).datum().id, d3.select(node)]));

        this._showCursor(); // Redundant if elements are styled correctly, but safe
    }



    _clearDrawnCurveArtifacts() {
        if (this.pathsGroup) this.pathsGroup.selectAll('*').interrupt().remove();
        if (this.xAxesGroup) this.xAxesGroup.selectAll('*').interrupt().remove();
        if (this.gridXG) this.gridXG.selectAll('*').interrupt().remove();
        if (this.gridYG) this.gridYG.selectAll('*').interrupt().remove();
        if (this.cursorTextGroup) this.cursorTextGroup.selectAll('*').interrupt().remove();
        if (this.cursorLineX) this.cursorLineX.style('display', 'none');
        this.cursorTexts.clear();
    }

    /**
     * Sets or updates the data and options for multiple curves.
     * @param {Array<object>} curvesData - Array of curve objects:
     * { id: string, data: Array<{depth, value}>, options: { scaleType, curveColor, xRange:[min,max], mnemonic, unit, strokeWidth, filename } }
     */
    setCurves(curvesData = []) {
        if (!Array.isArray(curvesData) || curvesData.length === 0) {
            this.curves.forEach(curve => {
                if (curve.path) curve.path.interrupt().remove();
                if (curve.xAxisG) curve.xAxisG.interrupt().remove();
            });
            this.curves.clear();
            this.sharedAutoXRange = null;
            this._clearDrawnCurveArtifacts();
            return;
        }

        const existingIds = new Set(this.curves.keys());
        const newIds = new Set();

        curvesData.forEach(curveInfo => {
            const { id, data, options } = curveInfo;
            if (!id) {
                console.warn("Plotter: Curve data missing ID, skipping.");
                return;
            }
            newIds.add(id);

            // Prepare data, ensuring values are numbers or null
            const cleanData = (data || []).map(d => ({
                depth: d.depth === null || isNaN(d.depth) ? null : +d.depth,
                value: d.value === null || isNaN(d.value) ? null : +d.value // Keep nulls for .defined()
            })).filter(d => d.depth !== null); // Must have depth

            const mergedOptions = { // Defaults
                scaleType: 'linear',
                curveColor: '#000000',
                xRange: null, // [min, max] or null for auto
                mnemonic: '',
                unit: '',
                filename: '', // Added filename default
                strokeWidth: 1.5, // Added strokeWidth default
                ...options // User options override defaults
            };

            if (this.curves.has(id)) {
                // Update existing curve
                const curve = this.curves.get(id);
                curve.data = cleanData;
                curve.options = mergedOptions;
                curve.xScale = null; // Will be recreated in draw
            } else {
                // Add new curve
                this.curves.set(id, {
                    id: id,
                    data: cleanData,
                    options: mergedOptions,
                    xScale: null,
                    path: null,
                    xAxisG: null
                });
            }
        });

        // Remove curves that are no longer present
        existingIds.forEach(id => {
            if (!newIds.has(id)) {
                const curve = this.curves.get(id);
                 if (curve) { // Check if curve exists before removing elements
                    if (curve.path) curve.path.remove();
                    if (curve.xAxisG) curve.xAxisG.remove();
                    if (this.cursorTexts.has(id)) {
                        this.cursorTexts.get(id).remove();
                        this.cursorTexts.delete(id);
                    }
                 }
                this.curves.delete(id);
            }
        });
    }


    /**
     * Draws/Redraws all configured curves using the shared Y domain.
     * @param {Array} sharedYDomain - The shared [yMax, yMin] domain for the depth axis.
     */
    draw(sharedYDomain) {
        // Check if essential elements/data exist
        if (!this.g || !this.pathsGroup || !this.xAxesGroup || !this.yAxisG || !sharedYDomain || sharedYDomain.length !== 2) {
            console.warn(`Plotter ${this.containerSelector}: Skipping draw - missing essential elements or invalid sharedYDomain.`);
            // Consider clearing the plot area if skipping
            // this.pathsGroup?.selectAll('*').remove();
            // this.xAxesGroup?.selectAll('*').remove();
            // this.yAxisG?.selectAll('*').remove();
            return;
        }
        this._updateDimensions(); // Recalculate size just before drawing

        if (this.curves.size === 0) {
            this._clearDrawnCurveArtifacts();
            if (this.yAxisG) this.yAxisG.selectAll('*').interrupt().remove();
            return;
        }

        // --- Shared Y Scale ---
        this.yScale = d3.scaleLinear()
            .domain(sharedYDomain)
            .range([this.innerHeight, 0]); // Map depth domain to pixel range (inverted)

        this.yAxis = d3.axisLeft(this.yScale)
            .ticks(Math.max(3, Math.floor(this.innerHeight / 40))) // Ensure at least 3 ticks
            .tickSizeOuter(0);

        this.yAxisG // Assumed to exist from _createSVG
            .transition().duration(100) // Smooth transition for axis update
            .call(this.yAxis);

        // --- Draw Each Curve ---
        let primaryXScale = null; // To be used for grid lines (e.g., the first curve's scale)
        let xAxisYOffset = 0; // Vertical offset for stacking X axes
        const axisSpacing = 30; // Increased vertical space between X axes/labels

        this.curves.forEach((curve, curveId) => {
            // Filter data again for valid numeric values right before domain/line calculation
            const validData = curve.data.filter(d => d.value !== null && !isNaN(d.value));

            // If no valid points, remove elements and skip
            if (validData.length === 0) {
                if (curve.path) curve.path.remove(); curve.path = null;
                if (curve.xAxisG) curve.xAxisG.remove(); curve.xAxisG = null;
                if (this.cursorTexts.has(curveId)) { this.cursorTexts.get(curveId).remove(); this.cursorTexts.delete(curveId); }
                console.warn(`Plotter ${this.containerSelector}: No valid numeric data points for curve ${curveId} to draw.`);
                return; // Skip this curve
            }

            // 1. Determine X Domain for this curve
            let finalXRange;
            const manualRange = curve.options.xRange;

            // --- MODIFICATION: Use Shared Range Logic ---
            if (manualRange && Array.isArray(manualRange) && manualRange.length === 2 && !isNaN(manualRange[0]) && !isNaN(manualRange[1]) && manualRange[0] < manualRange[1]) {
                finalXRange = manualRange; // Use valid manual range
            } else if (this.sharedAutoXRange) {
                finalXRange = this.sharedAutoXRange; // Use shared auto range if no valid manual one
            } else {
                // Fallback: Calculate from this curve's valid data only
                console.warn(`Plotter: No shared or manual X-Range for ${curve.options.mnemonic}. Falling back to data extent.`);
                finalXRange = d3.extent(validData, d => d.value);
                // Handle case where all valid data points have the same value
                if (finalXRange[0] === finalXRange[1]) {
                     finalXRange[0] = finalXRange[0] - (finalXRange[0] !== 0 ? Math.abs(finalXRange[0] * 0.1) : 1);
                     finalXRange[1] = finalXRange[1] + (finalXRange[1] !== 0 ? Math.abs(finalXRange[1] * 0.1) : 1);
                }
                 // Final fallback if extent calculation fails
                if (finalXRange[0] === undefined || finalXRange[1] === undefined) {
                    finalXRange = [0,1];
                }
            }
            // --- END MODIFICATION ---


            // 2. Create X Scale based on finalXRange and scaleType
            const scaleType = curve.options.scaleType || 'linear';
            let curveXScale;

            if (scaleType === 'log') {
                let logMin = finalXRange[0];
                let logMax = finalXRange[1];
                // Ensure domain is strictly positive for log scale
                if (logMin <= 0) {
                    logMin = d3.min(validData, d => d.value > 0 ? d.value : undefined); // Find min positive value
                }
                // If still invalid (no positive values or max <= min), fallback to linear
                if (logMin === undefined || logMin <= 0 || logMax <= logMin) {
                    console.warn(`Plotter ${this.containerSelector}: Invalid range [${finalXRange.join(', ')}] for log scale on curve ${curveId}. Falling back to linear.`);
                    curveXScale = d3.scaleLinear().domain(finalXRange).range([0, this.innerWidth]).nice();
                } else {
                    curveXScale = d3.scaleLog().domain([logMin, logMax]).range([0, this.innerWidth]).base(10).nice().clamp(true);
                }
            } else { // Linear
                 curveXScale = d3.scaleLinear().domain(finalXRange).range([0, this.innerWidth]).nice();
            }
            curve.xScale = curveXScale; // Store the scale on the curve object for cursor use
            if (!primaryXScale) primaryXScale = curveXScale; // Use first scale for grid


            // 3. Create/Update X Axis and Labels
            const xAxis = d3.axisTop(curveXScale)
                .ticks(Math.max(3, Math.floor(this.innerWidth / 80))) // Dynamic ticks based on width
                .tickSizeOuter(0)
                .tickSize(4); // Smaller inner tick size

            if (scaleType === 'log') {
                // Use specific formatting for log scales if needed
                xAxis.ticks(5, ".1s"); // Fewer ticks, scientific notation
            }

            // Create axis group if it doesn't exist
            if (!curve.xAxisG) {
                curve.xAxisG = this.xAxesGroup.append('g')
                    .attr('class', `x-axis-group x-axis-${curveId}`);
            }

            // Position and style the axis group
            curve.xAxisG
                .attr('transform', `translate(0, ${xAxisYOffset})`) // Position vertically
                .attr('color', curve.options.curveColor || '#000') // Use curve color for axis line/ticks
                .transition().duration(100)
                .call(xAxis)
                .selectAll(".tick text") // Style tick labels
                .style("text-anchor", "middle")
                .attr('fill', curve.options.curveColor || '#000'); // Use curve color for labels too

            // --- Labels ---
            const curveLabel = `${curve.options.mnemonic || ''}${curve.options.unit ? ` (${curve.options.unit})` : ''}`;
            const filenameLabel = curve.options.filename ? curve.options.filename.substring(curve.options.filename.lastIndexOf('/') + 1) : '';

            // Filename Label (Above Axis Line)
             curve.xAxisG.selectAll('.axis-label-filename').data([filenameLabel])
                .join('text')
                .attr('class', 'axis-label-filename')
                .attr('x', this.innerWidth / 2)
                .attr('y', -15) // Position above axis line
                .attr('dy', '-0.1em') // Fine-tune vertical position
                .attr('text-anchor', 'middle')
                .attr('fill', curve.options.curveColor || '#000')
                .style('font-size', '8px')
                .style('font-weight', 'normal')
                .text(d => d);

            // Mnemonic/Unit Label (Below Axis Line)
            curve.xAxisG.selectAll('.axis-label-curve').data([curveLabel])
               .join('text')
               .attr('class', 'axis-label-curve')
               .attr('x', this.innerWidth / 2)
               .attr('y', 12) // Position below axis line
               .attr('dy', '0em') // Adjust baseline alignment
               .attr('text-anchor', 'middle')
               .attr('fill', curve.options.curveColor || '#000')
               .style('font-size', '9px')
               .style('font-weight', 'bold')
               .text(d => d);

            // Increment offset for the next axis
            xAxisYOffset -= axisSpacing;


            // 4. Create/Update Path
            // --- MODIFICATION: Use .defined() ---
            const lineGenerator = d3.line()
                .x(d => curve.xScale(d.value)) // Use the scale specific to this curve
                .y(d => this.yScale(d.depth)) // Use the shared Y scale
                .defined(d => d.value !== null && !isNaN(d.value) && d.depth !== null && !isNaN(d.depth)); // Skip points with invalid value OR depth
            // --- END MODIFICATION ---

            // Create path element if it doesn't exist
            if (!curve.path) {
                curve.path = this.pathsGroup.append('path')
                    .attr('class', `log-line log-line-${curveId}`)
                    .attr('fill', 'none');
            }
            

            // --- MODIFICATION: Apply variable stroke-width ---
            const strokeWidth = curve.options.strokeWidth || 1.5; // Get from options or default
            const strokeStyle =curve.options.strokeStyle || "solid";
            // --- END MODIFICATION ---

            // Update path data, attributes, and style
            
            curve.path
                .datum(curve.data) // Bind the full data (with nulls); .defined() handles breaks
                .transition().duration(100) // Smooth transition for path update
                .attr('d', lineGenerator) // Generate path string
                .attr('stroke', curve.options.curveColor || '#000000') // Apply color
                
                .attr('stroke-width', strokeWidth); // Apply thickness
            if (strokeStyle === 'dashed') {
                curve.path.attr('stroke-dasharray', '4,4');
            } else {
                curve.path.attr('stroke-dasharray', null);
            } // '4,4' is a common dash pattern, null removes the attribute

                // console.log("*******************************************")
                // console.log(curve.options.strokeWidth,curve.options.strokeStyle)
                // console.log("*******************************************")

        }); // End forEach curve


        // --- Draw Grid Lines (using the primary scale) ---
        if (this.config.gridLines) {
            this._drawGridLines(primaryXScale, this.yScale);
        } else {
             if (this.gridXG) this.gridXG.selectAll('*').remove();
             if (this.gridYG) this.gridYG.selectAll('*').remove();
        }
    }


    /** Helper function to draw grid lines */
    _drawGridLines(xScale, yScale) {
        if (!xScale || !yScale || !this.gridXG || !this.gridYG) return;

        this.gridXG.selectAll('*').remove();
        this.gridYG.selectAll('*').remove();
        try {
            // X grid lines (vertical)
            const xGridAxis = d3.axisBottom(xScale)
                .tickSize(-this.innerHeight)
                .tickFormat('');

            // Adjust ticks for log scale grid if needed
            if (xScale.ticks && typeof xScale.ticks === 'function' && xScale.base) {
                 const maxTicks = Math.max(2, Math.min(5, Math.floor(this.innerWidth / 80)));
                 xGridAxis.ticks(maxTicks, ".1s");
            } else {
                 xGridAxis.ticks(Math.max(3, Math.floor(this.innerWidth / 80)));
            }

            this.gridXG
                .attr('transform', `translate(0,${this.innerHeight})`)
                .transition().duration(100)
                .call(xGridAxis)
                .selectAll(".tick line")
                .attr("stroke", "#e0e0e0")
                .attr("stroke-opacity", 0.7);
            this.gridXG.select('.domain').remove(); // Hide the grid axis domain line


            // Y grid lines (horizontal)
            const yGridAxis = d3.axisLeft(yScale)
                 .ticks(Math.max(3, Math.floor(this.innerHeight / 40)))
                 .tickSize(-this.innerWidth)
                 .tickFormat('');

            this.gridYG
                .transition().duration(100)
                .call(yGridAxis)
                .selectAll(".tick line")
                .attr("stroke", "#e0e0e0")
                .attr("stroke-opacity", 0.7);
            this.gridYG.select('.domain').remove(); // Hide the grid axis domain line
        } catch (error) {
             console.error(`Error drawing grid lines for ${this.containerSelector}:`, error);
        }
    }


    /** Cleans up the plotter */
    destroy() {
        console.log(`Destroying plotter ${this.containerSelector}`);
        // Remove listeners
        if (this.overlay) {
            if (this.zoom) this.overlay.on('.zoom', null);
            this.overlay.on('.cursor', null);
        }
        // Remove SVG element
        if (this.svg) {
            this.svg.remove();
        }
        // Clear references
        this.container = null;
        this.svg = null;
        this.g = null;
        this.curves.clear();
        this.cursorTexts.clear();
        this.config.zoomHandler = null; // Break potential circular reference
    }
}

export { Plotter };