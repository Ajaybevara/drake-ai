# utils/loggy_settings.py
import os

basepath = './data'
# Define file paths
autosplice_params_file_path = os.path.join(basepath, 'autosplice_params.json')
mnemonicsfile = os.path.join(basepath, 'mnemonics_revised.txt')
lwdVSwirelineFile = os.path.join(basepath, 'lwd_wireline_differentiators.txt')
params_file_path = os.path.join(basepath, 'log_params.npy')
licence_file_path = os.path.join(basepath, 'licence.npy')

