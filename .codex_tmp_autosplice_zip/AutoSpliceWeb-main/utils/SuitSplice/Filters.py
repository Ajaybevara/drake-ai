import numpy as np
def get_indx_of_cont_patches(a):
    arr=np.multiply(a[0]!=0,a[1][1:])
    lenarr=arr.__len__()
    indx_of_cont_patch_ends=[]
    lend=0
    rend=0
    prev_val=0
    for i in range(1,lenarr):

        if (arr[i]!=0) & (arr[i-1]==0 ):
    #         indx_of_cont_patch_ends.append  ([lend,rend])
            lend=i

        elif (arr[i]==0) & (arr[i-1]!=0) :
            rend=i-1
            indx_of_cont_patch_ends.append  ([lend,rend])
        elif (arr[i]!=0) & (arr[i-1]!=0) & (i==lenarr-1) :
            rend=i
            indx_of_cont_patch_ends.append  ([lend,rend])

    return indx_of_cont_patch_ends   
def get_vals_of_cont_patches(a):
#     
    vals_of_cont_patch_ends=[]
    for lrindx in get_indx_of_cont_patches(a):
         vals_of_cont_patch_ends.append(a[1][lrindx])
    return np.array(vals_of_cont_patch_ends )
def clip_array_nans(arr,clipranges):
    arr[arr<=clipranges[0]]=np.nan
    arr[arr>=clipranges[1]]=np.nan
    return arr
def hist_filter(arr,n_big_patches=2,hist_bins=100):
    if n_big_patches<1:
        n_big_patches=0
    a=np.histogram(arr[~np.isnan(arr)],hist_bins)
    hist_step=a[1][1]-a[1][0]
    vals_of_cont_patch_ends=get_vals_of_cont_patches(a)
    patch_sort_indxs=np.argsort(np.diff(vals_of_cont_patch_ends).ravel())
    distnct_ranges=vals_of_cont_patch_ends[patch_sort_indxs[-n_big_patches:]].ravel()
    clipranges=distnct_ranges.min(),distnct_ranges.max()
    # print('vals_of_cont_patch_ends',vals_of_cont_patch_ends)
    # print(clipranges)
#     clipranges=vals_of_cont_patch_ends[order][0]-hist_step/2,vals_of_cont_patch_ends[-order][1]+hist_step/2
    return clip_array_nans(arr,clipranges)