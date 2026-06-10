# utils/SelectionLasFunctions.py 
import numpy as np
def print_logs(awell):
    for l in awell:
        try:
            print('{:15} ({:4.1f}-{:4.1f}) - {:20}'.format(l,min(awell[l]['depthrange']),max(awell[l]['depthrange']), ', '.join(awell[l]['categories'])))
        except:
            pass
def printSuits(suits):
    for i in suits:
        print('Suit ',i)
        for l in suits[i]:
#             print('     ',l,suits[i][l]['depthrange'],', '.join(suits[i][l]['categories']))
            print('     ',l,': ({:4.1f}-{:4.1f}) - {:20}'.format(min(suits[i][l]['depthrange']),
                                     max(suits[i][l]['depthrange']),', '.join(suits[i][l]['categories'])))

def sort_ranges(awell):
#     minranges=np.array([min(awell[l]['depthrange']) for l in awell])
#     maxranges=np.array([max(awell[l]['depthrange']) for l in awell])
    
    darray=np.array([(min(awell[l]['depthrange']),max(awell[l]['depthrange'])) for l in awell])
    # print('8888888888888888888888888888888888888888888888888')
    # print(awell)
    # for l in awell:
        # print(awell[l]['depthrange'])
    minmaxs=min(darray[:,0]),max(darray[:,1])
    logs=np.array(list(awell.keys()))
    sort_indx=np.argsort(darray[:,0])
    # sort_indx=sort_indx[::-1]
    sorted_well={}
    for l in logs[sort_indx]:
        sorted_well[l]=awell[l]
    return sorted_well,minmaxs,darray[sort_indx]

def get_rangearray(awell):
    return np.array([(min(awell[l]['depthrange']),max(awell[l]['depthrange'])) for l in awell])

# plt.hist(minranges,20)
# maxranges-minranges,minmax
# rangelength=100

def getLfileWIndex(awell,indexes):
    resultwell={}
    for fkey in np.array(list(awell.keys()))[indexes]:
        resultwell[fkey]=awell[fkey]
    return resultwell
def getLoglist(awell):
    logs=[]
    for l in awell:
        logs.extend(awell[l]['categories'])
    return np.unique(logs)

def getExclusivekeys(key,varkeys,awell):
    if key in awell.keys():
        alset=Logset({key:awell[key]})
        for vk in varkeys:            
            if alset.isSubset({vk:awell[vk]}):
                del awell[vk] 
        varkeys=list(awell.keys())
    return varkeys,awell
def removeSubsets(awell):       
    keys=list(awell.keys())
    varkeys=keys.copy()    
    for key in keys:
        varkeys,awell=getExclusivekeys(key,varkeys,awell)
#     print(varkeys)
    finalkeys=varkeys.copy()
#     print('final keys: ',len(finalkeys))
    for key in varkeys[::-1]:
        finalkeys,awell=getExclusivekeys(key,finalkeys,awell)
#     print('final keys: ',len(finalkeys))
    return awell

def global_logavailability(global_loglist,alas):
    if len(global_loglist)==0:
        return 0,[]
    lcount=0
    not_inGlobal=[]
    for log in global_loglist:
        if log in alas['categories']:
            lcount +=1
        else:
            not_inGlobal.append(log)
    return lcount/len(global_loglist),not_inGlobal

def similarityIndex(alas,blas):
    lcount=0
    for log in alas['categories']:
        if log in blas['categories']:
            lcount +=1
    return lcount/len(alas['categories'])
# def getValidloginRun(partwell,list_availability,list_missed_logs):
#     local_indx=np.argsort(np.array(list_availability))
#     local_indx=local_indx[::-1]
#     sorted_la=list_availability[local_indx]
#     usorted_la=np.unique(sorted_la)
# #     print('usorted la: ',usorted_la)
#     lookindex=[]
#     for i in range(0,len(sorted_la)):
#         if sorted_la[i]==usorted_la[-1]:
#             lookindex.append(i)
# #     print('indexes found: ',lookindex)
#     lookwell=getLfileWIndex(partwell,local_indx[lookindex])
#     look_missed_logs=list_missed_logs[local_indx[lookindex]]
#     validLFindx=np.argmax(np.diff(get_rangearray(lookwell)))
#     return getLfileWIndex(lookwell,[validLFindx]),look_missed_logs[validLFindx]
def getValidloginRun(partwell, list_availability, list_missed_logs):
    local_indx = np.argsort(list_availability)[::-1]  # Assuming this works as intended
    sorted_la = list_availability[local_indx]
    usorted_la = np.unique(sorted_la)
    
    lookindex = []
    for i in range(len(sorted_la)):
        if sorted_la[i] == usorted_la[-1]:
            lookindex.append(i)
    
    lookwell = getLfileWIndex(partwell, local_indx[lookindex])
    # Directly index list_missed_logs with lookindex since it's not a NumPy array now
    look_missed_logs = [list_missed_logs[i] for i in lookindex]
    
    validLFindx = np.argmax(np.diff(get_rangearray(lookwell)))
    validwell, valid_missed_logs = getLfileWIndex(lookwell, [validLFindx]), look_missed_logs[validLFindx]

    return validwell, valid_missed_logs



 
def removeCorruptlas(awell):
    rewell={}
    for l in awell:
        try:
            if (np.diff(awell[l]['depthrange'])!=0)&(len(awell[l]['categories'])!=0)&(~np.isnan(awell[l]['depthrange'][0])):
                rewell[l]=awell[l]
        except:
            pass
    return rewell
def get_closeValuesIndx(value,val_array,rangelength):
    indexes=[]
    for i,v in enumerate(val_array):
        if (v<=value+rangelength)&(v>=value-rangelength):
            indexes.append(i)
    return indexes
def getIndxGroups(valuearray,rangelength=200):
    temparray=valuearray
    indxarray=np.arange(0,len(valuearray))
#     print(temparray,indxarray)
    indxgroups=[]
    v=temparray[0]+0.00001
    k=0
    while v:
        k+=1
#         print(v,temparray,rangelength)
        vindxes=get_closeValuesIndx(v,temparray,rangelength)
#         print('********************** \n',vindxes)
        v= np.mean(temparray[vindxes])
        vindxes=get_closeValuesIndx(v,temparray,rangelength)
#         print(vindxes)
        indxgroups.append(indxarray[vindxes])
#         print(temparray[vindxes])
    #     del temparray[vindxes]
        temparray=np.delete(temparray, vindxes)

        indxarray=np.delete(indxarray, vindxes)
#         print('temp array: ',temparray)
        if(k==100): break
        if len(temparray)>=1:
            v=temparray[0]
        else:
            break
    return indxgroups   
def suitify(awell):
    global_loglist=getLoglist(awell)
    sorted_well,minmax,dranges=sort_ranges(awell)
#     print_logs(awell)
    pseudo_suitindexes=getIndxGroups(dranges[:,0])
#     print('dranges : ',dranges[:,0])

#     for indgroup in pseudo_suitindexes:
#         print_logs(getLfileWIndex(sorted_well,indgroup))
#         print('********************************************************')
#     # for l in awell:
    suits={}
    for i,indgroup in enumerate(pseudo_suitindexes):
        partwell=getLfileWIndex(sorted_well,indgroup)
        list_availability=[]
        list_missed_logs=[]
        suits[i]={}
        for l in partwell:
            availability,missed_logs=global_logavailability(global_loglist,partwell[l])
            list_availability.append(availability)
            list_missed_logs.append(missed_logs)
            print('availability',availability)
            print('missed_logs',missed_logs, len(missed_logs))
        # print([len(item) for item in list_availability])  # Check if all lengths are the same
        print(list_missed_logs)   # This should help pinpoint irregularities

        # avalawell,miss_log_list=getValidloginRun(partwell,np.array(list_availability),np.array(list_missed_logs))
        # Adjust the function call
        avalawell, miss_log_list = getValidloginRun(partwell, np.array(list_availability), list_missed_logs)
        miss_log_avail=[]
        if len(miss_log_list)>0:
            for l in partwell:        
                availability,missed_logs=global_logavailability(miss_log_list,partwell[l])        
                miss_log_avail.append(availability)
        miss_log_avail=np.array(miss_log_avail)
        miss_indx=np.argsort(miss_log_avail)
        misavalawell=[]
    #     print(list(avalawell.keys())[0])
        key=list(avalawell.keys())[0]
        suits[i][key]=avalawell[key]
        if len(miss_indx) > 0 and miss_log_avail[miss_indx[-1:]]>0:
            misavalawell=getLfileWIndex(partwell,miss_indx[-1:])
            key=list(misavalawell.keys())[0]
            suits[i][key]=misavalawell[key]
    #     print(avalawell)      
    #     print(np.array(miss_log_avail)[miss_indx])
    #     print(misavalawell)
    #     print('****************************************************************')
    return suits   
#         print(awell[l]['depthrange'],', '.join(awell[l]['categories']))

# for indgroup in pseudo_suitindexes:
#     print_logs(getLfileWIndex(sorted_well,indgroup))

# suits


class Logset():
    def __init__(self,singlewell):
        self.well=singlewell
        self.key=list(singlewell.keys())[0]

        self.logs=self.well[self.key]['categories']
        self.mindepth=min(self.well[self.key]['depthrange'])
        self.maxdepth=max(self.well[self.key]['depthrange'])
    def isRangesubset(self,minmaxes):
#         print(self.mindepth,self.maxdepth)
#         print(minmaxes)
        if (minmaxes[0]>self.mindepth )& (minmaxes[1]<self.maxdepth):
            return True
        else:
            return False
    def isSubset(self,otherwell):
        owell=Logset(otherwell)
        if self.isRangesubset([owell.mindepth,owell.maxdepth]):
            for ol in owell.logs:
                if ol not in self.logs:
                    return False
        else:
            return False
        return True
