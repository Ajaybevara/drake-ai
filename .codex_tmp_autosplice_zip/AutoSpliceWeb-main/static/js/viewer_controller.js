// static/js/viewer_controller.js
import { Viewer } from '../well_log_viewer/js/viewer.js';




document.addEventListener('DOMContentLoaded', () => {
    console.log("Viewer Controller Initializing...");

    if (!window.APP_DATA) {
        console.error("Error: Initial data (window.APP_DATA) not found.");
        alert("Critical error: Configuration data missing. Cannot initialize viewer.");
        return;
    }
    if (!window.APP_DATA.filesToAutoload) {
         console.warn("APP_DATA.filesToAutoload is missing. No files will be loaded initially.");
         window.APP_DATA.filesToAutoload = []; // Ensure it's an array
    }
     if (!window.APP_DATA.spliceProvenance) {
         console.warn("APP_DATA.spliceProvenance is missing. Automatic track configuration based on provenance is disabled.");
         // Initialize as empty object to prevent errors later
         window.APP_DATA.spliceProvenance = { output_curves: {} };
    }


    // --- Tab Handling (Keep existing) ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab; // e.g., "log-plots" or "splice-summary"
            console.log(`Tab clicked: ${targetTab}`);

            // 1. Update Button States
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');

            // 2. Update Content Visibility
            tabContents.forEach(content => {
                // Remove 'active' from ALL content divs first
                content.classList.remove('active');
                // Add 'active' ONLY to the matching content div
                if (content.id === `${targetTab}-content`) {
                    content.classList.add('active');
                    console.log(`Activating content: #${content.id}`);
                }
            });

             // Optional: Trigger redraw if log plots tab becomes active
             if (targetTab === 'log-plots' && window.viewerInstance) {
                console.log("Log plots tab activated, triggering redraw.");
                window.viewerInstance.triggerRedrawAllTracks();
             }
        });
    });
    // Find the default active button and content based on HTML structure if needed
    const initialActiveButton = document.querySelector('.tab-button.active');
    if (initialActiveButton) {
        const initialTabId = `${initialActiveButton.dataset.tab}-content`;
        const initialActiveContent = document.getElementById(initialTabId);
        // Ensure all others are inactive, and the correct one is active
        tabContents.forEach(content => {
             content.classList.toggle('active', content.id === initialTabId);
        });
         console.log(`Initial active tab content: #${initialTabId}`);
    } else {
        // Fallback: Activate the first tab if none are marked active in HTML
        if (tabButtons.length > 0 && tabContents.length > 0) {
             console.warn("No initial active tab found in HTML, activating the first one.");
             tabButtons[0].classList.add('active');
             tabContents[0].classList.add('active');
             // Potentially trigger redraw if first tab is log-plots
              if (tabButtons[0].dataset.tab === 'log-plots' && window.viewerInstance) {
                 setTimeout(() => window.viewerInstance.triggerRedrawAllTracks(), 50); // Delay slightly
              }
        }
    }
    // --- End Tab Handling ---
    // --- End Tab Handling ---


    // Instantiate the viewer
    const viewer = new Viewer();
    viewer.init();
    window.viewerInstance = viewer; // Make global if needed

    // --- Autoload Files ---
    const filesToLoad = window.APP_DATA.filesToAutoload || [];
    if (filesToLoad.length > 0) {
        // Set initial message
        const plotsMsg = viewer.tracksPlotContainer.querySelector('p.plots-message');
        if(plotsMsg) plotsMsg.textContent = `Loading ${filesToLoad.length} file(s)...`;

        // Create promises to load each file
        const loadPromises = filesToLoad.map(fileInfo => {
            if (!fileInfo || !fileInfo.filename || !fileInfo.project) {
                 console.error("Invalid file info in filesToAutoload:", fileInfo);
                 return Promise.reject(new Error("Invalid file information provided for autoloading."));
            }
            // Add loading indicator to sidebar list *before* starting fetch
            viewer._setLoadingState(fileInfo.filename, true);
            // Return the promise from fetchAndParseLas
            return viewer.fetchAndParseLas(fileInfo.project, fileInfo.well, fileInfo.filename)
                .then(parsedData => {
                    console.log(`Successfully loaded and parsed ${fileInfo.filename}`);
                    viewer._addFileToList(fileInfo.filename); // Add to sidebar list on success
                    return { status: 'fulfilled', value: parsedData, filename: fileInfo.filename }; // Return structured success
                })
                .catch(error => {
                    console.error(`Failed to load ${fileInfo.filename}:`, error);
                    // Update UI for failed load
                    const listItem = viewer.loadedFilesList.querySelector(`li[data-filename="${fileInfo.filename}"]`);
                     if (listItem) {
                         listItem.innerHTML += ` <span class="load-error"> (Load Failed)</span>`;
                         listItem.title = error.message;
                     }
                    return { status: 'rejected', reason: error, filename: fileInfo.filename }; // Return structured failure
                })
                 .finally(() => {
                     // Remove spinner regardless of outcome
                     viewer._setLoadingState(fileInfo.filename, false);
                 });
        });

        // Process results after all attempts are settled
        Promise.allSettled(loadPromises).then(results => {
            console.log("Autoloading settled. Results:", results);
            let allDepths = [];
            let successfullyLoadedFiles = [];

            results.forEach((result) => {
                if (result.status === 'fulfilled' && result.value) {
                    successfullyLoadedFiles.push(result.value.filename); // Use filename from fulfilled value
                    const loadedData = viewer.loadedFiles[result.value.filename]; // Access stored data
                    const depthKey = viewer.findDepthKeyInLas(loadedData); // Use helper
                    if (depthKey && loadedData?.data?.[depthKey]) {
                        allDepths.push(...loadedData.data[depthKey].filter(d => d !== null && !isNaN(d)));
                    }
                } else {
                    // Error already logged in the catch block above
                    // UI updated in catch/finally
                }
            });

            // --- Calculate initial Y domain ---
            if(allDepths.length > 0) {
                const calculatedDomain = viewer._calculateFullYDomain(allDepths);
                if (calculatedDomain) {
                    viewer.initialYDomain = [...calculatedDomain];
                    viewer.sharedYDomain = [...calculatedDomain];
                    console.log("Initial Shared Y Domain SET after autoload:", viewer.sharedYDomain);
                }
            } else {
                console.warn("Could not determine initial Y domain from autoloaded files.");
                // Set a default domain? Or leave as null? Leave null for now.
                // viewer.sharedYDomain = [1000, 0]; // Example default
            }

            // --- MODIFICATION: Configure tracks based on provenance ---
            if (successfullyLoadedFiles.length > 0 && window.APP_DATA?.spliceProvenance?.output_curves) {
                console.log("Configuring tracks from splice provenance...");
                viewer.configureTracksFromProvenance(); // Call the new method in viewer.js
            } else {
                console.log("No files loaded successfully or no provenance data - skipping automatic track configuration.");
                 // Update message if no tracks were configured
                 if (Object.keys(viewer.tracks).length === 0) {
                     const plotsMsg = viewer.tracksPlotContainer.querySelector('p.plots-message');
                     if (plotsMsg) plotsMsg.textContent = successfullyLoadedFiles.length > 0 ? 'Files loaded. Add tracks manually.' : 'File loading failed or no files specified.';
                     viewer._updateTracksContainerMessages(); // Also update controls message
                 }
            }
            // --- END MODIFICATION ---

            // Enable Add Track button if any file loaded successfully
             viewer.addTrackBtn.disabled = successfullyLoadedFiles.length === 0;
             viewer._updateTracksContainerMessages(); // Update messages based on final state
             viewer.triggerRedrawAllTracks(); // Ensure redraw happens AFTER configuration

        });
    } else {
         console.log("No files specified for autoloading.");
         const initialMessage = viewer.tracksPlotContainer.querySelector('.plots-message');
         if(initialMessage) initialMessage.textContent = 'No initial files to display. Use "Load Other LAS" to begin.';
         viewer._updateTracksContainerMessages(); // Ensure controls message is also updated
    }

    // --- Function to display splice summary (Keep existing) ---

    // Display Splice Summary Tab Content
    displaySpliceSummary();
    if (!window.APP_DATA.filesToAutoload || window.APP_DATA.filesToAutoload.length === 0) {
        // If the log-plots tab is initially active, ensure its message is correct
        if (document.getElementById('log-plots-content')?.classList.contains('active')) {
             viewer._updateTracksContainerMessages();
        }
     }

});
function displaySpliceSummary() {
    const provenance = window.APP_DATA?.spliceProvenance;
    const container = document.getElementById('splice-summary-content');
    if (!container) return; // Exit if container not found

    // --- MODIFICATION: Update summary display to use new detailed format ---
    if (!provenance || typeof provenance !== 'object' || Object.keys(provenance).length === 0) {
        container.innerHTML = '<p>No splice summary information available for this well.</p>';
        return;
    }

    const inputFiles = provenance.input_files || [];
    // output_curves is now an object { LLD: [origins], NPHI: [origins], ... }
    const outputCurvesMap = provenance.output_curves || {};
    const outputCurveNames = Object.keys(outputCurvesMap);

    let summaryHTML = '<h4>Splice Provenance Details</h4>'; // Changed heading

    if (outputCurveNames.length > 0) {
         summaryHTML += `<h5>Output Curves & Sources:</h5>`;
         summaryHTML += `<ul style="list-style: none; margin-left: 0; padding-left: 0;">`;
         outputCurveNames.forEach(curveName => {
             summaryHTML += `<li style="margin-bottom: 10px;"><strong>${curveName}:</strong>`;
             const origins = outputCurvesMap[curveName];
             if (origins && origins.length > 0) {
                 summaryHTML += `<ul style="list-style: square; margin-left: 20px; font-size: 0.9em;">`;
                 origins.forEach(origin => {
                     summaryHTML += `<li>${origin.curve} (from ${origin.input_file})</li>`;
                 });
                 summaryHTML += `</ul>`;
             } else {
                 summaryHTML += ` <span style="font-style: italic;">(No source curves listed)</span>`;
             }
             summaryHTML += `</li>`;
         });
         summaryHTML += `</ul>`;

    } else {
        summaryHTML += '<p>No output curves listed in provenance.</p>';
    }

     if (inputFiles.length > 0) {
         summaryHTML += `
             <h5 style="margin-top: 15px;">Input LAS Files Processed:</h5>
             <ul style="list-style: disc; margin-left: 20px; font-size: 0.9em;">
                 ${inputFiles.map(file => `<li>${file}</li>`).join('')}
             </ul>
         `;
      } else {
         summaryHTML += '<p style="margin-top: 15px;">No input files listed in provenance.</p>';
      }

      // You can add parameters used if available in provenance
      if (provenance.parameters_used) {
           summaryHTML += `<h5 style="margin-top: 15px;">Splicing Parameters Used:</h5>`;
           summaryHTML += `<pre style="font-size: 0.85em; background-color: #f0f0f0; padding: 5px; border-radius: 3px;">${JSON.stringify(provenance.parameters_used, null, 2)}</pre>`;
      }


    container.innerHTML = summaryHTML;
    // --- END MODIFICATION ---
}
