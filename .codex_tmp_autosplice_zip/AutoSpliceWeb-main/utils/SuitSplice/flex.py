# utils/SuitSplice/flex.py

import numpy as np
import matplotlib.pyplot as plt

# ============================================================================
# Basic Array and Splicing Routines
# ============================================================================
class FlexArray:
    def __init__(self, sortedarray):
        self.flexarray = np.asarray(sortedarray)
        # Use .size rather than .len() since it's a numpy array.
        self.stepsize = int(np.sqrt(self.flexarray.size))
        self.flexarrIndexRangeArray = np.append(np.arange(0, len(self.flexarray)-1, self.stepsize),
                                               len(self.flexarray)-1)

    def get_stepsize(self):
        return self.stepsize

    def find_indx_nearest(self, array, value):
        array = np.asarray(array)
        return (np.abs(array - value)).argmin()    

    def find_indx_leftright(self, array, value):
        if (value >= array[-1]) or (value <= array[0]):
            if (value == array[-1]) or (value == array[0]):
                if value == array[-1]:
                    return -2, len(array)-1
                else:
                    return 0, 1
            print('Value out of range!!')
            if value >= array[-1]:
                return -1, np.nan
            else:
                return np.nan, 0
        nearidx = (np.abs(array - value)).argmin()
        if value > array[nearidx]:
            return nearidx, nearidx+1
        elif value < array[nearidx]:
            return nearidx-1, nearidx
        else:
            return nearidx-1, nearidx+1

    def find_leftright_indxs(self, value):
        steparray = self.flexarray[self.flexarrIndexRangeArray]
        li, ri = self.find_indx_leftright(steparray, value)
        # print(li, ri, self.flexarrIndexRangeArray[[li, ri]])
        if (np.isnan(li)) or (np.isnan(ri)):
            return li, ri
        else:
            smallarray = self.flexarray[self.flexarrIndexRangeArray[li]:self.flexarrIndexRangeArray[ri]+1]
            try:
                lgi, rgi = self.find_indx_leftright(smallarray, value)
            except:
                print('Error in find_indx_leftright with smallarray:', smallarray, value)
                return self.flexarrIndexRangeArray[li], self.flexarrIndexRangeArray[li]
            return self.flexarrIndexRangeArray[li] + lgi, self.flexarrIndexRangeArray[li] + rgi

    def find_leftright_vlaues(self, value):
        if value < self.flexarray[0]:
            return [np.nan, self.flexarray[0]]
        elif value > self.flexarray[-1]:
            return [self.flexarray[-1], np.nan] 
        else:
            return self.flexarray[list(self.find_leftright_indxs(value))]

# ============================================================================
# FlexXY and FlexLog Classes
# ============================================================================
class FlexXY(FlexArray):
    def __init__(self, XY):
        # Expect XY to be an (N,2) array.
        self.XY = XY
        super(FlexXY, self).__init__(self.XY[:, 0])

    def get_LRofXYs(self, xvalue):
        if xvalue < self.XY[0, 0]:
            return np.array([[self.XY[0, 0]-self.stepsize, np.nan],
                             [self.XY[0, 0], self.XY[0, 1]]])
        elif xvalue > self.XY[-1, 0]:
            return np.array([[self.XY[-1, 0], self.XY[-1, 1]],
                             [self.XY[-1, 0]+self.stepsize, np.nan]])
        else:
            li, ri = self.find_leftright_indxs(xvalue)
            return self.XY[[li, ri], :]

    def get_LRindxOfXYs(self, xvalue):
        li, ri = self.find_leftright_indxs(xvalue)
        # print(li, ri)
        return li, ri

    def predictYgivenX(self, xvalue):
        lr = self.get_LRofXYs(xvalue)
        return lr[0, 1] + (xvalue - lr[0, 0]) * (lr[1, 1] - lr[0, 1]) / (lr[1, 0] - lr[0, 0])

    def resampleY(self, new_xarray):
        newY = np.zeros(len(new_xarray))
        for i in range(len(new_xarray)):
            newY[i] = self.predictYgivenX(new_xarray[i])
        return newY

    def resampleXY(self, new_xarray):
        newy = self.resampleY(new_xarray)
        return np.column_stack((new_xarray, newy))

class FlexLog(FlexXY):
    def __init__(self, XY):
        self.XY = XY
        super(FlexLog, self).__init__(self.XY)
        self.calc_logstep()

    def calc_logstep(self):
        for i in range(1, len(self.XY[:, 0])):
            self.logstep = np.abs(self.XY[i, 0] - self.XY[i-1, 0])
            if not np.isnan(self.logstep):
                break

    def logExtend(self, newLog, depthminmax=[None, None], replace='top'):
        if len(self.XY[:, 0]) < 2:
            super(FlexLog, self).__init__(newLog)
            return
        else:
            self.calc_logstep()
        self.toplog = 'existing'
        if newLog[0, 0] < self.XY[0, 0]:
            depthminmax[0] = newLog[0, 0]
            self.toplog = 'incoming'
        else:
            depthminmax[0] = self.XY[0, 0]
        if newLog[-1, 0] > self.XY[-1, 0]:
            depthminmax[1] = newLog[-1, 0]
        else:
            depthminmax[1] = self.XY[-1, 0]
        flexnewLog = FlexLog(newLog)
        merged_xarray = np.arange(depthminmax[0], depthminmax[1], self.logstep)
        if self.toplog == 'existing':
            if replace == 'top':
                start_depth_bottom_log = newLog[0, 0]
            else:
                start_depth_bottom_log = self.XY[-1, 0] + self.logstep
        else:
            if replace == 'top':
                start_depth_bottom_log = self.XY[0, 0]
            else:
                start_depth_bottom_log = newLog[-1, 0] + self.logstep
        flexmdarray = FlexArray(merged_xarray)
        lrindexes = flexmdarray.find_leftright_indxs(start_depth_bottom_log)
        if not (np.isnan(np.sum(lrindexes))):
            bot_log_darray = merged_xarray[lrindexes[1]:]
            top_log_limitIndex = np.where(self.XY[:, 0] == merged_xarray[lrindexes[0]])[0]
        else:
            idx = self.find_indx_nearest(merged_xarray, start_depth_bottom_log)
            bot_log_darray = merged_xarray[idx:]
            top_log_limitIndex = [idx-1]
        if len(top_log_limitIndex) == 0:
            top_log_darray = merged_xarray[:lrindexes[0]]
            oldYs = self.resampleYs(top_log_darray)
        else:
            top_log_darray = merged_xarray[:top_log_limitIndex[0]]
            oldYs = self.XY[:top_log_limitIndex[0], 1:]
        newYs = flexnewLog.resampleYs(bot_log_darray)
        self.XY = np.column_stack((np.append(top_log_darray, bot_log_darray),
                                    np.append(oldYs, newYs, axis=0)))
        super(FlexLog, self).__init__(self.XY)

    def getSplicedLog(self, logstep=0.1524):
        if not hasattr(self, 'logstep'):
            # self.calc_logstep()
            self.logstep=logstep
        if self.logstep != logstep:
            new_d = np.arange(self.XY[0, 0], self.XY[-1, 0], logstep)
            resXY = self.resampleXY(new_d)
            return resXY
        else:
            return self.XY

    def clip(self, drange=(None, None)):
        self.XY = self.XY[(self.XY[:, 0] >= drange[0]) & (self.XY[:, 0] <= drange[1])]

# ============================================================================
# Provenance-Enabled FlexLogCurves
# ============================================================================
class FlexLogCurves(FlexLog):
    def __init__(self, XY, YKeys=[], contributing_files=None, curve_origins=None):
        # Initialize provenance tracking.
        self.contributing_input_files = set() if contributing_files is None else contributing_files
        self.curve_origins = {} if curve_origins is None else curve_origins
        self.YKeys = np.array(YKeys)
        self.XY = XY
        super(FlexLogCurves, self).__init__(self.XY)

    def sameSuitAppend(self, newLog, newYKeys, depthminmax=[None, None], replace='top'):
        # Here, integrate your merging logic for appending new log data.
        # For demonstration, we simply row-stack the new data.
        if hasattr(newLog, 'contributing_input_files'):
            self.contributing_input_files.update(newLog.contributing_input_files)
        if hasattr(newLog, 'curve_origins'):
            for key, origins in newLog.curve_origins.items():
                if key not in self.curve_origins:
                    self.curve_origins[key] = []
                existing = {(origin['input_file'], origin['curve']) for origin in self.curve_origins[key]}
                for origin in origins:
                    if (origin['input_file'], origin['curve']) not in existing:
                        self.curve_origins[key].append(origin)
        # Append new data (this is a placeholder for your actual logic).
        self.XY = np.row_stack((self.XY, newLog))
        self.YKeys = np.append(self.YKeys, newYKeys)


