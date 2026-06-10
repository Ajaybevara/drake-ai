
import sys

import numpy as np

from utils.helper import *
from utils.SuitSplice.flex import FlexLog
# from LogPlot import LogPlot
from utils.LasTree import LasTree
def lag_ix(x,y,corrtype='+ve',dist2look=50):
        
    fullcorr = np.correlate(x,y,mode='full')
    halflen=round((fullcorr.size-1)/2)
    corr=fullcorr[halflen-dist2look:halflen+dist2look]
#     corr=fullcorr
    if corrtype=='+ve':
        pos_ix = np.argmax( corr) 
    elif corrtype=='-ve':
        pos_ix = np.argmin( corr)
    else:
        pos_ix = np.argmax( np.abs(corr) )
    lag_ix = pos_ix - (corr.size-1)/2
    return lag_ix
#     return halflen-dist2look+lag_ix
def get_delay(A,B,dt,corrtype='+ve',dist2look=50):
    timea=np.arange(0,len(A))
    timeb=np.arange(0,len(B))
    # compute cross correlation

    fullcorr = np.correlate(A, B, 'full')
    # maxlag = (fullcorr.size-1)/2 

    # lag = np.arange(-maxlag, maxlag+1)*dt

    samples2look=int(dist2look/dt)
    halflen=round((fullcorr.size-1)/2)

    corr=fullcorr[halflen-samples2look:halflen+samples2look]

    partlag = (corr.size-1)/2 

    lag = np.arange(-partlag, partlag+1)*dt
#     corr=fullcorr
    if corrtype=='+ve':
        pos_ix = np.argmax( corr) 
    elif corrtype=='-ve':
        pos_ix = np.argmin( corr)
    else:
        pos_ix = np.argmax( np.abs(corr) )
    lag_ix = pos_ix - (corr.size-1)/2

    delay_estimation = -(lag_ix-0.5)*dt
    # line = ax[1].axvline(x=-delay_estimation, ymin=np.min(coor), ymax = np.max(coor), linewidth=1.5, color='c')
    # print('delay: %.2f and delay in terms of n samples: %.2f'%(delay_estimation,delay_estimation/dt))
    return delay_estimation,(lag, corr)


def mean_norm(A):
    A=A-np.mean(A[~np.isnan(A)])
    return A/np.linalg.norm(A[~np.isnan(A)])
    # def cross_correlate(a,b):
            