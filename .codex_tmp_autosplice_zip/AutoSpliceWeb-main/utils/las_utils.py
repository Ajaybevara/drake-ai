# las_utils.py
import lasio
try:
    import pandas as pd
except ImportError:  # pandas is optional for lightweight LAS parsing paths
    pd = None
import numpy as np

def read_las_to_dataframe(las_path):
    """Read LAS curve data.

    Prefer returning a pandas DataFrame when pandas is installed, but do not make
    dashboard/preview routes fail just because pandas is missing.  The fallback
    returns a simple dict of numpy arrays keyed by curve mnemonic.
    """
    las = lasio.read(las_path, ignore_header_errors=True)
    if pd is not None:
        return las.df()
    return {curve.mnemonic: np.asarray(curve.data) for curve in getattr(las, 'curves', [])}
def get_txtdict(file,delimiter=','):
    with open(file,'r') as f:
        lines=f.readlines()
        file_dict={}
        for l in lines:
            [key,val]=l.split('=')
            file_dict[key.strip()]=[v.strip() for v in val.split(delimiter)]
    return file_dict
def write_txtdict(file,text_dict,delimiter=','):
    with open(file,'w') as f:
        for key in text_dict:
            line="{} = {} \n".format(key,delimiter.join(text_dict[key]).strip())
            f.writelines(line)

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