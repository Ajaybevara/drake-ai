# Simplified Auto Log Splicer Workflow

1. Login
2. Upload multiple LAS files from the same well
3. The app validates each LAS file
4. The app shows a summary of depth ranges, curves, and row counts
5. The app plots each uploaded LAS file before merging
6. The app sorts valid files by depth range
7. The app merges/splices the files into one final LAS
8. The app plots the merged LAS with dashed divider lines at source file interval starts
9. The user downloads AutoSpliced_Output.las

## What log splicing means here

Log splicing means combining different LAS intervals or runs from the same well into one continuous LAS output. It does not mean splitting the LAS into pieces. In the final merged visualization, dashed horizontal lines are shown only to mark where each source LAS interval starts.

## Output depth step

The app uses a fixed default output depth step of 0.1524. The user does not need to enter this value. It controls the spacing between depth rows in the final output LAS.
