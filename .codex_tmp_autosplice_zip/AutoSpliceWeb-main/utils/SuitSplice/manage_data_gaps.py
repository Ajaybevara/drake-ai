# utils/SuitSplice/manage_data_gaps.py

import numpy as np
class ZonalArray():
    def __init__(self,myarray):
        super(ZonalArray, self).__init__()
        self.dataarray=myarray
    def find_typezones(self,isnans):
        c=list(map(tuple, (isnans)))
        cdiff=np.diff(c[0])
        locsofchange=np.where(cdiff>1)
        nanranges=[]
        nanstarts=[isnans[0][0]]
        nanends=[]
        for li in locsofchange[0]:
            nanstarts.append(isnans[0][li+1])
            nanends.append(isnans[0][li])
        nanends.append( isnans[0][-1])  
        return list(zip(nanstarts,nanends))
    def nanzones(self,max_data_width=10):
        isnans=np.where(np.isnan(self.dataarray))
#         return self.find_typezones(isnans)
        zones=self.find_typezones(isnans)
#         np.where()
        return zones[np.diff(zones)>max_data_width]
    def merge_zones(self,zones,allowed_width=10):
        new_zones=[]
        tempzone=[zones[0][0]]
        for i in range(1,len(zones)):
#             print(zones[i][0]-zones[i-1][1])
            if(zones[i][0]-zones[i-1][1])>allowed_width:
                tempzone.append(zones[i-1][1])
                new_zones.append(tempzone)
                tempzone=[zones[i][0]]
        tempzone.append(zones[-1][1])
        new_zones.append(tempzone)
            
        return new_zones
            
    def datazones(self,min_data_gap_allowed=20):
        isdatas=np.where(~np.isnan(self.dataarray))
        if len(isdatas[0])<=min_data_gap_allowed:
            return np.array([])
        zones=np.array(self.find_typezones(isdatas))
#         return zones
        return  self.merge_zones(zones,allowed_width=min_data_gap_allowed)
#         return zones[(np.diff(zones)>max_data_width).ravel()]
    def makeequalsNan(self,equal_val_allowed_width=4):
        zeroindxs=np.where(np.diff(self.dataarray)==0)
        serious_eq_zones=[]
        if len(zeroindxs[0])<=equal_val_allowed_width:
            return self.dataarray
        for cz in self.find_typezones(zeroindxs):
            if cz[1]+2-cz[0]>equal_val_allowed_width:
                serious_eq_zones.append((cz[0],cz[1]+2))
        for sz in serious_eq_zones:
            self.dataarray[sz[0]:sz[1]]=np.nan
        return self.dataarray
    
def find_datazone_in_bottomrun(topXYzones, topXYbflexzones): # finds new data zones from botXYzones
    bz_zones_being_new_status=[]
    for bz in topXYbflexzones:
        isdzoneexist=True
        for tz in topXYzones:
            if (bz[1]<tz[1])&(bz[0]>tz[0]):
                isdzoneexist=False
        bz_zones_being_new_status.append(isdzoneexist)
#     print(np.where(bz_zones_being_new_status)[0])
    return np.array(topXYbflexzones)[bz_zones_being_new_status]    
# zones2bupdated=find_datazone_in_bottomrun(tx.datazones(), tx_w_bx.datazones())                
def updateTopXY(topArray,topArray_w_bflex,min_data_gap_allowed=20,retain='top'): #both array must be of same depth, same datalentgh
    tx=ZonalArray(topArray)
    tx_w_bx=ZonalArray(topArray_w_bflex)
    topXYzones,topXYbflexzones=tx.datazones(min_data_gap_allowed=min_data_gap_allowed), tx_w_bx.datazones(min_data_gap_allowed=min_data_gap_allowed)
    zones2bupdated=find_datazone_in_bottomrun(topXYzones,topXYbflexzones)
    clipzones=[]
    if len(topXYzones)<1:
        clipzones=zones2bupdated
    else:
        for bz in zones2bupdated: #made to retain top  
            for  tz in topXYzones:
                found=False
                if (bz[1]>tz[1])&(bz[0]<=tz[1]):
                    clipzone2bupdated=[tz[1],bz[1]]
                    found=True
                    break
                elif (bz[0]<tz[0])&(bz[1]<=tz[1]):
                    clipzone2bupdated=[bz[0],tz[0]]
                    found=True
                    break
            if not found:
                clipzone2bupdated =bz
            clipzones.append(clipzone2bupdated)
    for cz in clipzones:
        print('         Data between indexes {}-{} is modified from other data array'.format(*cz))
        topArray[cz[0]:cz[1]]=topArray_w_bflex[cz[0]:cz[1]]
    return topArray   