
// static/well_log_viewer/js/viewer.js
import { fetchLasFile, parseLAS } from './las_utils.js';
import { Plotter } from './plotter.js'; // Assuming plotter.js exports Plotter

class Viewer {
        constructor() {
        // --- DOM Element References (Keep existing) ---
        this.sidebar = document.getElementById('sidebar');
        this.loadFileBtn = document.getElementById('load-file-btn');
        this.loadedFilesList = document.getElementById('loaded-files-list');
        // Summary Elements
        this.summaryTabsContainer = document.getElementById('summary-tabs');
        this.summaryContentContainer = document.getElementById('summary-content');
        this.summaryDetails = document.getElementById('summary-details');
        // Track Control Elements
        this.addTrackBtn = document.getElementById('add-track-btn');
        this.clearCurvesBtn = document.getElementById('clear-curves-btn');
        this.trackControlsContainer = document.getElementById('track-controls-container'); // New container for controls
        // Plot Elements
        // this.mainContent = document.getElementById('main-content'); // Maybe not needed directly often
        this.tracksPlotContainer = document.getElementById('tracks-plot-container'); // New container for plots
        // Modal Elements
        this.modal = document.getElementById('file-select-modal');
        this.modalFileList = document.getElementById('las-file-list');
        this.closeModalBtn = this.modal ? this.modal.querySelector('.close-button') : null;
        this.cancelLoadBtn = document.getElementById('cancel-load-btn');
        // Templates
        this.trackControlTemplate = document.getElementById('track-control-template');
        this.curveControlTemplate = document.getElementById('curve-control-template');
        this.trackPlotTemplate = document.getElementById('track-plot-template');


        // --- State (Keep existing) ---
        this.loadedFiles = {}; // Stores parsed LAS data { filename: parsedData }
        this.tracks = {};
        this.trackCounter = 0;
        this.curveCounter = 0; // Global counter for unique curve IDs across all tracks
        this.selectedSummaryFile = null;
        this.sharedYDomain = null; // [yMax, yMin] (inverted for depth)
        this.initialYDomain = null; // Store the very first calculated domain
        // Zoom/Pan State (Keep existing)
        this.isZooming = false;
        this.zoomEventScheduled = false;
        this.lastZoomTransform = null;
        this.throttleDelay = 50;
     }

    // --- Modified File Selection Handling ---
    async _handleModalFileSelect(filename) {
        console.log(`File selected: ${filename}`);
        this.hideFileModal();
        this._setLoadingState(filename, true); // Show loading indicator

        try {
            // Find the file info (including project and well) from the global data
              const fileInfo = window.APP_DATA?.allAvailableFiles?.find(f => f.filename === filename);
              if (!fileInfo || !fileInfo.project) {
                    throw new Error(`Could not find metadata or project context for file "${filename}".`);
              }

              // Call fetchAndParseLas (which uses fetchLasFile internally now)
              const parsedData = await this.fetchAndParseLas(fileInfo.project, fileInfo.well, fileInfo.filename);

              // Add file to sidebar list *after* successful load/parse
              this._addFileToList(filename);

              // Enable Add Track button if it wasn't already
              this.addTrackBtn.disabled = false;

              this._updateAllCurveFileSelectors(); // Update dropdowns in existing curves
              this.displayFileSummary(filename); // Show summary automatically

               // Update Y domain if necessary
               const depthKey = this.findDepthKeyInLas(parsedData);
               if (depthKey && parsedData.data?.[depthKey]) {
                   const newDepths = parsedData.data[depthKey].filter(d => d !== null && !isNaN(d));
                   if (newDepths.length > 0) {
                         // Get ALL depths from currently loaded files
                         let allCurrentDepths = [];
                         Object.values(this.loadedFiles).forEach(lasData => {
                               const dKey = this.findDepthKeyInLas(lasData);
                               if (dKey && lasData.data?.[dKey]) {
                                    allCurrentDepths.push(...lasData.data[dKey].filter(d => d !== null && !isNaN(d)));
                               }
                         });
                         // Recalculate and potentially update shared domain
                         const newDomain = this._calculateFullYDomain(allCurrentDepths);
                         if (newDomain && (!this.sharedYDomain || newDomain[0] !== this.sharedYDomain[0] || newDomain[1] !== this.sharedYDomain[1])) {
                               console.log("Recalculating and updating shared Y domain after manual load.");
                               this.sharedYDomain = [...newDomain];
                               if (!this.initialYDomain) { this.initialYDomain = [...newDomain]; } // Set initial if not set
                              this.triggerRedrawAllTracks(); // Redraw needed due to domain change
                         }
                   }
               }

        } catch (error) {
            console.error(`Error loading or parsing ${filename}:`, error);
            alert(`Failed to load or parse file "${filename}":\n${error.message}`);
              const listItem = this.loadedFilesList.querySelector(`li[data-filename="${filename}"]`);
              if (listItem) {
                   listItem.innerHTML += ` <span class="load-error"> (Load Failed)</span>`;
                   listItem.title = error.message;
                   // Keep the item but maybe disable clicking or show remove btn
                   const removeBtn = listItem.querySelector('.remove-file-btn');
                   if (removeBtn) removeBtn.style.display = ''; // Ensure remove is visible
              }
            // Don't add to loadedFiles state if failed
            delete this.loadedFiles[filename];
        } finally {
            // Ensure loading state is removed even on error
            this._setLoadingState(filename, false);
            this._updateTracksContainerMessages();
        }
    }

    /** Helper to fetch and parse LAS file, adds it to loadedFiles */
    async fetchAndParseLas(projectName, wellName, filename) {
        console.log(`Viewer: Fetching and parsing ${filename} for Project: ${projectName}, Well: ${wellName || 'N/A'}`);
        if (this.loadedFiles[filename]) {
            console.log(`File ${filename} already loaded.`);
            return this.loadedFiles[filename]; // Return cached data
        }
        // Use the utility function (make sure it's imported/available)
        const lasContent = await fetchLasFile(projectName, wellName, filename);
        const parsedData = parseLAS(lasContent, filename); // Assuming parseLAS is imported/available

        // Basic validation
        if (!parsedData || typeof parsedData !== 'object') throw new Error(`Parsing failed for "${filename}".`);
        if (!parsedData.curveInfo || parsedData.curveInfo.length === 0) {
              let errorMsg = `File "${filename}" has no curve data defined (~Curve section).`;
              if(parsedData.parsingErrors?.length) errorMsg += `\nParsing Warnings:\n - ${parsedData.parsingErrors.join('\n - ')}`;
              throw new Error(errorMsg);
        }
        if (!parsedData.data || Object.keys(parsedData.data).length === 0) {
              let errorMsg = `File "${filename}" has no data in ~A section.`;
               if(parsedData.parsingErrors?.length) errorMsg += `\nParsing Warnings:\n - ${parsedData.parsingErrors.join('\n - ')}`;
              throw new Error(errorMsg);
        }
        // Check if *any* curve array actually has numbers
        const hasNumericData = parsedData.curveInfo.some(c =>
              parsedData.data[c.mnemonic]?.some(v => v !== null && !isNaN(v))
        );
        if (!hasNumericData) {
            let errorMsg = `File "${filename}" ~A section found, but contains no valid numeric data points.`;
            if(parsedData.parsingErrors?.length) errorMsg += `\nParsing Warnings:\n - ${parsedData.parsingErrors.join('\n - ')}`;
            throw new Error(errorMsg);
        }

        this.loadedFiles[filename] = parsedData; // Store parsed data
        return parsedData; // Return data for potential immediate use
    }

    /**
     * Calculates a 'nice' Y domain [max, min] based on provided depth values.
     * Does NOT update the viewer's state directly.
     * @param {Array<number>} allDepthValues - An array of all valid depth numbers across relevant curves.
     * @returns {Array<number>|null} The calculated [yMax, yMin] domain or null if no valid data.
     */
    _calculateFullYDomain(allDepthValues) {
        if (!allDepthValues || allDepthValues.length === 0) {
            console.warn("Cannot calculate Y domain: No valid depth values provided.");
            return null;
        }

        const [dataMinDepth, dataMaxDepth] = d3.extent(allDepthValues);

        if (dataMinDepth === undefined || dataMaxDepth === undefined || dataMinDepth === dataMaxDepth) {
              // Handle cases with no data or a single point
              const singlePoint = dataMinDepth !== undefined ? dataMinDepth : 0;
              // Create a small default range around the single point or 0
              return [singlePoint + 50, singlePoint - 50];
        }

        // Apply nice() to get rounded domain bounds
        // Ensure the domain is calculated correctly: [max, min] for depth
        const scale = d3.scaleLinear().domain([dataMaxDepth, dataMinDepth]).nice();
        const newDomain = scale.domain();
        console.log(`Calculated Full Y Domain: [${newDomain[0]}, ${newDomain[1]}]`);
        return newDomain; // Return [yMax, yMin]
    }

    /** Initialize the viewer, setup event listeners */
    init() {
        console.log("Viewer Initializing...");
        this.addTrackBtn.disabled = true; // Disable until a file is loaded
        this._bindEvents();
        this._updateTracksContainerMessages(); // Show initial messages
        this.clearFileSummary();
        console.log("Viewer Initialized.");
    }

    /** Bind all necessary event listeners */
    _bindEvents() {
        if (this.loadFileBtn) this.loadFileBtn.addEventListener('click', () => this.showFileModal());
        if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.hideFileModal());
        if (this.cancelLoadBtn) this.cancelLoadBtn.addEventListener('click', () => this.hideFileModal());
        if (this.addTrackBtn) this.addTrackBtn.addEventListener('click', () => this.addTrack());
        if (this.clearCurvesBtn) this.clearCurvesBtn.addEventListener('click', () => this.clearAllCurves());

        // Modal close on outside click
        window.addEventListener('click', (event) => {
             if (event.target === this.modal) this.hideFileModal();
        });

        // --- Sidebar Listeners ---
        // Loaded file list interaction (remove or show summary)
        this.loadedFilesList.addEventListener('click', (event) => {
             const listItem = event.target.closest('li[data-filename]');
             if (!listItem) return;
             const filename = listItem.dataset.filename;
             if (event.target.classList.contains('remove-file-btn')) {
                   this.removeLoadedFile(filename);
             } else {
                   this.displayFileSummary(filename);
             }
        });

        // Summary tabs interaction (select or close)
        this.summaryTabsContainer.addEventListener('click', (event) => {
             const tabButton = event.target.closest('.summary-tab');
             if (!tabButton) return;
             const filename = tabButton.dataset.filename;
             // Currently no action on tab click itself, summary display handles selection
        });


        // --- Track Controls Container Listeners (Event Delegation) ---
        this.trackControlsContainer.addEventListener('click', (event) => {
             // Remove Track Button
             if (event.target.closest('.remove-track-btn')) {
                   const trackControlPanel = event.target.closest('.track-control-panel');
                   if (trackControlPanel) {
                         this.removeTrack(trackControlPanel.dataset.trackId);
                   }
             }
             // Add Curve Button
             else if (event.target.closest('.add-curve-btn')) {
                   const trackControlPanel = event.target.closest('.track-control-panel');
                   if (trackControlPanel) {
                         this.addCurveToTrack(trackControlPanel.dataset.trackId);
                   }
             }

             // Remove Curve Button
             else if (event.target.closest('.remove-curve-btn')) {
                const curveControlItem = event.target.closest('.curve-control-item');
                const trackControlPanel = event.target.closest('.track-control-panel');
                if (curveControlItem && trackControlPanel) {
                    this.removeCurveFromTrack(trackControlPanel.dataset.trackId, curveControlItem.dataset.curveId);
                }
            }

             // Curve Settings Toggle Button
             else if (event.target.closest('.curve-settings-toggle')) {
                   const curveControlItem = event.target.closest('.curve-control-item');
                   if (curveControlItem) {
                         const settingsPanel = curveControlItem.querySelector('.curve-settings-panel');
                         if (settingsPanel) {
                               settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'flex' : 'none';
                               event.target.closest('.curve-settings-toggle').classList.toggle('active');
                         }
                   }
             }
        });

        // --- Track Controls Input Changes (Event Delegation) ---
        this.trackControlsContainer.addEventListener('change', (event) => {
             const curveControlItem = event.target.closest('.curve-control-item');
             const trackControlPanel = event.target.closest('.track-control-panel');
             if (!curveControlItem || !trackControlPanel) return;

             const trackId = trackControlPanel.dataset.trackId;
             const curveId = curveControlItem.dataset.curveId;
             const target = event.target;

             if (target.classList.contains('curve-file-select')) {
                   this._handleCurveFileChange(trackId, curveId, target.value);
             } else if (target.classList.contains('curve-depth-select')) {
                   this._handleCurveDepthChange(trackId, curveId, target.value);
             } else if (target.classList.contains('curve-prop-select')) {
                   this._handleCurvePropChange(trackId, curveId, target.value);
             } else if (target.classList.contains('curve-scale-select')) {
                   this._handleCurveSettingsChange(trackId, curveId, { scaleType: target.value });
             } else if (target.classList.contains('curve-color-picker')) {
                    this._handleCurveSettingsChange(trackId, curveId, { color: target.value });
             } else if (target.classList.contains('x-range-input')) {
                   // Handle range change on blur/enter (implicitly via 'change' event)
                   const xMinInput = curveControlItem.querySelector('.x-range-input.x-min');
                   const xMaxInput = curveControlItem.querySelector('.x-range-input.x-max');
                   const xMin = parseFloat(xMinInput.value);
                   const xMax = parseFloat(xMaxInput.value);
                   // Only apply if both are valid numbers and min < max
                   const newRange = (!isNaN(xMin) && !isNaN(xMax) && xMin < xMax) ? [xMin, xMax] : null;
                   this._handleCurveSettingsChange(trackId, curveId, { xRange: newRange }, true); // `true` indicates potential range change
             }
        });
    }

    // --- File Loading and Management ---

    async showFileModal() {
        // (Same as original, ensures modal displays available files not yet loaded)
          this.modalFileList.innerHTML = '<li><div class="spinner"></div> Loading available files...</li>';
          this.modal.style.display = 'block';
          try {
                // Use the global variable directly if available
                const files = window.APP_DATA?.allAvailableFiles || [];
                // const response = await fetch('/list_files'); // Fallback if needed
                // if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                // const files = await response.json();
                // if (files.error) throw new Error(files.error);

                this.modalFileList.innerHTML = ''; // Clear loading/previous
                let filesAvailableToList = 0;
                if (files.length > 0) {
                      files.forEach(fileInfo => { // Assuming files is array of {filename, project, well}
                          const filename = fileInfo.filename;
                          if (!this.loadedFiles[filename]) { // Only list files not already loaded
                                const li = document.createElement('li');
                                li.textContent = filename;
                                li.dataset.filename = filename;
                                li.addEventListener('click', () => this._handleModalFileSelect(filename));
                                this.modalFileList.appendChild(li);
                                filesAvailableToList++;
                          }
                      });
                }

                if (filesAvailableToList === 0) {
                     if(Object.keys(this.loadedFiles).length > 0) {
                          this.modalFileList.innerHTML = '<li>All available files are already loaded.</li>';
                     } else {
                          this.modalFileList.innerHTML = '<li>No .las files found for this project/well.</li>';
                     }
                }
          } catch (error) {
                console.error('Error fetching/listing file list:', error);
                this.modalFileList.innerHTML = `<li>Error loading files: ${error.message}</li>`;
          }
    }

    hideFileModal() {
        this.modal.style.display = 'none';
    }

    _setLoadingState(filename, isLoading) {
        // (Same as original - shows/hides spinner in loaded file list)
          let listItem = this.loadedFilesList.querySelector(`li[data-filename="${filename}"]`);
          if (isLoading) {
                if (!listItem) { this._addFileToList(filename); listItem = this.loadedFilesList.querySelector(`li[data-filename="${filename}"]`); }
                if (listItem && !listItem.querySelector('.spinner')) {
                      const spinner = document.createElement('div'); spinner.className = 'spinner';
                      const removeBtn = listItem.querySelector('.remove-file-btn');
                      if(removeBtn) removeBtn.style.display = 'none';
                      listItem.insertBefore(spinner, removeBtn || null); // Insert before remove btn or at end
                }
          } else {
                if (listItem) {
                      const spinner = listItem.querySelector('.spinner'); if (spinner) spinner.remove();
                      const removeBtn = listItem.querySelector('.remove-file-btn'); if (removeBtn) removeBtn.style.display = '';
                }
          }
    }

    _addFileToList(filename) {
        // (Same as original - adds file to sidebar list)
          if (this.loadedFilesList.querySelector(`li[data-filename="${filename}"]`)) return;
          const li = document.createElement('li'); li.dataset.filename = filename;
          const nameSpan = document.createElement('span'); nameSpan.textContent = filename; li.appendChild(nameSpan);
          const removeBtn = document.createElement('button'); removeBtn.innerHTML = '&times;'; removeBtn.className = 'remove-file-btn'; removeBtn.title = `Remove ${filename}`; li.appendChild(removeBtn);
          this.loadedFilesList.appendChild(li);
    }

      removeLoadedFile(filename) {
          console.log(`Removing file: ${filename}`);
          const listItem = this.loadedFilesList.querySelector(`li[data-filename="${filename}"]`);
          if (listItem) listItem.remove();

         // If the removed file was the one showing summary, clear it
         if (this.selectedSummaryFile === filename) {
            this.clearFileSummary();
         }
         // Remove from state
         delete this.loadedFiles[filename];


          // Update tracks: remove curves using this file, update selectors
          Object.values(this.tracks).forEach(track => {
                const curvesToRemove = [];
                track.curves.forEach((curve, curveId) => {
                      if (curve.filename === filename) {
                            curvesToRemove.push(curveId);
                      }
                });
                curvesToRemove.forEach(curveId => this.removeCurveFromTrack(track.id, curveId, false)); // false = don't redraw yet
                // Update remaining curve file selectors
                track.curves.forEach(curve => this._updateCurveFileSelector(curve.elementControls, curve.filename));
          });

          // Recalculate Y domain based on remaining files
          let allRemainingDepths = [];
          Object.values(this.loadedFiles).forEach(lasData => {
              const dKey = this.findDepthKeyInLas(lasData);
              if (dKey && lasData.data?.[dKey]) {
                  allRemainingDepths.push(...lasData.data[dKey].filter(d => d !== null && !isNaN(d)));
              }
          });
          const newDomain = this._calculateFullYDomain(allRemainingDepths);
          if(newDomain) {
              this.sharedYDomain = [...newDomain];
              this.initialYDomain = [...newDomain]; // Reset initial domain too
          } else {
              this.sharedYDomain = null; // Clear domain if no files left
              this.initialYDomain = null;
          }


          this.triggerRedrawAllTracks(); // Redraw after potential removals and domain recalc

          // Update UI state
          if (Object.keys(this.loadedFiles).length === 0) {
                this.addTrackBtn.disabled = true;
                this.clearFileSummary();
          } else {
               // Try to show summary of another file if none is active
               if(!this.selectedSummaryFile) {
                   const firstRemainingFile = Object.keys(this.loadedFiles)[0];
                   if(firstRemainingFile) {
                         this.displayFileSummary(firstRemainingFile);
                   } else {
                         this.clearFileSummary();
                   }
               }
          }
          this._updateTracksContainerMessages();
          this._updateAllCurveFileSelectors(); // Refresh all selectors
      }


       displayFileSummary(filename) {
         if (!filename || !this.loadedFiles[filename] || !this.summaryTabsContainer || !this.summaryContentContainer) {
             if (!filename && this.summaryTabsContainer && this.summaryTabsContainer.children.length === 0) {
                 this.clearFileSummary(); // Clear if no filename and no tabs left
             }
             return;
         }
         this.selectedSummaryFile = filename;
         const data = this.loadedFiles[filename];
         // Update Tab Appearance (assuming tabs exist - might need creation logic if dynamic)
         // For simplicity, assume tabs are static or managed elsewhere
         // this.summaryTabsContainer.querySelectorAll('.summary-tab').forEach(tab => {
         //     tab.classList.toggle('active', tab.dataset.filename === filename);
         // });

         // Update Content Area Title (optional)
         const summaryTitle = document.getElementById('summary-title'); // Assume an element for title
         if(summaryTitle) summaryTitle.textContent = `Summary: ${filename}`;

         // Update Content Details
         let summary = ""; // Start fresh
         summary += "--- Version Info ---\n"; summary += data.versionInfo ? this._formatSection(data.versionInfo) : "Not Found\n";
         summary += "\n--- Well Info ---\n"; summary += data.wellInfo ? this._formatSection(data.wellInfo) : "Not Found\n";
         summary += `\n--- Curves (${data.curveInfo?.length || 0}) ---\n`; summary += data.curveInfo?.length ? this._formatCurveSection(data.curveInfo) : "None Found\n";
         summary += `\n--- Parameters (${data.paramInfo?.length || 0}) ---\n`; summary += data.paramInfo?.length ? this._formatSection(data.paramInfo) : "None Found\n";
         if (data.parsingErrors && data.parsingErrors.length > 0) {
             summary += "\n--- Parsing Warnings ---\n"; data.parsingErrors.forEach(err => summary += `- ${err}\n`);
         }
         this.summaryDetails.textContent = summary;
         const pMessage = this.summaryContentContainer.querySelector('p.summary-message'); if(pMessage) pMessage.style.display = 'none'; // Hide placeholder
       }
       _formatSection(sectionData) {
         let text = '';
         const formatItem = (item, key = null) => {
             const mnemonic = (item.mnemonic || key || '').padEnd(6); const unit = item.unit ? `.${item.unit}` : '';
             const value = (item.value || '').padEnd(12); const desc = item.description || '';
             return `${mnemonic}${unit} ${value} : ${desc}\n`; };
         if (Array.isArray(sectionData)) { sectionData.forEach(item => { text += formatItem(item); });
         } else { for (const key in sectionData) { const item = sectionData[key]; text += formatItem(item, key); } }
         return text || "No details found.\n";
       }
       _formatCurveSection(curveInfo) {
         let text = '';
         curveInfo.forEach(curve => { const mnemonic = (curve.mnemonic || '').padEnd(6); const unit = curve.unit ? `.${curve.unit}` : '';
             const desc = curve.description || ''; text += `${mnemonic}${unit} : ${desc}\n`; });
         return text || "No curves defined.\n";
       }
       clearFileSummary() {
         this.summaryDetails.textContent = '';
         const summaryTitle = document.getElementById('summary-title');
         if(summaryTitle) summaryTitle.textContent = `Summary`; // Reset title

         if (this.summaryContentContainer) { const p = this.summaryContentContainer.querySelector('p.summary-message'); if (p) p.style.display = 'block'; } // Show placeholder
         this.selectedSummaryFile = null;
         // if (this.summaryTabsContainer) { this.summaryTabsContainer.querySelectorAll('.summary-tab').forEach(tab => tab.classList.remove('active')); }
       }


    // --- Track and Curve Management ---

    /** Adds a new track UI (controls + plot area) and initializes state */
    addTrack() {
        this.trackCounter++;
        const trackId = `track-${this.trackCounter}`;
        console.log(`Adding Track: ${trackId}`);

        // 1. Create Track Controls Panel
        const controlNode = this.trackControlTemplate.content.cloneNode(true);
        const trackControlPanel = controlNode.querySelector('.track-control-panel');
        trackControlPanel.dataset.trackId = trackId;
        trackControlPanel.id = `${trackId}-controls`;
        trackControlPanel.querySelector('.track-title').textContent = `Track ${this.trackCounter}`;
        this.trackControlsContainer.appendChild(trackControlPanel);

        // 2. Create Track Plot Area
        const plotNode = this.trackPlotTemplate.content.cloneNode(true);
        const trackPlotArea = plotNode.querySelector('.track-plot-area');
        trackPlotArea.dataset.trackId = trackId;
        trackPlotArea.id = `${trackId}-plot`;
        this.tracksPlotContainer.appendChild(trackPlotArea);

        // 3. Create Plotter Instance
        let plotterInstance = null;
        try {
             plotterInstance = new Plotter(`#${trackPlotArea.id}`, { zoomHandler: this });
             // console.log(`Plotter created for ${trackId}`);
        } catch(error) {
             console.error(`Error creating Plotter for track ${trackId}:`, error);
             trackPlotArea.innerHTML = `<p class="plot-error">Plot failed: ${error.message}</p>`;
             trackControlPanel.remove(); // Clean up controls if plot fails
             return null; // Indicate failure to add track
        }

        // 4. Store Track State
        this.tracks[trackId] = {
             id: trackId,
             elementControls: trackControlPanel,
             elementPlot: trackPlotArea,
             plotter: plotterInstance,
             curves: new Map() // curveId -> curveConfig
        };

        // 5. Add an initial (empty) curve configuration UI
        // This returns the new curve's ID which might be useful
        const firstCurveId = this.addCurveToTrack(trackId);

        // 6. Update UI Messages
        this._updateTracksContainerMessages();
        // Trigger an initial draw of the empty track (with title if available)
        this._redrawTrack(trackId);

        return trackId; // Return the ID of the newly created track
    }


    /** Clears every configured curve from every track while keeping loaded LAS files available. */
    clearAllCurves() {
          console.log('Clearing all configured curves from viewer.');
          Object.values(this.tracks).forEach(track => {
                if (!track) return;
                track.curves.forEach(curve => {
                    if (curve.elementControls) curve.elementControls.remove();
                });
                track.curves.clear();
                if (track.plotter) {
                    track.plotter.setCurves([]);
                    track.plotter.draw(this.sharedYDomain || this.initialYDomain || [1, 0]);
                }
          });
          this.triggerRedrawAllTracks();
          this._updateTracksContainerMessages();
    }

    removeTrack(trackId) {
          const track = this.tracks[trackId];
          if (track) {
                console.log(`Removing Track: ${trackId}`);
                // Destroy plotter
                if (track.plotter && typeof track.plotter.destroy === 'function') {
                      track.plotter.destroy();
                }
                // Remove elements
                if (track.elementControls) track.elementControls.remove();
                if (track.elementPlot) track.elementPlot.remove();

                // Remove from state
                delete this.tracks[trackId];

                this._updateTracksContainerMessages();
                // Optional: Recalculate shared Y domain if needed (handled in removeLoadedFile for now)
                // this._updateSharedYDomain();
                // this.triggerRedrawAllTracks(); // No need to redraw other tracks
          }
      }

    /** Adds curve controls to a track and initializes state for the curve */
    addCurveToTrack(trackId) {
        const track = this.tracks[trackId];
        if (!track) return null; // Return null if track doesn't exist

        this.curveCounter++;
        const curveId = `curve-${trackId}-${this.curveCounter}`; // Use trackId for better uniqueness
        // console.log(`Adding Curve ${curveId} to Track ${trackId}`);

        // 1. Create Curve Controls Element
        const curveNode = this.curveControlTemplate.content.cloneNode(true);
        const curveControlItem = curveNode.querySelector('.curve-control-item');
        curveControlItem.dataset.curveId = curveId;
        curveControlItem.id = `${curveId}-controls`;

        // Add remove button event listener *here* since it's part of the template clone
        const removeBtn = curveControlItem.querySelector('.remove-curve-btn');
        if (removeBtn) {
             removeBtn.addEventListener('click', () => this.removeCurveFromTrack(trackId, curveId));
        }


        // 2. Populate File Selector initially (might be empty if no files loaded yet)
        this._updateCurveFileSelector(curveControlItem);

        // 3. Append to Track Controls
        const curvesList = track.elementControls.querySelector('.track-curves-list');
        curvesList.appendChild(curveControlItem);

        // 4. Add to Track State
        const newCurveConfig = {
             id: curveId,
             filename: null,
             depthMnemonic: null,
             curveMnemonic: null,
             scaleType: 'linear', // Default
             color: this._getRandomColor(), // Default
             strokeWidth: 1.5, // <<< Default strokeWidth
             xRange: null, // Default (auto)
             elementControls: curveControlItem // Reference to the DOM element
        };
        track.curves.set(curveId, newCurveConfig);

        // Set initial color in the picker
        curveControlItem.querySelector('.curve-color-picker').value = newCurveConfig.color;
        // Hide settings panel initially
        const settingsPanel = curveControlItem.querySelector('.curve-settings-panel');
        if(settingsPanel) settingsPanel.style.display = 'none';

        this._updateTracksContainerMessages();

        return curveId; // Return the new curve's ID
    }

      removeCurveFromTrack(trackId, curveId, triggerRedraw = true) {
          const track = this.tracks[trackId];
          if (track && track.curves.has(curveId)) {
                console.log(`Removing Curve ${curveId} from Track ${trackId}`);
                const curve = track.curves.get(curveId);

                // Remove controls element
                if (curve.elementControls) curve.elementControls.remove();

                // Remove from state
                track.curves.delete(curveId);

                this._updateTracksContainerMessages();

                // Trigger redraw if needed
                if (triggerRedraw) {
                     // Re-prepare the track data after removal
                     this._prepareAndSetTrackData(trackId);
                     // Redraw this specific track
                     this._redrawTrack(trackId);
                     // Might need to redraw all if domain changes, but handle that separately
                }
          }
      }


    _handleCurveFileChange(trackId, curveId, selectedFilename) {
        const track = this.tracks[trackId];
        const curve = track?.curves.get(curveId);
        if (!curve) return;

        console.log(`Track ${trackId}, Curve ${curveId}: File changed to ${selectedFilename}`);
        curve.filename = selectedFilename || null;
        curve.depthMnemonic = null; // Reset dependent selections
        curve.curveMnemonic = null;
        curve.data = null; // Clear potentially cached data

        const depthSelect = curve.elementControls.querySelector('.curve-depth-select');
        const propSelect = curve.elementControls.querySelector('.curve-prop-select');

        // Clear subsequent dropdowns
        depthSelect.innerHTML = '<option value="">-- Depth --</option>'; depthSelect.disabled = true;
        propSelect.innerHTML = '<option value="">-- Curve --</option>'; propSelect.disabled = true;

        if (curve.filename && this.loadedFiles[curve.filename]) {
              this._populateCurveDepthSelector(trackId, curveId); // This will trigger next steps if successful
        } else {
              // File selection cleared or invalid
              this._prepareAndSetTrackData(trackId); // Update plotter with empty data for this curve
              this.triggerRedrawAllTracks(); // Redraw all (needed if Y domain is affected)
        }
    }

    _handleCurveDepthChange(trackId, curveId, selectedDepth) {
        const track = this.tracks[trackId];
        const curve = track?.curves.get(curveId);
        if (!curve) return;

        console.log(`Track ${trackId}, Curve ${curveId}: Depth changed to ${selectedDepth}`);
        curve.depthMnemonic = selectedDepth || null;
        curve.curveMnemonic = null; // Reset curve selection
        curve.data = null;

        const propSelect = curve.elementControls.querySelector('.curve-prop-select');
        propSelect.innerHTML = '<option value="">-- Curve --</option>'; propSelect.disabled = true;

         if (curve.depthMnemonic) {
              this._populateCurvePropSelector(trackId, curveId);
         } else {
              this._prepareAndSetTrackData(trackId); // Update plotter state
              this.triggerRedrawAllTracks(); // Redraw
         }
    }

     _handleCurvePropChange(trackId, curveId, selectedCurve) {
        const track = this.tracks[trackId];
        const curve = track?.curves.get(curveId);
        if (!curve) return;

        console.log(`Track ${trackId}, Curve ${curveId}: Curve property changed to ${selectedCurve}`);
        curve.curveMnemonic = selectedCurve || null;
        curve.data = null; // Clear old data

        // --- Domain Calculation Logic ---
        // Recalculate the global domain if it hasn't been set yet OR if the depth axis might change
        // This logic might need refinement depending on how depth axis is chosen globally
        let domainMayChange = !this.initialYDomain || (curve.depthMnemonic && curve.curveMnemonic);

        if (domainMayChange) {
            console.log("Potential Y domain change. Recalculating...");
            let allDepths = [];
            Object.values(this.tracks).forEach(t => {
                 t.curves.forEach(c => {
                     if (c.filename && c.depthMnemonic && this.loadedFiles[c.filename]) {
                          const lasData = this.loadedFiles[c.filename];
                          const depthData = lasData.data[c.depthMnemonic];
                          if (depthData) {
                                allDepths.push(...depthData.filter(d => d !== null && !isNaN(d)));
                          }
                     }
                 });
            });

            const calculatedDomain = this._calculateFullYDomain(allDepths);
            if (calculatedDomain) {
                // Only update if it's the first time or if the calculated domain differs
                if (!this.initialYDomain || this.initialYDomain[0] !== calculatedDomain[0] || this.initialYDomain[1] !== calculatedDomain[1]) {
                     this.initialYDomain = [...calculatedDomain]; // Store the base domain
                     this.sharedYDomain = [...calculatedDomain];  // Set the active domain
                     console.log("Initial and Shared Y Domain UPDATED:", this.sharedYDomain);
                 }
             } else if (!this.initialYDomain) {
                  // Handle case where first calculation fails
                  console.warn("Failed to calculate initial domain.");
             }
        }
        // --- End Domain ---

        // --- REFACTORED ---
        // 1. Update the data *within* the plotter for this specific curve's track
        this._prepareAndSetTrackData(trackId);
        // 2. Trigger redraw for all tracks using the potentially new shared domain
        this.triggerRedrawAllTracks();
   }

   // --- MODIFY _handleCurveSettingsChange to hide panel ---
   _handleCurveSettingsChange(trackId, curveId, changes, isRangeChange = false) {
       const track = this.tracks[trackId];
       const curve = track?.curves.get(curveId);
       if (!curve) return;

       console.log(`Track ${trackId}, Curve ${curveId}: Settings changed`, changes);
       let needsPlotUpdate = false; // Flag if plotter's state impacting plot needs update

       if (changes.scaleType !== undefined && changes.scaleType !== curve.scaleType) {
           curve.scaleType = changes.scaleType;
           needsPlotUpdate = true;
       }
       if (changes.color !== undefined && changes.color !== curve.color) {
           curve.color = changes.color;
           needsPlotUpdate = true; // Color affects path attribute and axis
       }
        // --- Pass strokeWidth if it's part of changes (though UI doesn't set it currently) ---
        if (changes.strokeWidth !== undefined && changes.strokeWidth !== curve.strokeWidth) {
            curve.strokeWidth = changes.strokeWidth;
            needsPlotUpdate = true;
        }
        // --- END ---
       if (isRangeChange) {
           // Check if ranges truly differ (handles null vs array comparison)
           const rangesDiffer = !( (changes.xRange === null && curve.xRange === null) ||
                                  (Array.isArray(changes.xRange) && Array.isArray(curve.xRange) &&
                                   changes.xRange[0] === curve.xRange[0] && changes.xRange[1] === curve.xRange[1]) );
           if(rangesDiffer) {
               curve.xRange = changes.xRange;
               needsPlotUpdate = true;
               console.log(`Track ${trackId}, Curve ${curveId}: Explicit X Range set to`, curve.xRange);
           }
       }

       if (needsPlotUpdate) {
           this._prepareAndSetTrackData(trackId); // Re-prepare data with new options
           this.triggerRedrawAllTracks();       // Redraw all
       }

       // --- ADD: Hide the settings panel after applying changes ---
       const settingsPanel = curve.elementControls?.querySelector('.curve-settings-panel');
       if (settingsPanel) {
           settingsPanel.style.display = 'none';
       }
       // Optional: Deactivate the toggle button visually
       const toggleButton = curve.elementControls?.querySelector('.curve-settings-toggle');
       if (toggleButton) {
           toggleButton.classList.remove('active');
       }
       // --- END ADD ---
   }

   // --- MODIFY _prepareAndSetTrackData to pass strokeWidth ---
   _prepareAndSetTrackData(trackId) {
       const track = this.tracks[trackId];
       if (!track || !track.plotter) return;

       const curvesToPlot = [];
       let trackMinX = Infinity;
       let trackMaxX = -Infinity;
       let trackHasCurvesWithoutManualRange = false;

       // --- First Pass: Prepare data and find overall range for auto-scaled curves ---
       track.curves.forEach(curveConfig => {
            if (curveConfig.filename && curveConfig.depthMnemonic && curveConfig.curveMnemonic && this.loadedFiles[curveConfig.filename]) {
                const lasData = this.loadedFiles[curveConfig.filename];
                const depthData = lasData.data[curveConfig.depthMnemonic];
                const valueData = lasData.data[curveConfig.curveMnemonic];

                if (depthData && valueData) {
                    const plotData = depthData.map((d, i) => ({ depth: d, value: valueData[i] }))
                        .filter(p => p.depth !== null && !isNaN(p.depth) && p.value !== null && !isNaN(p.value));

                    if (plotData.length > 0) {
                        curveConfig._tempPlotData = plotData; // Store filtered data

                        if (!curveConfig.xRange) { // Calculate range only if not manual
                            trackHasCurvesWithoutManualRange = true;
                            const [minVal, maxVal] = d3.extent(plotData, d => d.value);
                            if (minVal < trackMinX) trackMinX = minVal;
                            if (maxVal > trackMaxX) trackMaxX = maxVal;
                        }
                    } else {
                        curveConfig._tempPlotData = [];
                    }
                } else {
                     curveConfig._tempPlotData = [];
                }
            } else {
                 curveConfig._tempPlotData = [];
            }
       });

       // --- Determine the shared auto X-range ---
       let sharedAutoXRange = null;
       if (trackHasCurvesWithoutManualRange && trackMinX !== Infinity && trackMaxX !== -Infinity) {
            const niceScale = d3.scaleLinear().domain([trackMinX, trackMaxX]).nice();
            sharedAutoXRange = niceScale.domain();
            // console.log(`Track ${trackId}: Calculated Shared Auto X-Range: [${sharedAutoXRange[0]}, ${sharedAutoXRange[1]}]`);
       } else if (trackHasCurvesWithoutManualRange) {
            sharedAutoXRange = [0, 1]; // Default if no auto curves have data
       }
       track.plotter.sharedAutoXRange = sharedAutoXRange;


       // --- Second Pass: Build the final curvesToPlot array ---
       track.curves.forEach(curveConfig => {
            if (curveConfig._tempPlotData && curveConfig._tempPlotData.length > 0) {
               const curveInfo = this.loadedFiles[curveConfig.filename]?.curveInfo.find(c => c.mnemonic === curveConfig.curveMnemonic);
                curvesToPlot.push({
                    id: curveConfig.id,
                    data: curveConfig._tempPlotData, // Use pre-filtered data
                    options: {
                        filename: curveConfig.filename,
                        scaleType: curveConfig.scaleType,
                        curveColor: curveConfig.color,
                        xRange: curveConfig.xRange, // Pass manual range or null
                        mnemonic: curveConfig.curveMnemonic,
                        unit: curveInfo?.unit || '',
                        strokeWidth: curveConfig.strokeWidth || 1.5 // <<< PASS strokeWidth (or default)
                    }
                });
            }
             delete curveConfig._tempPlotData; // Clean up temp data
       });

       // Update the plotter's internal data store for this track
       track.plotter.setCurves(curvesToPlot);
        // console.log(`Prepared and Set data for Track ${trackId}. Curve count: ${curvesToPlot.length}`);
   }

    // --- Populate Selectors ---

    _updateAllCurveFileSelectors() {
        Object.values(this.tracks).forEach(track => {
             track.curves.forEach(curve => {
                   this._updateCurveFileSelector(curve.elementControls, curve.filename);
             });
        });
    }

    _updateCurveFileSelector(curveControlsElement, currentSelection) {
        const fileSelect = curveControlsElement.querySelector('.curve-file-select');
        if (!fileSelect) return;

        fileSelect.innerHTML = '<option value="">-- File --</option>'; // Clear existing options
        Object.keys(this.loadedFiles).sort().forEach(filename => {
             const option = document.createElement('option');
             option.value = filename;
             option.textContent = filename;
             fileSelect.appendChild(option);
        });

        // Restore selection if possible
        if (currentSelection && this.loadedFiles[currentSelection]) {
             fileSelect.value = currentSelection;
        } else {
              fileSelect.value = ""; // Ensure it's reset if file no longer loaded
        }
    }

    _populateCurveDepthSelector(trackId, curveId) {
          const track = this.tracks[trackId];
          const curve = track?.curves.get(curveId);
          const depthSelect = curve?.elementControls.querySelector('.curve-depth-select');
          if (!curve || !curve.filename || !depthSelect || !this.loadedFiles[curve.filename]) return;

          const lasData = this.loadedFiles[curve.filename];
          depthSelect.innerHTML = '<option value="">-- Depth --</option>';
          let depthCandidateFound = false;
          let potentialDepths = [];

          if (lasData.curveInfo && lasData.data) {
                lasData.curveInfo.forEach(cInfo => {
                      // Check if the curve has actual data points associated with it
                      if (lasData.data[cInfo.mnemonic] && lasData.data[cInfo.mnemonic].some(v => v !== null && !isNaN(v))) { // Check for some numeric data
                          potentialDepths.push(cInfo);
                          depthCandidateFound = true;
                      }
                });
          }

          if (depthCandidateFound) {
                // Sort alphabetically for consistency
                potentialDepths.sort((a, b) => a.mnemonic.localeCompare(b.mnemonic));
                potentialDepths.forEach(cInfo => {
                      const option = document.createElement('option');
                      option.value = cInfo.mnemonic;
                      option.textContent = `${cInfo.mnemonic} (${cInfo.unit || 'N/A'})`;
                      option.title = cInfo.description || cInfo.mnemonic;
                      depthSelect.appendChild(option);
                });

                depthSelect.disabled = false;
                // Try to auto-select common depth names
                const commonDepths = ['DEPT', 'DEPTH', 'MD'];
                let foundDefault = false;
                for (const depthName of commonDepths) {
                      const depthOption = depthSelect.querySelector(`option[value="${depthName}"]`);
                      if (depthOption) {
                            depthSelect.value = depthName;
                            foundDefault = true;
                            this._handleCurveDepthChange(trackId, curveId, depthName); // Trigger next step
                            break;
                      }
                }
                // If no default found, leave as "-- Depth --" and ensure prop select is disabled
                if (!foundDefault) {
                     const propSelect = curve.elementControls.querySelector('.curve-prop-select');
                     propSelect.innerHTML = '<option value="">-- Curve --</option>'; propSelect.disabled = true;
                    this._prepareAndSetTrackData(trackId); // Prep track data (will be empty for this curve)
                    this.triggerRedrawAllTracks(); // Redraw
                }
          } else {
                depthSelect.disabled = true;
                const propSelect = curve.elementControls.querySelector('.curve-prop-select');
                propSelect.innerHTML = '<option value="">-- Curve --</option>'; propSelect.disabled = true;
                 console.warn(`Track ${trackId}, Curve ${curveId}: No curves with data found in file ${curve.filename} to use as depth.`);
                 this._prepareAndSetTrackData(trackId); // Prep track data
                 this.triggerRedrawAllTracks(); // Redraw
          }
      }

    _populateCurvePropSelector(trackId, curveId) {
          const track = this.tracks[trackId];
          const curve = track?.curves.get(curveId);
          const propSelect = curve?.elementControls.querySelector('.curve-prop-select');
          if (!curve || !curve.filename || !curve.depthMnemonic || !propSelect || !this.loadedFiles[curve.filename]) return;

          const lasData = this.loadedFiles[curve.filename];
          propSelect.innerHTML = '<option value="">-- Curve --</option>';
          let curveAdded = false;
          let potentialCurves = [];

          if (lasData.curveInfo && lasData.data) {
                lasData.curveInfo.forEach(cInfo => {
                      // Include curves that have data and are NOT the selected depth curve
                      if (cInfo.mnemonic !== curve.depthMnemonic && lasData.data[cInfo.mnemonic] && lasData.data[cInfo.mnemonic].some(v => v !== null && !isNaN(v))) {
                          potentialCurves.push(cInfo);
                          curveAdded = true;
                      }
                });
          }

          if (curveAdded) {
                 potentialCurves.sort((a, b) => a.mnemonic.localeCompare(b.mnemonic));
                 potentialCurves.forEach(cInfo => {
                      const option = document.createElement('option');
                      option.value = cInfo.mnemonic;
                      option.textContent = `${cInfo.mnemonic} (${cInfo.unit || 'N/A'})`;
                      option.title = cInfo.description || cInfo.mnemonic;
                      propSelect.appendChild(option);
                 });
                propSelect.disabled = false;
          } else {
                propSelect.disabled = true;
                console.warn(`Track ${trackId}, Curve ${curveId}: No value curves available for depth ${curve.depthMnemonic}`);
                 this._prepareAndSetTrackData(trackId); // Prep track data
                 this.triggerRedrawAllTracks(); // Redraw
          }
      }

    /** Called by Plotter instance on zoom event - Now acts as the entry point for throttling */
    handleZoom(zoomTransform) {
        this.lastZoomTransform = zoomTransform; // Store the latest transform

        if (!this.zoomEventScheduled) {
             this.zoomEventScheduled = true;

             setTimeout(() => {
                  this.processThrottledZoom();
                  this.zoomEventScheduled = false; // Allow scheduling next event after processing
             }, this.throttleDelay);
        }
    }

      processThrottledZoom() {
        const zoomTransform = this.lastZoomTransform;
        if (!zoomTransform) return; // Should not happen if logic is correct

        // --- Filter out very small zoom changes (potential jitter) ---
        // Disabled for now, might need tuning
        // const zoomThreshold = 0.02; // Ignore if k is within 2% of 1.0
        // if (Math.abs(zoomTransform.k - 1.0) < zoomThreshold &&
        //      Math.abs(zoomTransform.x) < 5 &&
        //      Math.abs(zoomTransform.y) < 5) {
        //      // console.log("Zoom skipped: Minimal change detected (potential jitter).");
        //      return;
        // }

        // Check prerequisite conditions (domain must exist, tracks must exist)
        if (!this.sharedYDomain) {
             console.log("Zoom processing skipped: No shared Y domain set yet.");
             return;
        }
        if (Object.keys(this.tracks).length === 0) {
             console.log("Zoom processing skipped: No tracks exist.");
             return;
        }

        // Basic check for invalid scale factor
        if (isNaN(zoomTransform.k) || zoomTransform.k <= 0) {
             console.error("Zoom processing skipped: Invalid scale factor k =", zoomTransform.k);
             return;
        }

        // console.log(`Processing Zoom Transform: k=${zoomTransform.k.toFixed(3)}, x=${zoomTransform.x.toFixed(1)}, y=${zoomTransform.y.toFixed(1)}`);

        // Get a representative height for the scale's range.
        let representativeHeight = 500; // Default fallback height
        const firstTrackId = Object.keys(this.tracks)[0];
        const referencePlotter = this.tracks[firstTrackId]?.plotter;
        if (referencePlotter && referencePlotter.innerHeight > 0) {
             representativeHeight = referencePlotter.innerHeight;
        }

        // Store the initial (base) domain once if not already stored.
        if (!this.initialYDomain) {
             this.initialYDomain = [...this.sharedYDomain];
             console.log(`Initial Y Domain set: [${this.initialYDomain[0]}, ${this.initialYDomain[1]}]`);
        }
        const baseDomain = this.initialYDomain;

        let newDomain;
        // Use zoomTransform.rescaleY on a scale defined by the *base* domain
        const scaleToTransform = d3.scaleLinear()
            .domain(baseDomain) // Always use the initial domain as the reference for rescaleY
            .range([representativeHeight, 0]); // Map to the pixel range (top to bottom)

        const newYScale = zoomTransform.rescaleY(scaleToTransform);
        newDomain = newYScale.domain();

        // Ensure the domain is top-down (larger value first)
        if (newDomain[0] < newDomain[1]) {
             newDomain = [newDomain[1], newDomain[0]];
        }

        // console.log(`Zoom: New domain after transform: [${newDomain[0].toFixed(2)}, ${newDomain[1].toFixed(2)}]`);


        // Update the shared domain state with the new domain
        this.sharedYDomain = newDomain;
        // console.log(`Zoom: Updated shared domain: [${newDomain[0].toFixed(1)}, ${newDomain[1].toFixed(1)}]`);

        // Trigger redraw for all tracks with requestAnimationFrame for smoother rendering
        requestAnimationFrame(() => {
             this.triggerRedrawAllTracks();
        });
    }


    // --- MODIFY _redrawTrack to handle empty track message ---
    _redrawTrack(trackId) {
        const track = this.tracks[trackId];
        const plotArea = track?.elementPlot; // Get the plot container div
        if (!plotArea) return; // Skip if plot area DOM element doesn't exist

        // Clear previous message first
        const existingMessage = plotArea.querySelector('p.plot-message');
        if (existingMessage) existingMessage.remove();

        if (track && track.plotter && this.sharedYDomain) {
            // Data should be up-to-date via _prepareAndSetTrackData
            track.plotter.draw(this.sharedYDomain); // Call the plotter's draw method

            // --- ADD: Check if plotter actually drew curves ---
            let curvesDrawn = false;
            if (track.plotter.curves && track.plotter.curves.size > 0) {
                // Check if any curve actually has a path element with drawing commands
                track.plotter.curves.forEach(curveState => {
                    if (curveState.path) { // Check if path element exists
                         const dAttribute = curveState.path.attr('d');
                         // Check for actual drawing commands (not empty, not just 'M', not NaN)
                         if (dAttribute && dAttribute.length > 1 && !dAttribute.includes('NaN') && dAttribute.toUpperCase() !== 'M') {
                             curvesDrawn = true;
                         }
                    }
                });
            }
            // Check if *any* curves were configured for this track at all
             const hasConfiguredCurves = track.curves.size > 0 && Array.from(track.curves.values()).some(c => c.curveMnemonic);


            // Show title if no curves were drawn OR if no curves are configured yet
            if (!curvesDrawn && hasConfiguredCurves) { // Only show if curves *should* be there but aren't drawn
                 const trackTitle = track.elementControls?.querySelector('.track-title')?.textContent || `Track ${trackId.split('-')[1]}`;
                 const p = document.createElement('p');
                 p.className = 'plot-message';
                 p.textContent = `${trackTitle} (No valid data in range)`; // More specific message
                 p.style.textAlign = 'center'; p.style.marginTop = '40px'; p.style.fontStyle = 'italic'; p.style.color = '#6c757d';
                 plotArea.appendChild(p);
            } else if (!hasConfiguredCurves) { // If track is truly empty
                 const trackTitle = track.elementControls?.querySelector('.track-title')?.textContent || `Track ${trackId.split('-')[1]}`;
                 const p = document.createElement('p');
                 p.className = 'plot-message';
                 p.textContent = trackTitle; // Display just track title for empty config
                 p.style.textAlign = 'center'; p.style.marginTop = '40px'; p.style.fontStyle = 'italic'; p.style.color = '#6c757d';
                 plotArea.appendChild(p);
            }
             // --- END ADD ---

        } else if (track && track.plotter) { // No shared domain yet, or plotter exists but failed somehow
            track.plotter.draw([0, 1]); // Draw empty state
            // Add message if plotter exists but cannot draw
            const trackTitle = track.elementControls?.querySelector('.track-title')?.textContent || `Track ${trackId.split('-')[1]}`;
            const p = document.createElement('p');
            p.className = 'plot-message';
            p.textContent = `${trackTitle}` + (this.sharedYDomain ? ' (Plot error)' : ' (Waiting for data)');
             p.style.textAlign = 'center'; p.style.marginTop = '40px'; p.style.fontStyle = 'italic'; p.style.color = '#6c757d';
            plotArea.appendChild(p);
        } else {
            // Handle case where track exists but plotter somehow failed/doesn't exist
            const trackTitle = track?.elementControls?.querySelector('.track-title')?.textContent || `Track ${trackId.split('-')[1]}`;
            const p = document.createElement('p');
            p.className = 'plot-message';
            p.textContent = `${trackTitle} (Plotter failed)`;
             p.style.textAlign = 'center'; p.style.marginTop = '40px'; p.style.fontStyle = 'italic'; p.style.color = 'red'; // Indicate error
            plotArea.appendChild(p);
        }
    }

    /** Redraws all tracks using the current shared Y domain */
    triggerRedrawAllTracks() {
         if (!this.sharedYDomain && Object.keys(this.loadedFiles).length > 0) {
              console.warn("Cannot redraw all tracks: Shared Y Domain is null, but files are loaded. Attempting recalculation...");
              // Attempt to recalculate domain if files exist but domain is missing
                let allDepths = [];
                Object.values(this.tracks).forEach(t => {
                    t.curves.forEach(c => {
                        if (c.filename && c.depthMnemonic && this.loadedFiles[c.filename]) {
                            const lasData = this.loadedFiles[c.filename];
                            const depthData = lasData.data[c.depthMnemonic];
                            if (depthData) {
                                allDepths.push(...depthData.filter(d => d !== null && !isNaN(d)));
                            }
                        }
                    });
                });
                const calculatedDomain = this._calculateFullYDomain(allDepths);
                if(calculatedDomain) {
                    console.log("Recalculated domain during redraw trigger.");
                    this.sharedYDomain = [...calculatedDomain];
                    if(!this.initialYDomain) this.initialYDomain = [...calculatedDomain];
                } else {
                     console.error("Failed to recalculate domain. Redraw aborted.");
                     // Draw empty state for all tracks?
                     Object.keys(this.tracks).forEach(trackId => this._redrawTrack(trackId));
                     return;
                }
         } else if (!this.sharedYDomain) {
              console.log("Cannot redraw all tracks: Shared Y Domain is null and no files loaded.");
              // Draw empty state for any existing tracks
              Object.keys(this.tracks).forEach(trackId => this._redrawTrack(trackId));
              return;
         }

         // console.log("Triggering redraw for all tracks with domain:", this.sharedYDomain);
         requestAnimationFrame(() => { // Use rAF for smoother rendering, especially during zoom
              Object.keys(this.tracks).forEach(trackId => {
                  this._redrawTrack(trackId);
              });
         });
    }


    // --- UI Update Helpers ---

      /** Update the messages in the controls/plots containers */
      _updateTracksContainerMessages() {
          // Controls container message
          const controlsMsg = this.trackControlsContainer.querySelector('p.controls-message');
          if (Object.keys(this.tracks).length === 0) {
                if (!controlsMsg) {
                      const p = document.createElement('p'); p.className = 'controls-message text-center text-gray-500 py-4';
                      p.textContent = Object.keys(this.loadedFiles).length > 0 ? 'Click "Add Track" in the sidebar to start plotting.' : 'Load a LAS file first using the button in the sidebar.';
                      this.trackControlsContainer.insertBefore(p, this.trackControlsContainer.firstChild); // Add message at the top
                } else {
                      controlsMsg.textContent = Object.keys(this.loadedFiles).length > 0 ? 'Click "Add Track" in the sidebar to start plotting.' : 'Load a LAS file first using the button in the sidebar.';
                      controlsMsg.style.display = 'block';
                }
          } else {
                if (controlsMsg) controlsMsg.style.display = 'none';
          }

          // Plots container message (Plotter handles individual track messages now)
          const plotsMsg = this.tracksPlotContainer.querySelector('p.plots-message');
           if (Object.keys(this.tracks).length === 0) {
                if (!plotsMsg) {
                      const p = document.createElement('p'); p.className = 'plots-message text-center text-gray-500 py-10';
                      p.textContent = Object.keys(this.loadedFiles).length > 0 ? 'Add tracks and configure curves to see plots.' : 'Load a LAS file using the button on the left.';
                      this.tracksPlotContainer.appendChild(p);
                } else {
                     plotsMsg.textContent = Object.keys(this.loadedFiles).length > 0 ? 'Add tracks and configure curves to see plots.' : 'Load a LAS file using the button on the left.';
                     plotsMsg.style.display = 'block';
                }
          } else {
                if (plotsMsg) plotsMsg.style.display = 'none'; // Hide general message if tracks exist
          }

          if (this.clearCurvesBtn) {
                const hasCurves = Object.values(this.tracks).some(t => t && t.curves && t.curves.size > 0);
                this.clearCurvesBtn.disabled = !hasCurves;
          }
      }


    /** Generates a random hex color */
    _getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
             color += letters[Math.floor(Math.random() * 16)];
        }
        // Avoid pure white or very light colors for default lines
        if (color.toUpperCase() === '#FFFFFF' || color.toUpperCase() === '#FEFEFE' || color.toUpperCase() === '#EFEFEF') {
            return this._getRandomColor(); // Recurse if too light
        }
        return color;
    }


    // --- NEW: Helper to find depth key in a loaded LAS data object ---
    findDepthKeyInLas(lasData) {
        if (!lasData || !lasData.curveInfo) return null;
        const commonDepths = ['DEPT', 'DEPTH', 'MD']; // Prioritize common names
        for (const depthName of commonDepths) {
             // Check if data exists and has more than one point (more robust)
             if (lasData.data?.[depthName] && lasData.data[depthName].length > 1) {
                 return depthName;
             }
        }
        // Fallback: Find first curve with "DEPTH" or "DEPT" in description (less reliable)
        const depthCurve = lasData.curveInfo.find(c =>
             (c.description?.toUpperCase().includes('DEPTH') || c.description?.toUpperCase().includes('DEPT')) &&
             lasData.data?.[c.mnemonic] && lasData.data[c.mnemonic].length > 1
        );
         if (depthCurve) return depthCurve.mnemonic;

         // Fallback: Return the very first curve if desperate? Might be wrong.
         if(lasData.curveInfo.length > 0 && lasData.data?.[lasData.curveInfo[0].mnemonic] && lasData.data[lasData.curveInfo[0].mnemonic].length > 1) {
            console.warn(`Falling back to first curve '${lasData.curveInfo[0].mnemonic}' as depth key for file ${lasData.filename}`);
            return lasData.curveInfo[0].mnemonic;
         }

        return null; // Indicate not found
    }

    // --- NEW: Helper to find common depth key across multiple files ---
    findCommonDepthKey(filenames) {
        if (!filenames || filenames.length === 0) return null;
        let commonKey = null;
        let firstFile = true;

        for (const filename of filenames) {
             const lasData = this.loadedFiles[filename];
             if (!lasData) {
                  console.warn(`Cannot find common depth key: File ${filename} not loaded.`);
                  return null; // If any file isn't loaded, we can't determine common key
             }
             const fileDepthKey = this.findDepthKeyInLas(lasData);
             if (!fileDepthKey) {
                    console.warn(`Cannot find common depth key: No suitable depth key found in ${filename}.`);
                   return null; // If any file lacks a depth key
             }
             if (firstFile) {
                  commonKey = fileDepthKey;
                  firstFile = false;
             } else if (commonKey !== fileDepthKey) {
                  // Allow DEPT and DEPTH as equivalent?
                  const equivalentKeys = ['DEPT', 'DEPTH'];
                  if (equivalentKeys.includes(commonKey.toUpperCase()) && equivalentKeys.includes(fileDepthKey.toUpperCase())) {
                     console.log(`Treating '${commonKey}' and '${fileDepthKey}' as equivalent depth keys.`);
                     // Keep the first one found as the common key
                  } else {
                      console.warn(`Depth key mismatch between files: '${commonKey}' vs '${fileDepthKey}' in ${filename}. Cannot determine common key.`);
                      return null; // Mismatch found
                  }
             }
        }
        if(commonKey) console.log(`Found common depth key '${commonKey}' for files:`, filenames);
        return commonKey;
    }

    // --- MODIFY configureCurve to accept strokeWidth ---
    configureCurve(trackId, curveId, config) {
        const track = this.tracks[trackId];
        const curve = track?.curves.get(curveId);
        if (!curve || !config) return;

        // console.log(`Configuring Curve ${curveId} on Track ${trackId}:`, config);

        const controls = curve.elementControls;
        let changed = false;
        let settingsChanged = false; // Flag specifically for settings panel hide

        // --- Update internal state first ---
        if (config.filename !== undefined) curve.filename = config.filename;
        if (config.depthMnemonic !== undefined) curve.depthMnemonic = config.depthMnemonic;
        if (config.curveMnemonic !== undefined) curve.curveMnemonic = config.curveMnemonic;
        if (config.color !== undefined) { curve.color = config.color; settingsChanged = true; }
        if (config.scaleType !== undefined) { curve.scaleType = config.scaleType; settingsChanged = true; }
        if (config.xRange !== undefined) { // Allow setting xRange to null
             // Only flag settingsChanged if the range *actually* changes
             const rangesDiffer = !( (config.xRange === null && curve.xRange === null) ||
                                   (Array.isArray(config.xRange) && Array.isArray(curve.xRange) &&
                                    config.xRange[0] === curve.xRange[0] && config.xRange[1] === curve.xRange[1]) );
             if(rangesDiffer) {
                 curve.xRange = config.xRange;
                 settingsChanged = true;
             }
        }
        // --- ADD strokeWidth to state ---
        if (config.strokeWidth !== undefined && config.strokeWidth !== curve.strokeWidth) {
             curve.strokeWidth = config.strokeWidth;
             // Don't necessarily flag settingsChanged here unless UI directly modifies it
        }
        // --- END ---


        // --- Configure File ---
        if (config.filename !== undefined) {
            const fileSelect = controls.querySelector('.curve-file-select');
            if (fileSelect && this.loadedFiles[config.filename]) {
                if(fileSelect.value !== config.filename) {
                    fileSelect.value = config.filename;
                    // Use internal state change to trigger the cascade, avoid direct handler call here
                    this._handleCurveFileChange(trackId, curveId, config.filename); // Triggers depth populate
                    changed = true;
                }
            } else if (config.filename) {
                 console.warn(`Cannot configure curve ${curveId}: File ${config.filename} not loaded or file select not found.`);
                 return; // Stop configuration if file invalid
            }
        }

        // Use setTimeout chain as before for dependent dropdowns
        setTimeout(() => {
            let depthChangedInternal = false;
            if (config.depthMnemonic !== undefined) {
                const depthSelect = controls.querySelector('.curve-depth-select');
                // Check if the option *exists* before trying to set it
                const depthOption = depthSelect?.querySelector(`option[value="${config.depthMnemonic}"]`);
                if (depthOption) {
                    if(depthSelect.value !== config.depthMnemonic) {
                        depthSelect.value = config.depthMnemonic;
                        // Use internal state change to trigger cascade
                         this._handleCurveDepthChange(trackId, curveId, config.depthMnemonic); // Triggers curve populate
                        depthChangedInternal = true;
                        changed = true;
                    }
                } else if (config.depthMnemonic) {
                    console.warn(`Cannot configure curve ${curveId}: Depth mnemonic ${config.depthMnemonic} not found in select (File: ${curve.filename}). Might populate later.`);
                    // Don't return here, let curve attempt continue
                }
            }

            setTimeout(() => {
                 let curvePropChangedInternal = false;
                if (config.curveMnemonic !== undefined) {
                    const propSelect = controls.querySelector('.curve-prop-select');
                    const propOption = propSelect?.querySelector(`option[value="${config.curveMnemonic}"]`);
                    if (propOption) {
                         if(propSelect.value !== config.curveMnemonic) {
                             propSelect.value = config.curveMnemonic;
                             // Update state directly as it was done above (handler will be called later)
                             curve.curveMnemonic = config.curveMnemonic;
                             curvePropChangedInternal = true;
                             changed = true;
                         }
                    } else if (config.curveMnemonic) {
                        console.warn(`Cannot configure curve ${curveId}: Curve mnemonic ${config.curveMnemonic} not found in select (File: ${curve.filename}, Depth: ${curve.depthMnemonic}). Might populate later.`);
                        // Reset state if invalid selection attempted
                        // if(propSelect) propSelect.value = "";
                        // curve.curveMnemonic = null;
                        // changed = true;
                    }
                }

                // --- Configure Settings Controls (Reflect final state) ---
                if (config.color !== undefined) {
                    controls.querySelector('.curve-color-picker').value = curve.color;
                }
                if (config.scaleType !== undefined) {
                    controls.querySelector('.curve-scale-select').value = curve.scaleType;
                }
                if (config.xRange !== undefined) { // Check config.xRange again for consistency
                    const xMinInput = controls.querySelector('.x-range-input.x-min');
                    const xMaxInput = controls.querySelector('.x-range-input.x-max');
                    if (curve.xRange && Array.isArray(curve.xRange) && curve.xRange.length === 2) {
                        xMinInput.value = curve.xRange[0];
                        xMaxInput.value = curve.xRange[1];
                    } else {
                        xMinInput.value = '';
                        xMaxInput.value = '';
                    }
                }

                 // --- Trigger redraw / update ---
                 // Check if any significant property (file, depth, curve, settings) changed that requires plot update
                 const needsPlotUpdate = changed || settingsChanged;
                 if (needsPlotUpdate && curve.filename && curve.depthMnemonic && curve.curveMnemonic) {
                    // Only prepare/redraw if we have a valid curve selection
                     this._prepareAndSetTrackData(trackId);
                     this.triggerRedrawAllTracks();

                     // Hide settings panel if a setting was changed via this function
                     if (settingsChanged) {
                        const settingsPanel = controls.querySelector('.curve-settings-panel');
                        if(settingsPanel) settingsPanel.style.display = 'none';
                        const toggleButton = controls.querySelector('.curve-settings-toggle');
                        if(toggleButton) toggleButton.classList.remove('active');
                     }
                 } else if (needsPlotUpdate) {
                     // If something changed but curve became invalid, clear plot
                     this._prepareAndSetTrackData(trackId);
                     this.triggerRedrawAllTracks();
                 }

            }, 50); // Delay for curve options
        }, 50); // Delay for depth options
    }


    // --- MODIFY configureTracksFromProvenance to pass strokeWidth and set title ---
    configureTracksFromProvenance() {
        const provenance = window.APP_DATA?.spliceProvenance;
        const splicedFilename = provenance?.spliced_filename; // Assumes fix from previous step is done
        const outputMap = provenance?.output_curves;

        if (!provenance || !splicedFilename || !outputMap || typeof outputMap !== 'object') {
             console.warn("Cannot configure tracks: Splice provenance data missing or invalid.");
             return;
        }
        if (!this.loadedFiles[splicedFilename]) {
             console.error(`Cannot configure tracks: Spliced file "${splicedFilename}" is not loaded.`);
             alert(`Error: The main spliced file "${splicedFilename}" failed to load. Cannot auto-configure plots.`);
             return;
        }

        console.log("Attempting to configure tracks using provenance data:", provenance);

        // --- Define colors and thickness ---
        const outputCurveColor = "#008000"; // Green
        const outputCurveWidth = 10.0;
        const inputCurveColor = "#444444"; // Dark Grey/Black
        const inputCurveWidth = 1.5;


        for (const outputCategory in outputMap) {
            if (Object.hasOwnProperty.call(outputMap, outputCategory)) {
                const origins = outputMap[outputCategory];

                console.log(`Configuring track for Output Category: ${outputCategory}`);

                 // Collect involved files and check if loaded
                 const involvedFilenames = [splicedFilename];
                 if (Array.isArray(origins)) {
                     origins.forEach(origin => {
                         if (origin.input_file && !involvedFilenames.includes(origin.input_file)) {
                             involvedFilenames.push(origin.input_file);
                         }
                     });
                 }
                 const allFilesLoaded = involvedFilenames.every(fname => {
                     if (!this.loadedFiles[fname]) {
                         console.error(`Cannot configure track for ${outputCategory}: Required file "${fname}" is not loaded.`);
                         return false;
                     }
                     return true;
                 });
                 if (!allFilesLoaded) {
                    console.warn(`Skipping track configuration for ${outputCategory} due to missing files.`);
                    continue;
                 }

                 // Find common depth key
                 const commonDepthKey = this.findCommonDepthKey(involvedFilenames);
                 if (!commonDepthKey) {
                    console.warn(`Skipping track configuration for ${outputCategory}: Could not determine a common depth key.`);
                    continue;
                 }

                // --- Create Track and Configure Curves ---
                const trackId = this.addTrack();
                if (!trackId) {
                    console.error(`Failed to add track for ${outputCategory}.`);
                    continue;
                 }

                const track = this.tracks[trackId];
                // --- Set Track Title ---
                 if(track && track.elementControls) {
                     track.elementControls.querySelector('.track-title').textContent = outputCategory; // Use category name as title
                 }

                // Get the ID of the first curve added by addTrack
                const curveIds = Array.from(track.curves.keys());
                if (curveIds.length === 0) {
                    console.error(`Track ${trackId} (${outputCategory}) created but has no curve controls.`);
                    this.removeTrack(trackId); // Clean up failed track
                    continue;
                }
                let curveConfigIndex = 0; // Use index to assign configs to added curves

                // 1. Configure the Output (Spliced) Curve using the *first* curve controls
                const outputCurveId = curveIds[curveConfigIndex++];
                this.configureCurve(trackId, outputCurveId, {
                    filename: splicedFilename,
                    depthMnemonic: commonDepthKey,
                    curveMnemonic: outputCategory,
                    color: outputCurveColor,
                    strokeWidth: outputCurveWidth, // <<< ADDED thickness
                    strokeStyle:"solid",
                    scaleType: (outputCategory.toUpperCase().includes('GR') || outputCategory.toUpperCase().includes('SP') || outputCategory.toUpperCase().includes('CALI') || outputCategory.toUpperCase().includes('RHOB') || outputCategory.toUpperCase().includes('NPHI')) ? 'linear' : 'log',
                });

                // 2. Configure Input Curves
                if (Array.isArray(origins)) {
                    origins.forEach(origin => {
                        const inputFileData = this.loadedFiles[origin.input_file];
                        // Check curve exists *in the data* of the loaded file
                        if (!inputFileData || !inputFileData.data[origin.curve]) {
                             console.warn(`Skipping input curve ${origin.curve} from ${origin.input_file} for track ${outputCategory}: Curve data not found.`);
                             return; // Skip this specific input curve
                        }

                        // Add *new* curve controls for each input curve
                        const inputCurveId = this.addCurveToTrack(trackId);
                        if (!inputCurveId) {
                            console.error(`Failed to add curve controls for input ${origin.curve} on track ${trackId}`);
                            return; // Skip if adding controls failed
                        }

                        this.configureCurve(trackId, inputCurveId, {
                            filename: origin.input_file,
                            depthMnemonic: commonDepthKey,
                            curveMnemonic: origin.curve,
                            color: inputCurveColor,
                            strokeStyle:"dashed",
                            strokeWidth: inputCurveWidth, // <<< ADDED thickness
                            scaleType: (origin.curve.toUpperCase().includes('GR') || origin.curve.toUpperCase().includes('SP') || origin.curve.toUpperCase().includes('CALI') || origin.curve.toUpperCase().includes('RHOB') || origin.curve.toUpperCase().includes('NPHI')) ? 'linear' : 'log',
                        });
                    });
                }
            } // end if hasOwnProperty
        } // end for loop over outputMap

        console.log("Finished configuring tracks from provenance.");
        // Final redraw is handled implicitly by setTimeouts within configureCurve.
        // Add one final explicit redraw call for safety after a delay.
        setTimeout(() => {
            // Recalculate final domain based on ALL configured curves
            let allDepths = [];
            Object.values(this.tracks).forEach(t => {
                 t.curves.forEach(c => {
                     if (c.filename && c.depthMnemonic && this.loadedFiles[c.filename]) {
                          const lasData = this.loadedFiles[c.filename];
                          const depthData = lasData.data[c.depthMnemonic];
                          if (depthData) {
                                allDepths.push(...depthData.filter(d => d !== null && !isNaN(d)));
                          }
                     }
                 });
            });
            const finalDomain = this._calculateFullYDomain(allDepths);
            if(finalDomain) {
                this.sharedYDomain = [...finalDomain];
                if(!this.initialYDomain) this.initialYDomain = [...finalDomain];
            }
            // Now trigger redraw with the final domain
            this.triggerRedrawAllTracks();
            this._updateTracksContainerMessages();
        }, 300); // Adjust delay if needed

    } // end configureTracksFromProvenance

} // End Viewer Class

export { Viewer };