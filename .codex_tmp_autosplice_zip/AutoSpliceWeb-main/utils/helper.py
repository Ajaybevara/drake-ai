# import matplotlib.pyplot as plt
import numpy as np
def str_array2floats(strarray):
    floats=[]
    for s in strarray:
        try:
            # print(float(s))
            floats.append(float(s))
        except:
            floats.append(s)
    # print(floats)
    return np.array(floats)
def find_keyIndxWithStr(log,string):
    found=False
    indx=-999
    for i,key in enumerate(log.keys()):
        if string in key:
            found=True
            indx=i
            break
    
    return found,indx
def find_depth_indx(log):
    found,indx=find_keyIndxWithStr(log,'DEPT')
    if not found:
        found,indx=find_keyIndxWithStr(log,'TVD')
    if not found:
        print('Depth collumn not found with existing tokens. Refine token in find_depth_indx function...')
    return indx

# log=las[0]
def find_prop_indexes(log):
    propindxs=[]
    for i,key in enumerate(log.keys()):
        if (key not in ['TIME', 'DATE']) & ('DEPT' not in key):
#             print(log.curves[i].data)
            propindxs.append(i)
    return np.array(propindxs)


def get_allcols(log):
    lindx2bplotted=find_prop_indexes(log)
    allcols=log.keys()
    allcols=np.array(allcols)
    allcols=allcols[lindx2bplotted]
    ncols=len(allcols)
    n4divcols=4*int(ncols/4)
    excesscols=allcols[n4divcols:]
    allcols=allcols[:n4divcols]
    allcols.shape=(4,n4divcols/4)
    allcols=list(allcols)
    for i,e in enumerate(excesscols):
        allcols[i]=np.append(allcols[i],e)
    return allcols



def segregate_files(files,filetypes):
    # initiate  type_wise_files       
    type_wise_files={}
    for ft in filetypes:
        type_wise_files[ft]=[]
    type_wise_files['others']=[]
    # separate according to filetypes
    for tf in files:
        entered=False
        for key in filetypes:
            for ft in filetypes[key]:
                if ft in tf:
                    type_wise_files[key].append(tf)
                    entered=True
                    break
            if entered: break
        if not entered:
            type_wise_files['others'].append(tf)
            print('File type not found for the file ',tf,' so putting in others')
    return type_wise_files
def get_descr(label,las):
    for l in las:
        try:
            return l.curves[label]['descr']
        except:
            pass

def create_indices_for_appending(base_depths, new_depths):
    """
    Creates a boolean mask for new_depths indicating which entries fall
    outside the min/max range of base_depths.

    Args:
        base_depths (np.ndarray): 1D array of existing depths.
        new_depths (np.ndarray): 1D array of new depths to potentially append.

    Returns:
        np.ndarray: Boolean mask, True for depths in new_depths outside the base_depths range.
    """
    if base_depths is None or base_depths.size == 0 or np.all(np.isnan(base_depths)):
        # If base is empty, all new depths are considered for appending
        return np.ones_like(new_depths, dtype=bool)
    
    if new_depths is None or new_depths.size == 0:
        return np.zeros_like(new_depths, dtype=bool) # Should be empty array, but handle for safety

    # Calculate min/max, ignoring NaNs
    try:
        min_base_depth = np.nanmin(base_depths)
        max_base_depth = np.nanmax(base_depths)
    except ValueError: # Handles case where base_depths contains only NaNs after check above
        return np.ones_like(new_depths, dtype=bool)


    # Create mask for depths outside the base range
    # Ignore NaNs in new_depths comparison as well
    mask = np.logical_or(new_depths < min_base_depth, new_depths > max_base_depth)
    
    # Ensure NaNs in new_depths are not selected by the mask
    mask[np.isnan(new_depths)] = False 
    
    return mask

def merge_arrays(base_array, new_array, mask):
    """
    Merges a base array with selected rows from a new array based on a mask,
    then sorts the result by the first column (depth).

    Args:
        base_array (np.ndarray): The existing data array (N, M).
        new_array (np.ndarray): The new data array potentially containing data to append (P, M).
        mask (np.ndarray): Boolean mask for new_array (P,), True indicates rows to append.

    Returns:
        np.ndarray: The merged and sorted array.
    """
    if mask is None or not np.any(mask):
        # If mask is empty or all False, just return the base array (or sort it if needed)
        if base_array is not None and base_array.size > 0:
            # Ensure base array is sorted if it wasn't already
            sort_indices = np.argsort(base_array[:, 0])
            return base_array[sort_indices]
        else:
            return base_array if base_array is not None else np.array([[]]) # Return empty if base is None

    # Select rows from new_array using the mask
    rows_to_append = new_array[mask]

    # Handle cases where one of the arrays is empty/None
    if base_array is None or base_array.size == 0:
        if rows_to_append.size > 0:
            sort_indices = np.argsort(rows_to_append[:, 0])
            return rows_to_append[sort_indices]
        else:
            return np.array([[]]) # Return empty if both are empty
            
    if rows_to_append.size == 0:
         # Only base_array has data, ensure it's sorted
         sort_indices = np.argsort(base_array[:, 0])
         return base_array[sort_indices]

    # Fix column count mismatch by padding arrays with NaN columns
    if base_array.shape[1] != rows_to_append.shape[1]:
        print(f"Fixing column mismatch. Base: {base_array.shape}, Append: {rows_to_append.shape}")
        
        # Get the max number of columns
        max_cols = max(base_array.shape[1], rows_to_append.shape[1])
        
        # Pad base_array if needed
        if base_array.shape[1] < max_cols:
            padding = np.full((base_array.shape[0], max_cols - base_array.shape[1]), np.nan)
            base_array = np.hstack((base_array, padding))
            
        # Pad rows_to_append if needed
        if rows_to_append.shape[1] < max_cols:
            padding = np.full((rows_to_append.shape[0], max_cols - rows_to_append.shape[1]), np.nan)
            rows_to_append = np.hstack((rows_to_append, padding))
    
    # Combine the base array and the selected rows
    combined_array = np.vstack((base_array, rows_to_append))

    # Sort the combined array by the first column (depth)
    # Handle potential NaNs in depth during sort - NaNs are typically pushed to the end
    sort_indices = np.argsort(combined_array[:, 0])
    
    return combined_array[sort_indices]