# utils/WellsParent.py 
import os
import lasio
import numpy as np
from utils.categorize_v2 import LogCategorize

class WellsParent():
    def __init__(self,parent_path):
        self.parent_path=parent_path
        # print(f"parent_path: {parent_path} {os.listdir(self.parent_path)}")
        self.well_folders=[]

        self.wfiles = {}
        for filename in os.listdir(self.parent_path): 
            # print('self.parent_path+filename',self.parent_path+filename)
            if os.path.isdir(os.path.join(self.parent_path,filename)):
                
                self.well_folders.append(filename)
                # print(f"filename: {filename}")
        
    def getWellLas(self,extensions=['.las','dlis','.lis']):
        self.wfiles={}
        for wname in self.well_folders:
            print(f"wname: {wname}")
            self.wfiles[wname]={}
            for root,folder,files in os.walk(self.parent_path+wname):
                for file in files:            
                    if len(file)>4:
                        if file[-4:].lower() in extensions:
                            if (file[-4:].lower()=='dlis'):
                                if file[-5:].lower() =='.dlis':
                                    self.wfiles[wname][file]= os.path.join(root,file)
                            else:
                                self.wfiles[wname][file]=os.path.join(root,file)
        return self.wfiles

    def LookgetWellLas(self, extensions=['.las', '.dlis']):
        for wname in self.well_folders:
            self.wfiles[wname] = {}
            # Walk through each directory in the well folder
            for root, _, files in os.walk(os.path.join(self.parent_path, wname)):
                # No need to check for specific 'las' subfolder anymore
                for file in files:
                    file_ext = os.path.splitext(file)[1].lower()
                    if file_ext in extensions:
                        # Directly add files with the correct extension
                        self.wfiles[wname][file] = os.path.join(root, file)
        return self.wfiles
    
    def LookgetWellLas2(self,extensions=['.las']):
        self.wfiles={}
        for wname in self.well_folders:
            self.wfiles[wname]={}
            for root,folder,files in os.walk(self.parent_path+wname):
                # print(root)
                # for fld in folder:
                rootfolders=root.split('\\')
                # rootfolders=root.split('\\')
                print(rootfolders)
                # print(wname)
                if (rootfolders[-1].lower()=='las'):
                    print('Files.............................................')
                    # print(root)
                    for file in files:  
                        print(file)          
                        if len(file)>4:
                            if file[-4:].lower() in extensions:
                                if (file[-4:].lower()=='dlis'):
                                    if file[-5:].lower() =='.dlis':
                                        self.wfiles[wname][file]= os.path.join(root,file)
                                else:
                                    self.wfiles[wname][file]=os.path.join(root,file)
        return self.wfiles
    def limitwitMinNfiles(self,nfiles):
        newwfiles={}
        if self.wfiles:
            for key in self.wfiles:
                if len(self.wfiles[key])>=nfiles:
                    newwfiles[key]= self.wfiles[key]
            self.wfiles=newwfiles
            return self.wfiles
        else:
            self.getWellLas(extensions=['.las','dlis','.lis'])
            self.limitwitMinNfiles(nfiles)

    def get_wells_withfiles(self):
        wnames=[]
        fnames=[]
        fpaths=[]
        for wf in self.wfiles:
            wnames.append(wf['wellname'])
            fnames.append(wf['file'])
            fpaths.append(wf['parent_path'])
        wnames=np.array(wnames)
        uwellnames=np.unique(wnames)
        print(uwellnames)
        fnames=np.array(fnames)
        for uwn in uwellnames:
            print(fnames[np.where(wnames==uwn)[0]])

def isitWireline(file_path):
    if(file_path[-4:].lower()=='.las'):
        try:
            las=lasio.read(file_path,ignore_data=True)
            if 'OPMD' in las.header['Parameter'].keys():
                if las.header['Parameter']['OPMD']['value']=='OH.WIRE':
                    return 1
            else:
                return 0
        except:
            print('Unable to read las file.....')
            return 2
    else:
        print(file_path.split('\\')[-1],' is not a las file')
        return 3
def count_filetypes(files):
    lascount=dliscount=liscount=0
    for f in files:

        if f[-4:].lower()=='.las':
            lascount +=1
        elif f[-4:].lower()=='dlis':
            dliscount +=1
        else :
            liscount +=1
    
    return lascount,dliscount,liscount

def getCategDepthrange(lc,file_w_path):
    las=lasio.read(file_w_path,ignore_data=True)    
    lc.set_las(las)
    lc.lasCategorize()
    return lc.get_catePresent(),lc.get_lasdepthrange()
def getLasAttr4wells(well_las_dict,mnemonicsfile):
    well_las_attr_dict={}
    lc=LogCategorize(mnemonicsfile)
    print('Getting attributes for well: ')
    for well in well_las_dict:        
        well_las_attr_dict[well]={}
        for lf in well_las_dict[well]:
            well_las_attr_dict[well][lf]={}
            a,b=[],(0,0)
            try:
                a,b=getCategDepthrange(lc,well_las_dict[well][lf])
                # print(a,b)
            except:
                print('unable to pasrse ', well)
            well_las_attr_dict[well][lf]['categories']=a
            well_las_attr_dict[well][lf]['depthrange']=b
            well_las_attr_dict[well][lf]['path']=well_las_dict[well][lf]
    return well_las_attr_dict
if __name__=='__main__':
    # # well_folders_parent_path='I:\\10. Database\\WELL\\Well Data\\Well_Data\\'
    # well_folders_parent_path='\\172.16.165.171\Team_DM\OALP\5829_WELLDATA\\'
    # # upaths_level_wise[5]
    from loggy_settings import cairn_folder
    




