# AutoSpliceWeb Project Summary

## Project Goal

This project provides a web-based application (`AutoSpliceWeb`) for managing, processing, and splicing well log data stored in LAS format files. The primary goal is to intelligently combine multiple LAS files from the same well, potentially covering different depth intervals or containing different sets of curves, into a single, continuous, spliced LAS file.

## Key Capabilities

1.  **User & Project Management:**
    *   Secure user login/logout system.
    *   Users can create and manage multiple projects.
    *   Project data is isolated per user within the `uploads/` directory.

2.  **Well Log Data Organization:**
    *   Projects are organized by "Wells".
    *   Users can upload multiple LAS files associated with specific wells.
    *   Provides tools to manage wells and individual LAS files (creation, deletion).

3.  **Automated Pre-processing & Selection:**
    *   Identifies and potentially removes corrupt LAS files.
    *   Detects and removes files that are depth subsets of other files within the same well.
    *   Analyzes curve availability across files using mnemonic definitions (`data/mnemonics_revised.txt`) and categorization (`utils/categorize_v2.py`).
    *   Groups files into "suits" based on curve sets suitable for splicing (`utils/SelectionLasFunctions.py::suitify`).
    *   Provides an initial auto-selection of files recommended for splicing.

4.  **User Review & Confirmation:**
    *   Presents the auto-selected files and their attributes (depth range, curves) to the user for review.
    *   Allows users to modify the selection before initiating the splicing process.

5.  **Configurable Splicing Algorithm (`utils/SuitSplice/`):**
    *   **Horizontal Merging (`LateralLas`):** Combines data from files within the *same suit* (similar curve sets, potentially overlapping depth). Applies filters (histogram-based outlier removal, handling of constant value stretches).
    *   **Vertical Merging (`VerticalLas`):** Takes the results from different suits (processed by `LateralLas`) and merges them vertically based on depth. Handles resampling to a common depth interval and intelligently combines overlapping data segments.
    *   **Parameter Control:** Splicing behavior (e.g., filtering parameters, export sampling interval) is controlled via `data/autosplice_params.json`.

6.  **Background Processing & Progress:**
    *   The potentially time-consuming splicing process runs in a background thread.
    *   Uses Server-Sent Events (SSE) to provide real-time status updates to the user interface.

7.  **Detailed Provenance Tracking:**
    *   For each generated spliced file (`*_spliced.las`), a corresponding metadata file (`*_spliced.meta.json`) is created.
    *   This metadata tracks:
        *   The specific input LAS files used.
        *   The parameters used during splicing.
        *   A detailed mapping showing which input file and original curve contributed to each segment of every curve in the final spliced output.

8.  **Web-Based Log Viewer:**
    *   Integrates a dedicated LAS log viewer (`static/well_log_viewer/`).
    *   Allows users to visualize both the original source LAS files and the final spliced output files.
    *   Automatically loads the relevant spliced file and its source files (identified via provenance) when viewing a processed well.
    *   Provides tools to load other LAS files from the project into the viewer.

## Project Structure

```
AutoSpliceWeb/
├── .gitignore
├── app.py                 # Main Flask application: routes, core logic orchestration
├── users.txt              # (Likely intended for data/, stores user credentials)
├── data/                  # Configuration and data files
│   ├── autosplice_params.json # Splicing algorithm parameters
│   ├── mnemonics_revised.txt  # Mnemonic definitions for categorization
│   ├── lwd_wireline_differentiators.txt # (Likely for future LWD/Wireline distinction)
│   └── users.txt          # User credentials (email:hashed_password)
├── static/                # Frontend assets (CSS, JS, Images)
│   ├── drake.png
│   ├── css/               # Stylesheets for different pages
│   │   ├── autosplice_results.css
│   │   ├── styles.css
│   │   └── well_selections.css
│   ├── js/                # Frontend JavaScript logic
│   │   ├── auto_splice_manager.js # Handles SSE updates and process flow
│   │   ├── autosplice_settings.js # Manages splicing parameter settings UI
│   │   ├── projects.js      # Project/Well management UI logic
│   │   ├── viewer_controller.js # Controls interaction with the log viewer
│   │   └── well_selection.js  # Handles well/file selection and processing initiation
│   └── well_log_viewer/   # Dedicated LAS Log Viewer component
│       ├── css/style.css
│       └── js/
│           ├── las_utils.js # LAS parsing/handling for the viewer
│           ├── plotter.js   # Plotting logic for log curves
│           └── viewer.js    # Main viewer control logic
├── templates/             # HTML templates (Jinja2) for web pages
│   ├── autosplice_results.html # (Potentially unused/legacy)
│   ├── display_categorized_data.html # Page for reviewing auto-selected files
│   ├── import_las.html    # (Likely part of well_selection or projects UI)
│   ├── index.html         # (Likely redirects or basic landing)
│   ├── log_viewer.html    # The main LAS log viewer page
│   ├── login.html         # User login page
│   ├── processed_data.html # (Potentially unused/legacy)
│   ├── projects.html      # User's project listing page
│   ├── upload.html        # (Likely part of well_selection or projects UI)
│   └── well_selection.html # Project dashboard: shows wells, files, initiates processing
├── uploads/               # Root directory for user data storage
│                          # (Structure: uploads/<user_email_prefix>/<project_name>/<well_name>/source.las)
│                          # (Spliced files: uploads/<user_email_prefix>/<project_name>/<well_name>_spliced.las)
│                          # (Metadata: uploads/<user_email_prefix>/<project_name>/<well_name>_spliced.meta.json)
└── utils/                 # Backend Python helper modules
    ├── categorize_v2.py   # Log curve categorization logic
    ├── categorize.py      # (Older version?)
    ├── correlationNsplice.py # (Likely contains LAS export and potentially correlation helpers)
    ├── file_handling.py   # File upload validation/saving helpers
    ├── folder_structure.py # Helpers for getting project/well structure
    ├── helper.py          # General utility functions
    ├── las_utils.py       # Utilities for working with lasio objects
    ├── LasTree.py         # (Likely related to parsing/representing LAS structure)
    ├── loggy_settings.py  # (Likely contains paths to data files like mnemonicsfile)
    ├── projects.py        # (Potentially backend logic related to project actions)
    ├── SelectionLasFunctions.py # Core logic for file filtering (removeCorrupt, removeSubsets, suitify)
    ├── WellsParent.py     # Class for interacting with well/LAS file structure
    └── SuitSplice/        # Core Splicing Algorithm Implementation
        ├── correlationNsplice.py # (Duplicate? Or specific splicing helpers?)
        ├── Filters.py       # Histogram filter implementation
        ├── flex.py          # FlexLogCurves class (manages combined XY data)
        ├── LateralCorr.py   # (Potentially for lateral correlation - future feature?)
        ├── manage_data_gaps.py # Helpers for handling data gaps during merging
        └── SuitSplice.py    # Main splicing classes (SuitSplice, VerticalLas, LateralLas)

```

## Workflow Diagram (Mermaid)

```mermaid
flowchart TD
    A[User Logs In] --> B(View Projects Page);
    B --> C{Select or Create Project};
    C -- Select Existing --> D[Project Dashboard];
    C -- Create New --> E[Enter Project Name];
    E --> D;

    D --> F{Manage Wells/Files};
    F -- Create Well --> G[Enter Well Name];
    G --> D;
    F -- Upload LAS Files --> H[Select Well & Files];
    H --> D;
    F -- Select Wells for Processing --> I[Select Wells];

    I --> J(Process Selected Wells Button);
    J --> K[Backend: Auto-Select Files];
    K --> L[Backend: Store Selections & Attributes in Session];
    L --> M(Display Review Page);

    M --> N{User Reviews/Modifies Selection};
    N -- Confirm Selection --> O(Start Splicing Button);
    O --> P[Backend: Start Background Splicing Thread];
    P --> Q(SSE: Send Progress Updates);
    P --> R[Backend: Perform Splicing];
    R --> S[Backend: Save Spliced LAS & Provenance];
    S --> T(SSE: Send Completion Update);

    T --> D;
    Q --> M; # Updates displayed on review/processing page

    D -- View Spliced Log --> U[Select Processed Well];
    U --> V(Display Log Viewer Page);
    V --> W[Viewer: Autoload Spliced & Source Files];
    V --> X{User Interacts with Viewer};
    X -- Load Other Files --> Y[Select LAS from Project];
    Y --> X;

    style K fill:#f9f,stroke:#333,stroke-width:2px
    style L fill:#f9f,stroke:#333,stroke-width:2px
    style P fill:#f9f,stroke:#333,stroke-width:2px
    style R fill:#f9f,stroke:#333,stroke-width:2px
    style S fill:#f9f,stroke:#333,stroke-width:2px
    style Q fill:#ccf,stroke:#333,stroke-width:1px
    style T fill:#ccf,stroke:#333,stroke-width:1px
    style W fill:#ccf,stroke:#333,stroke-width:1px
