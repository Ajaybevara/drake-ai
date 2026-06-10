# from PyQt5.QtGui import *
# from PyQt5.QtCore import *
# from PyQt5.QtWidgets import *
import sys
# from utils.LasTree import treeWidgetFrmDict,get_txtdict,write_txtdict

import lasio
from utils.loggy_settings import lwdVSwirelineFile, mnemonicsfile    
import numpy as np
from utils.helper import *

def get_txtdict(file,delimiter=','):
    with open(file,'r') as f:
        lines=f.readlines()
        file_dict={}
        for l in lines:
            [key,val]=l.split('=')
            file_dict[key.strip()]=[v.strip() for v in val.split(delimiter)]
    return file_dict
class LogCategorize():
    def __init__(self,mnemonicsfile):
          
        self.mnemonicsfile=mnemonicsfile
        self.base_categories=get_txtdict(self.mnemonicsfile,delimiter=' ')
    def set_las(self,las ):
        self.las=las
    def isResistivityCurve(self,log_cate):
        if(log_cate in ['LLD','LLS','MSFL']):
            return True
        else:
            return False 
    def get_catePresent(self):
        cate_present=[]
        for key in self.treeview_dict:
            if (len(self.treeview_dict[key])>0)&(key!='NA'):
                cate_present.append(key)

        return cate_present
    def get_category(self,log_mnemo,cat_dict):
        #     filewords=multi_split(file_str,delims=['_','-','.'])
            for key in cat_dict:
                if log_mnemo in cat_dict[key]:
                    return key
            return 'NA'
    def getLogsPresent(self):
        logs=[]
        for key in self.treeview_dict:
            if (len(self.treeview_dict[key])>0)&(key!='NA'):
                logs.append(self.treeview_dict[key][0])

        return logs
    def get_lasdepthrange(self):
        # dindx=find_depth_indx(self.las)
        return (self.las.well['STRT']['value'],self.las.well['STOP']['value'])
        # return (self.las[dindx][0],self.las[dindx][-1])
    def get_curverange(self,key):
        dindx=find_depth_indx(self.las)
        data_indxs=~np.isnan(self.las[key])
        return (self.las[dindx][data_indxs][0],self.las[dindx][data_indxs][-1])
    def lasCategorize(self): 
        type_dict=get_txtdict(self.mnemonicsfile,delimiter=' ')
        las_r_log_groups=list(self.las.keys())
        self.treeview_dict={}            
        for k in type_dict.keys(): self.treeview_dict[k]=[] 
        self.treeview_dict['NA']=[]
        for key in las_r_log_groups:
            found=False
            key1=key.split(':')[0]
            for k in type_dict.keys():                 
                if key1 in type_dict[k]:
                    self.treeview_dict[k].append(key)
                    found=True
                    break
            if not found:
               self.treeview_dict['NA'].append(key)

def main():
    # treeview_dict={'Log': {'GR': ['GR_ARC'], 'RHOB': ['RHOB', 'ROBB'], 'NPHI': ['TNPH'], 'NA': ['DEPT', 'ROP5_RM', 'A16H', 'A22H', 'A28H', 'A34H', 'A40H', 'P16H', 'P22H', 'P28H', 'P34H', 'P40H', 'A16L', 'A22L', 'A28L', 'A34L', 'A40L', 'P16L', 'P22L', 'P28L', 'P34L', 'P40L', 'ECD_ARC', 'APRS_ARC', 'ATMP', 'DRHO', 'DRHB', 'DCHO', 'DCVE', 'DCAV', 'VERD', 'HORD']}}
    # mnemonicsfile=r'D:\Ameyem Office\Projects\Cairn/mnemonics.txt'

    # app = QApplication(sys.argv)
    # main = Categorize()
    # main.set_params(treeview_dict,mnemonicsfile)
    # main.show()
    # sys.exit(app.exec_())

    well_folder=r'C:\Users\ArunBabu\OneDrive\KalpraTech\Drake\TestData\cairn\W1\LAS\\'

    files_w_path=well_folder+'W1_SUITE2_COMPOSITE.las'

    las=lasio.read(files_w_path)

    lc=LogCategorize(mnemonicsfile)
    lc.set_las(las)
    lc.lasCategorize()
    print(lc.treeview_dict)
    print(lc.get_catePresent())
    print( lc.get_lasdepthrange())
    print( lc.get_curverange('CAL'))
    lcates=lc.get_catePresent()
    for l in lcates:
        for key in lc.treeview_dict[l]:
            print('{}: {}'.format(key, lc.get_curverange(key)))
if __name__ == '__main__':
    main()