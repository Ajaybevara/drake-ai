# # # # utils/SuitSplice/SuitSplice.py

# # # import lasio
# # # import os
# # # import time, json
# # # import numpy as np
# # # import logging
# # # from utils.SuitSplice.correlationNsplice import las_export
# # # from utils.categorize_v2 import LogCategorize
# # # from utils.helper import *
# # # from utils.SuitSplice.flex import FlexLogCurves
# # # from utils.loggy_settings import *
# # # from utils.LasTree import get_txtdict
# # # from utils.SuitSplice.Filters import hist_filter
# # # from utils.SuitSplice.manage_data_gaps import ZonalArray, updateTopXY, find_datazone_in_bottomrun

# # # # ============================================================================
# # # # A Simple Writer Class for Logging (unchanged)
# # # # ============================================================================
# # # class writer:
# # #     def __init__(self, *writers):
# # #         self.writers = writers

# # #     def write(self, text):
# # #         for w in self.writers:
# # #             w.write(text)

# # # def drangestrprint(optstr, dr):
# # #     try:
# # #         dr = np.array(dr, dtype=float)
# # #         if dr.size < 2:
# # #             print(f"{optstr} Invalid range data (size < 2)")
# # #             return
# # #         min_depth = dr[0]
# # #         max_depth = dr[-1]
# # #         if np.isnan(min_depth) or np.isnan(max_depth) or min_depth >= max_depth:
# # #             print(f"{optstr} {min_depth:.2f} -- {max_depth:.2f} (Invalid/NaN Range)")
# # #             return
# # #         st = min_depth / 50
# # #         en = max_depth / 50
# # #         num_dashes = max(0, int(en - st))
# # #         dash_str = '-' * num_dashes
# # #         field_width = 10 + int(st)
# # #         print(f"{optstr}{min_depth:{field_width}.2f}{dash_str}{max_depth:4.2f}")
# # #     except Exception as e:
# # #         print(f"{optstr} Error formatting range {dr}: {e}")

# # # # ============================================================================
# # # # LateralLas: Reads LAS files and collects provenance.
# # # # ============================================================================
# # # class LateralLas():
# # #     def __init__(self, suit, params):
# # #         self.hist_bins = int(params.get('hist_bins', 100))
# # #         self.n_big_patches = int(params.get('n_big_patches', 1))
# # #         self.equal_val_allowed_width = int(params.get('equal_val_allowed_width', 3))
# # #         self.curvetypesavoided = []
# # #         self.depthcol_name = 'DEPTH'
# # #         self.type_dict = get_txtdict(mnemonicsfile, delimiter=' ')
# # #         self.lc = LogCategorize(mnemonicsfile)
# # #         # Provenance attributes:
# # #         self.contributing_input_files = set()
# # #         self.curve_origins = {}
# # #         for i, l in enumerate(suit):
# # #             if isinstance(suit[l], dict) and 'path' in suit[l]:
# # #                 file_path = suit[l]['path']
# # #                 if os.path.isfile(file_path):
# # #                     filename_base = os.path.basename(file_path)
# # #                     print(f'    {i}.{filename_base}  ', end='|')
# # #                     self.ttle = l
# # #                     self.initiateLassing(file_path)
# # #                     if hasattr(self, 'XYY') and self.XYY is not None and self.XYY.shape[0] > 0 and self.XYY.shape[1] > 1:
# # #                         self.contributing_input_files.add(filename_base)
# # #                         for logname, log_cate in zip(self.interestedLognames, self.interestedKeynames):
# # #                             print(f"logname: {logname} log_cate: {log_cate}")
                            
# # #                             # if log_cate not in self.curvetypesavoided:
# # #                             if log_cate not in self.curve_origins:
# # #                                 self.curve_origins[log_cate] = []

# # #                             print(f"self.curve_origins: {self.curve_origins}")
# # #                             self.curve_origins[log_cate].append({
# # #                                 'input_file': filename_base,
# # #                                 'curve': logname
# # #                             })
# # #                     else:
# # #                         print(f"Warning: Unexpected structure for suit item {l}: {suit[l]}")
# # #                 else:
# # #                     print(f"Warning: File path does not exist: {file_path}")
# # #             else:
# # #                 print(f"Warning: Unexpected structure for suit item {l}: {suit[l]}")
# # #     def initiateLassing(self,path):
# # #         try:
# # #             self.las=lasio.read(path)
# # #             self.lc.set_las(self.las)
# # #             self.lc.lasCategorize()      
# # #             self.interestedKeynames=self.lc.get_catePresent()
# # #             self.interestedLognames=self.lc.getLogsPresent()

# # #             print('  ({}) -- ({})'.format('|'.join(self.interestedKeynames),'|'.join(self.interestedLognames)))
# # #             dcol=self.las.keys()[find_depth_indx(self.las)]
# # #             self.XYY=self.las[dcol]
# # #         except:
# # #             self.XYY=[]
            
# # #         if len(self.XYY)<1:
# # #             print('Corrupt file unable to process')
# # #             return
# # #         elif isinstance(self.XYY[0],str):
# # #             print('Corrupt file unable to process')
# # #             return
# # #         # Making XYY and cleaing it
# # #         self.makeXYY()
# # #         drangestrprint('    Depth : ',[self.XYY[0,0],self.XYY[-1,0]])

# # #         self.curvetypesavoided=self.interestedKeynames.copy()
# # #         # Despiking
# # #         self.applyfiltOnXYY(n_big_patches=self.n_big_patches,hist_bins=self.hist_bins)
# # #         # Processing for stright linal data patches
# # #         for i in range(1,len(self.XYY[0,:])):
# # #             targarray=self.XYY[0,i]
# # #             za=ZonalArray(self.XYY[:,i])
# # #             self.XYY[:,i]=za.makeequalsNan(equal_val_allowed_width=self.equal_val_allowed_width)

# # #         if hasattr(self, 'flexLogCurves'):
# # #             self.flexLogCurves.sameSuitAppend(self.XYY,self.YcolNames)
# # #         else:
# # #             # print('noooooooooooooooooo in glooooooooooooooooooooooooobasl')
# # #             self.flexLogCurves=FlexLogCurves(self.XYY,self.YcolNames)


# # #     def makeXYY(self):
# # #         self.YcolNames = []
# # #         for logname, log_cate in zip(self.interestedLognames, self.interestedKeynames):
# # #             if log_cate not in self.curvetypesavoided:
# # #                 self.YcolNames.append(log_cate)
# # #                 self.XYY = np.column_stack((self.XYY, self.las[logname]))
# # #         indxes = np.argsort(self.XYY[:, 0])
# # #         self.XYY = self.XYY[indxes, :]
# # #         self.XYY = self.XYY[~np.isnan(self.XYY[:, 0]), :]

# # #     def applyfiltOnXYY(self, n_big_patches=1, hist_bins=100):
# # #         for j, log_cate in enumerate(self.YcolNames):
# # #             logdata = self.XYY[:, j+1].copy()
# # #             if self.lc.isResistivityCurve(log_cate):
# # #                 logdata[logdata == 0] = 0.001
# # #                 logdata = np.log10(logdata)
# # #             res = hist_filter(logdata, n_big_patches=n_big_patches, hist_bins=hist_bins)
# # #             if self.lc.isResistivityCurve(log_cate):
# # #                 res = np.power(10, res)
# # #             self.XYY[:, j+1] = res

# # # # ============================================================================
# # # # VerticalLas: Merges lateral results into a vertical (spliced) LAS.
# # # # Provenance information is passed from lateral to vertical merging.
# # # # ============================================================================
# # # class VerticalLas():
# # #     def __init__(self, XY=np.array([[0, 0]]), YKeys=[], params={'nan_patches_gap_ignored':20}):
# # #         self.min_data_gap_allowed = params['nan_patches_gap_ignored']
# # #         self.contributing_input_files = set()
# # #         self.curve_origins = {}
# # #         self.flexlog = FlexLogCurves(XY, YKeys,
# # #                                      contributing_files=self.contributing_input_files,
# # #                                      curve_origins=self.curve_origins)
# # #         if not hasattr(self, 'uniqueLogs'):
# # #             self.uniqueLogs = np.array(YKeys)

# # #     def extend(self, botlatlas, delaybottom=0):
# # #         trows, tcols = self.flexlog.XY.shape
# # #         brows, bcols = botlatlas.flexLogCurves.XY.shape
# # #         print('    Result Suit so far .....', end='|')
# # #         print(' (rows,cols): ({}, {}) | Logs: {}'.format(trows, tcols, '-'.join(self.uniqueLogs)))
# # #         drangestrprint('      Depth : ', self.flexlog.XY[[0, -1], 0])
# # #         print('    Present suit............', end='|')
# # #         print(' (rows,cols): ({}, {}) | Logs: {}'.format(brows, bcols, '-'.join(botlatlas.flexLogCurves.YKeys)))
# # #         drangestrprint('      Depth : ', botlatlas.flexLogCurves.XY[[0, -1], 0])
# # #         if trows < 3:
# # #             print("    Initializing VerticalLas with bottom suite data.")
# # #             self.flexlog = FlexLogCurves(botlatlas.flexLogCurves.XY.copy(),
# # #                                           botlatlas.flexLogCurves.YKeys.copy(),
# # #                                           contributing_files=set(botlatlas.contributing_input_files),
# # #                                           curve_origins=botlatlas.curve_origins.copy())
# # #             self.uniqueLogs = botlatlas.flexLogCurves.YKeys
# # #             return
# # #         toplogs = np.array(self.uniqueLogs)
# # #         botlogs = np.array(botlatlas.flexLogCurves.YKeys)
# # #         print('  Top Logs: {} \n  Bot Logs: {}'.format(toplogs, botlogs))
# # #         print('  <<<<<<<<<<<<<<<   Merging   <<<<<<<<<<<<<<<<<')
# # #         combined_unique_logs = np.unique(np.append(toplogs, botlogs))
# # #         print('  Combined Unique Logs: {}'.format(combined_unique_logs))
# # #         # (Placeholder merging logic for topXY and botXY.)
# # #         topXY = self.flexlog.XY  # Replace with actual merged top data.
# # #         botXY = botlatlas.flexLogCurves.XY - delaybottom  # Replace with actual merged bottom data.
# # #         # --- Merge provenance from bottom suite ---
# # #         if hasattr(botlatlas, 'flexLogCurves'):
# # #             bot_flex = botlatlas.flexLogCurves
# # #             self.contributing_input_files.update(bot_flex.contributing_input_files)
# # #             for key, origins in bot_flex.curve_origins.items():
# # #                 if key not in self.curve_origins:
# # #                     self.curve_origins[key] = []
# # #                 existing = {(origin['input_file'], origin['curve']) for origin in self.curve_origins.get(key, [])}
# # #                 for origin in origins:
# # #                     if (origin['input_file'], origin['curve']) not in existing:
# # #                         self.curve_origins.setdefault(key, []).append(origin)
# # #         self.flexlog = FlexLogCurves(topXY, combined_unique_logs,
# # #                                      contributing_files=self.contributing_input_files,
# # #                                      curve_origins=self.curve_origins)
# # #         self.uniqueLogs = combined_unique_logs
# # #         print('    Final Unique Logs: {}'.format(self.uniqueLogs))
# # #         print('    Final XY Shape: {}'.format(self.flexlog.XY.shape))

# # #     def doSplicing(self, sampling_inteval):
# # #         print("Splicing starts....")
# # #         self.sampling_int = sampling_inteval
# # #         try:
# # #             min_depth, max_depth = self.flexlog.XY[0, 0], self.flexlog.XY[-1, 0]
# # #             if np.isnan(min_depth) or np.isnan(max_depth) or min_depth >= max_depth:
# # #                 print(f"Warning: Invalid depth range [{min_depth}, {max_depth}]. Returning original data.")
# # #                 self.spliced_logs = self.flexlog.XY
# # #             else:
# # #                 if hasattr(self.flexlog, 'getSplicedLog') and callable(self.flexlog.getSplicedLog):
# # #                     self.spliced_logs = self.flexlog.getSplicedLog(logstep=self.sampling_int)
# # #                 else:
# # #                     print("Error: flexlog object missing 'getSplicedLog' method.")
# # #                     self.spliced_logs = self.flexlog.XY
# # #         except Exception as e:
# # #             print(f"Error during splicing: {e}")
# # #             self.spliced_logs = self.flexlog.XY
# # #         expected_columns = len(self.uniqueLogs) + 1  # +1 for depth column
# # #         actual_columns = self.spliced_logs.shape[1]
# # #         if expected_columns != actual_columns:
# # #             print(f"Warning: Unique logs count ({len(self.uniqueLogs)}) and spliced data columns ({actual_columns-1}) mismatch.")
# # #             if actual_columns > expected_columns:
# # #                 print("Truncating extra columns.")
# # #                 self.spliced_logs = self.spliced_logs[:, :expected_columns]
# # #             elif actual_columns < expected_columns:
# # #                 print("Extending with NaN columns.")
# # #                 missing_columns = expected_columns - actual_columns
# # #                 num_rows = self.spliced_logs.shape[0]
# # #                 nan_cols = np.full((num_rows, missing_columns), np.nan)
# # #                 self.spliced_logs = np.hstack((self.spliced_logs, nan_cols))
# # #             print(f"Adjusted spliced_logs shape: {self.spliced_logs.shape}")
# # #         print('Splicing Completes....')

# # #     def export(self, filepath):
# # #         print("Exporting starts....")
# # #         print("Unique Logs:", self.uniqueLogs, "Spliced Shape:", self.spliced_logs.shape)
# # #         las_export(self.spliced_logs, self.uniqueLogs, filepath)
# # #         print(f"Export success. LAS file created at {filepath}")
# # #     def get_detailed_provenance(self):
# # #         """Returns detailed provenance information for the spliced logs"""
# # #         # Collect input files
# # #         input_files = []
# # #         if hasattr(self, 'contributing_input_files'):
# # #             input_files = sorted(list(self.contributing_input_files))
        
# # #         # Collect curve mapping
# # #         curve_mapping = {}
# # #         if hasattr(self, 'uniqueLogs') and hasattr(self, 'curve_origins'):
# # #             for log_type in self.uniqueLogs:
# # #                 if log_type in self.curve_origins:
# # #                     curve_mapping[log_type] = self.curve_origins[log_type]
# # #                 else:
# # #                     curve_mapping[log_type] = []
        
# # #         # Build final provenance data structure
# # #         return {
# # #             'input_files': input_files,
# # #             'output_curve_mapping': curve_mapping
# # #         }


# # # # ============================================================================
# # # # SuitSplice: Merges lateral and vertical results and finally saves provenance.
# # # # ============================================================================
# # # class SuitSplice():
# # #     def __init__(self, suits, params):
# # #         self.filepaths = []
# # #         self.resultLas = VerticalLas(params=params)
# # #         self.suits = suits
# # #         self.laterallases = []
# # #         self.curve_origins = {}
# # #         self.input_files = set()
# # #         self.params = params
# # #         for i in self.suits:
# # #             print(f'Processing Suit Index: {i}')
# # #             suit_data = self.suits[i]
# # #             if isinstance(suit_data, dict) and suit_data:
# # #                 print('Lateral Merging...')
# # #                 self.laterallas = LateralLas(suit_data, params=self.params)
# # #                 print("*************************************************************")
# # #                 for key in self.laterallas.curve_origins:
# # #                     if key not in self.curve_origins:
# # #                         self.curve_origins[key] = []
# # #                     self.curve_origins[key].extend(self.laterallas.curve_origins[key])
# # #                     self.input_files.update(self.laterallas.contributing_input_files)
# # #                 print(f"self.curve_origins: {self.curve_origins}")
# # #                 print("*************************************************************")
# # #                 if hasattr(self.laterallas, 'flexLogCurves'):
# # #                     print('Vertical Merging...')
# # #                     self.resultLas.extend(self.laterallas, delaybottom=0)
# # #                     print(f'Logs after merging suit {i}: {self.resultLas.uniqueLogs}')
# # #                     print(f'Shape of XYY matrix after suit {i}: {self.resultLas.flexlog.XY.shape}')
# # #                 else:
# # #                     print(f"Skipping vertical merge for suit {i} - No valid flexLogCurves.")
# # #             else:
# # #                 print(f"Warning: Suit index {i} has invalid or empty data. Skipping.")

# # #     def get_spliced_curve_mnemonics(self):
# # #         if hasattr(self.resultLas, 'uniqueLogs'):
# # #             return list(self.resultLas.uniqueLogs)
# # #         else:
# # #             return []

# # #     def get_provenance_data(self):
# # #         if hasattr(self.resultLas, 'contributing_input_files') and hasattr(self, 'curve_origins'):
# # #             return {
# # #                 'input_files': list(self.input_files),
# # #                 'output_curves': self.curve_origins
# # #             }
# # #         return {'input_files': [], 'output_curves': {}}

# # #     def save_provenance(self, filepath):
# # #         provenance_data = self.get_provenance_data()
# # #         # print("*************************************************************")
# # #         # print(f"provenance_data: {provenance_data}")
# # #         # print("*************************************************************")
# # #         provenance_filepath = filepath.replace('.las', '_provenance.json')
# # #         try:
# # #             with open(provenance_filepath, 'w') as f:
# # #                 json.dump(provenance_data, f, indent=2)
# # #             print(f'Provenance data saved to {provenance_filepath}')
# # #             return True
# # #         except Exception as e:
# # #             print(f'Error saving provenance data: {e}')
# # #             return False

# # #     def export(self, filepath, sampling_inteval):
# # #         print(f"Starting export with sampling interval {sampling_inteval}...")
# # #         self.resultLas.doSplicing(sampling_inteval)
# # #         self.resultLas.export(filepath)
# # #         self.save_provenance(filepath)
# # #         print(f"Export complete! LAS file and provenance data created at {filepath} and corresponding provenance file.")
    
# # # def read_params():
# # #     try:
# # #         with open(autosplice_params_file_path, 'r') as file:
# # #             params = json.load(file)
# # #         params['equal_val_allowed_width'] = int(params['equal_val_allowed_width'])
# # #         params['export_sampling_interval'] = float(params['export_sampling_interval'])
# # #         params['hist_bins'] = int(params['hist_bins'])
# # #         params['n_big_patches'] = int(params['n_big_patches'])
# # #         params['nan_patches_gap_ignored'] = int(params['nan_patches_gap_ignored'])
# # #         return params
# # #     except FileNotFoundError:
# # #         print(f"Warning: Parameter file not found. Using defaults.")
# # #         return {
# # #             'equal_val_allowed_width': 3,
# # #             'export_sampling_interval': 0.1524,
# # #             'hist_bins': 100,
# # #             'n_big_patches': 1,
# # #             'nan_patches_gap_ignored': 20
# # #         }
# # #     except KeyError as e:
# # #         print(f"Error: Missing key {e} in parameter file.")
# # #         raise
# # #     except (ValueError, TypeError) as e:
# # #         print(f"Error: Invalid value type in parameter file: {e}")
# # #         raise

# # # utils/SuitSplice/SuitSplice.py
# # import lasio
# # import os
# # import time, json
# # import numpy as np
# # import logging
# # from utils.SuitSplice.correlationNsplice import las_export
# # from utils.categorize_v2 import LogCategorize
# # from utils.helper import *
# # from utils.SuitSplice.flex import FlexLogCurves
# # from utils.loggy_settings import *
# # from utils.LasTree import get_txtdict
# # from utils.SuitSplice.Filters import hist_filter
# # from utils.SuitSplice.manage_data_gaps import ZonalArray, updateTopXY, find_datazone_in_bottomrun

# # # ============================================================================
# # # A Simple Writer Class for Logging (unchanged)
# # # ============================================================================
# # class writer:
# #     def __init__(self, *writers):
# #         self.writers = writers

# #     def write(self, text):
# #         for w in self.writers:
# #             w.write(text)

# # def drangestrprint(optstr, dr):
# #     try:
# #         dr = np.array(dr, dtype=float)
# #         if dr.size < 2:
# #             print(f"{optstr} Invalid range data (size < 2)")
# #             return
# #         min_depth = dr[0]
# #         max_depth = dr[-1]
# #         if np.isnan(min_depth) or np.isnan(max_depth) or min_depth >= max_depth:
# #             print(f"{optstr} {min_depth:.2f} -- {max_depth:.2f} (Invalid/NaN Range)")
# #             return
# #         st = min_depth / 50
# #         en = max_depth / 50
# #         num_dashes = max(0, int(en - st))
# #         dash_str = '-' * num_dashes
# #         field_width = 10 + int(st)
# #         print(f"{optstr}{min_depth:{field_width}.2f}{dash_str}{max_depth:4.2f}")
# #     except Exception as e:
# #         print(f"{optstr} Error formatting range {dr}: {e}")

# # # ============================================================================
# # # LateralLas: Reads LAS files and collects provenance.
# # # ============================================================================
# # class LateralLas():
# #     def __init__(self, suit, params):
# #         self.hist_bins = int(params.get('hist_bins', 100))
# #         self.n_big_patches = int(params.get('n_big_patches', 1))
# #         self.equal_val_allowed_width = int(params.get('equal_val_allowed_width', 3))
# #         self.curvetypesavoided = []
# #         self.depthcol_name = 'DEPTH'
# #         self.type_dict = get_txtdict(mnemonicsfile, delimiter=' ')
# #         self.lc = LogCategorize(mnemonicsfile)
# #         # Provenance attributes:
# #         self.contributing_input_files = set()
# #         self.curve_origins = {}
# #         for i, l in enumerate(suit):
# #             if isinstance(suit[l], dict) and 'path' in suit[l]:
# #                 file_path = suit[l]['path']
# #                 if os.path.isfile(file_path):
# #                     filename_base = os.path.basename(file_path)
# #                     print(f'    {i}.{filename_base}  ', end='|')
# #                     self.ttle = l
# #                     self.initiateLassing(file_path)
# #                     if hasattr(self, 'XYY') and self.XYY is not None and self.XYY.shape[0] > 0 and self.XYY.shape[1] > 1:
# #                         self.contributing_input_files.add(filename_base)
# #                         for logname, log_cate in zip(self.interestedLognames, self.interestedKeynames):
# #                             print(f"logname: {logname} log_cate: {log_cate}")
                            
# #                             if log_cate not in self.curve_origins:
# #                                 self.curve_origins[log_cate] = []

# #                             print(f"self.curve_origins: {self.curve_origins}")
# #                             self.curve_origins[log_cate].append({
# #                                 'input_file': filename_base,
# #                                 'curve': logname
# #                             })
# #                     else:
# #                         print(f"Warning: Unexpected structure for suit item {l}: {suit[l]}")
# #                 else:
# #                     print(f"Warning: File path does not exist: {file_path}")
# #             else:
# #                 print(f"Warning: Unexpected structure for suit item {l}: {suit[l]}")
    
# #     def initiateLassing(self,path):
# #         try:
# #             self.las=lasio.read(path)
# #             self.lc.set_las(self.las)
# #             self.lc.lasCategorize()      
# #             self.interestedKeynames=self.lc.get_catePresent()
# #             self.interestedLognames=self.lc.getLogsPresent()

# #             print('  ({}) -- ({})'.format('|'.join(self.interestedKeynames),'|'.join(self.interestedLognames)))
# #             dcol=self.las.keys()[find_depth_indx(self.las)]
# #             self.XYY=self.las[dcol]
# #         except Exception as e:
# #             print(f"Error reading LAS file: {e}")
# #             self.XYY=[]
            
# #         if len(self.XYY)<1:
# #             print('Corrupt file unable to process')
# #             return
# #         elif isinstance(self.XYY[0],str):
# #             print('Corrupt file unable to process')
# #             return
# #         # Making XYY and cleaing it
# #         self.makeXYY()
# #         drangestrprint('    Depth : ',[self.XYY[0,0],self.XYY[-1,0]])

# #         self.curvetypesavoided=self.interestedKeynames.copy()
# #         # Despiking
# #         self.applyfiltOnXYY(n_big_patches=self.n_big_patches,hist_bins=self.hist_bins)
# #         # Processing for stright linal data patches
# #         for i in range(1,len(self.XYY[0,:])):
# #             targarray=self.XYY[0,i]
# #             za=ZonalArray(self.XYY[:,i])
# #             self.XYY[:,i]=za.makeequalsNan(equal_val_allowed_width=self.equal_val_allowed_width)

# #         if hasattr(self, 'flexLogCurves'):
# #             self.flexLogCurves.sameSuitAppend(self.XYY,self.YcolNames)
# #         else:
# #             self.flexLogCurves=FlexLogCurves(self.XYY,self.YcolNames)


# #     def makeXYY(self):
# #         self.YcolNames = []
# #         for logname, log_cate in zip(self.interestedLognames, self.interestedKeynames):
# #             if log_cate not in self.curvetypesavoided:
# #                 self.YcolNames.append(log_cate)
# #                 self.XYY = np.column_stack((self.XYY, self.las[logname]))
# #         indxes = np.argsort(self.XYY[:, 0])
# #         self.XYY = self.XYY[indxes, :]
# #         self.XYY = self.XYY[~np.isnan(self.XYY[:, 0]), :]

# #     def applyfiltOnXYY(self, n_big_patches=1, hist_bins=100):
# #         for j, log_cate in enumerate(self.YcolNames):
# #             logdata = self.XYY[:, j+1].copy()
# #             if self.lc.isResistivityCurve(log_cate):
# #                 logdata[logdata == 0] = 0.001
# #                 logdata = np.log10(logdata)
# #             res = hist_filter(logdata, n_big_patches=n_big_patches, hist_bins=hist_bins)
# #             if self.lc.isResistivityCurve(log_cate):
# #                 res = np.power(10, res)
# #             self.XYY[:, j+1] = res

# # # ============================================================================
# # # VerticalLas: Merges lateral results into a vertical (spliced) LAS.
# # # Provenance information is passed from lateral to vertical merging.
# # # ============================================================================
# # class VerticalLas():
# #     def __init__(self, XY=np.array([[0, 0]]), YKeys=[], params={'nan_patches_gap_ignored':20}):
# #         self.min_data_gap_allowed = params['nan_patches_gap_ignored']
# #         self.contributing_input_files = set()
# #         self.curve_origins = {}
# #         self.flexlog = FlexLogCurves(XY, YKeys,
# #                                      contributing_files=self.contributing_input_files,
# #                                      curve_origins=self.curve_origins)
# #         if not hasattr(self, 'uniqueLogs'):
# #             self.uniqueLogs = np.array(YKeys)

# #     def extend(self, botlatlas, delaybottom=0):
# #         try:
# #             trows, tcols = self.flexlog.XY.shape
# #             brows, bcols = botlatlas.flexLogCurves.XY.shape
# #             print('    Result Suit so far .....', end='|')
# #             print(' (rows,cols): ({}, {}) | Logs: {}'.format(trows, tcols, '-'.join(self.uniqueLogs)))
# #             drangestrprint('      Depth : ', self.flexlog.XY[[0, -1], 0])
# #             print('    Present suit............', end='|')
# #             print(' (rows,cols): ({}, {}) | Logs: {}'.format(brows, bcols, '-'.join(botlatlas.flexLogCurves.YKeys)))
# #             drangestrprint('      Depth : ', botlatlas.flexLogCurves.XY[[0, -1], 0])
            
# #             # If this is the first dataset, just initialize with it
# #             if trows < 3:
# #                 print("    Initializing VerticalLas with bottom suite data.")
# #                 self.flexlog = FlexLogCurves(botlatlas.flexLogCurves.XY.copy(),
# #                                             botlatlas.flexLogCurves.YKeys.copy(),
# #                                             contributing_files=set(botlatlas.contributing_input_files),
# #                                             curve_origins=botlatlas.curve_origins.copy())
# #                 self.uniqueLogs = np.array(botlatlas.flexLogCurves.YKeys)
# #                 return
            
# #             # Prepare for merging
# #             toplogs = np.array(self.uniqueLogs)
# #             botlogs = np.array(botlatlas.flexLogCurves.YKeys)
# #             print('  Top Logs: {} \n  Bot Logs: {}'.format(toplogs, botlogs))
# #             print('  <<<<<<<<<<<<<<<   Merging   <<<<<<<<<<<<<<<<<')
# #             combined_unique_logs = np.unique(np.append(toplogs, botlogs))
# #             print('  Combined Unique Logs: {}'.format(combined_unique_logs))
            
# #             # Get depth ranges for determining overlap
# #             top_min_depth = self.flexlog.XY[0, 0]
# #             top_max_depth = self.flexlog.XY[-1, 0]
# #             bot_min_depth = botlatlas.flexLogCurves.XY[0, 0] - delaybottom
# #             bot_max_depth = botlatlas.flexLogCurves.XY[-1, 0] - delaybottom
            
# #             # Prepare new arrays with all columns from combined logs
# #             # Create new merged dataset with all curves
# #             new_depth_range = np.unique(np.concatenate((self.flexlog.XY[:, 0], 
# #                                                       botlatlas.flexLogCurves.XY[:, 0] - delaybottom)))
# #             new_depth_range = np.sort(new_depth_range)
            
# #             # Create a new array with NaN values for all curves
# #             merged_data = np.full((len(new_depth_range), len(combined_unique_logs) + 1), np.nan)
# #             merged_data[:, 0] = new_depth_range  # Set depth column
            
# #             # Map the column indices for top and bottom datasets
# #             top_col_indices = {log: i+1 for i, log in enumerate(toplogs)}
# #             bot_col_indices = {log: i+1 for i, log in enumerate(botlogs)}
# #             merged_col_indices = {log: i+1 for i, log in enumerate(combined_unique_logs)}
            
# #             # Fill in data from top dataset
# #             for log in toplogs:
# #                 if log in merged_col_indices:
# #                     # Find indices of depths in the merged array that match depths in the top array
# #                     top_depths = self.flexlog.XY[:, 0]
# #                     for i, depth in enumerate(top_depths):
# #                         merged_idx = np.where(merged_data[:, 0] == depth)[0]
# #                         if len(merged_idx) > 0:
# #                             merged_data[merged_idx[0], merged_col_indices[log]] = self.flexlog.XY[i, top_col_indices[log]]
            
# #             # Fill in data from bottom dataset (only where top data is NaN or doesn't exist)
# #             for log in botlogs:
# #                 if log in merged_col_indices:
# #                     # Find indices of depths in the merged array that match depths in the bottom array
# #                     bot_depths = botlatlas.flexLogCurves.XY[:, 0] - delaybottom
# #                     for i, depth in enumerate(bot_depths):
# #                         merged_idx = np.where(merged_data[:, 0] == depth)[0]
# #                         if len(merged_idx) > 0:
# #                             merged_idx = merged_idx[0]
# #                             # Only fill if top data is NaN or we're beyond the top dataset's range
# #                             if log not in toplogs or np.isnan(merged_data[merged_idx, merged_col_indices[log]]):
# #                                 merged_data[merged_idx, merged_col_indices[log]] = botlatlas.flexLogCurves.XY[i, bot_col_indices[log]]
            
# #             # Update the flexlog with merged data
# #             self.flexlog = FlexLogCurves(merged_data, combined_unique_logs,
# #                                          contributing_files=self.contributing_input_files.union(botlatlas.contributing_input_files),
# #                                          curve_origins=self.curve_origins)
            
# #             # Update curve origins from bottom dataset
# #             for key, origins in botlatlas.curve_origins.items():
# #                 if key not in self.curve_origins:
# #                     self.curve_origins[key] = []
                
# #                 # Add only unique origins
# #                 existing = {(origin['input_file'], origin['curve']) for origin in self.curve_origins.get(key, [])}
# #                 for origin in origins:
# #                     if (origin['input_file'], origin['curve']) not in existing:
# #                         self.curve_origins[key].append(origin)
            
# #             self.uniqueLogs = combined_unique_logs
# #             print('    Final Unique Logs: {}'.format(self.uniqueLogs))
# #             print('    Final XY Shape: {}'.format(self.flexlog.XY.shape))
            
# #         except Exception as e:
# #             print(f"Error in extend method: {e}")
# #             import traceback
# #             traceback.print_exc()

# #     def doSplicing(self, sampling_inteval):
# #         print("Splicing starts....")
# #         self.sampling_int = sampling_inteval
# #         try:
# #             min_depth, max_depth = self.flexlog.XY[0, 0], self.flexlog.XY[-1, 0]
# #             if np.isnan(min_depth) or np.isnan(max_depth) or min_depth >= max_depth:
# #                 print(f"Warning: Invalid depth range [{min_depth}, {max_depth}]. Returning original data.")
# #                 self.spliced_logs = self.flexlog.XY
# #             else:
# #                 if hasattr(self.flexlog, 'getSplicedLog') and callable(self.flexlog.getSplicedLog):
# #                     self.spliced_logs = self.flexlog.getSplicedLog(logstep=self.sampling_int)
# #                 else:
# #                     print("Error: flexlog object missing 'getSplicedLog' method.")
# #                     self.spliced_logs = self.flexlog.XY
# #         except Exception as e:
# #             print(f"Error during splicing: {e}")
# #             self.spliced_logs = self.flexlog.XY
            
# #         # Ensure the output has the correct number of columns
# #         expected_columns = len(self.uniqueLogs) + 1  # +1 for depth column
# #         actual_columns = self.spliced_logs.shape[1]
# #         if expected_columns != actual_columns:
# #             print(f"Warning: Unique logs count ({len(self.uniqueLogs)}) and spliced data columns ({actual_columns-1}) mismatch.")
# #             if actual_columns > expected_columns:
# #                 print("Truncating extra columns.")
# #                 self.spliced_logs = self.spliced_logs[:, :expected_columns]
# #             elif actual_columns < expected_columns:
# #                 print("Extending with NaN columns.")
# #                 missing_columns = expected_columns - actual_columns
# #                 num_rows = self.spliced_logs.shape[0]
# #                 nan_cols = np.full((num_rows, missing_columns), np.nan)
# #                 self.spliced_logs = np.hstack((self.spliced_logs, nan_cols))
# #             print(f"Adjusted spliced_logs shape: {self.spliced_logs.shape}")
# #         print('Splicing Completes....')

# #     def export(self, filepath):
# #         print("Exporting starts....")
# #         print("Unique Logs:", self.uniqueLogs, "Spliced Shape:", self.spliced_logs.shape)
# #         las_export(self.spliced_logs, self.uniqueLogs, filepath)
# #         print(f"Export success. LAS file created at {filepath}")
        
# #     def get_detailed_provenance(self):
# #         """Returns detailed provenance information for the spliced logs"""
# #         # Collect input files
# #         input_files = []
# #         if hasattr(self, 'contributing_input_files'):
# #             input_files = sorted(list(self.contributing_input_files))
        
# #         # Collect curve mapping
# #         curve_mapping = {}
# #         if hasattr(self, 'uniqueLogs') and hasattr(self, 'curve_origins'):
# #             for log_type in self.uniqueLogs:
# #                 if log_type in self.curve_origins:
# #                     curve_mapping[log_type] = self.curve_origins[log_type]
# #                 else:
# #                     curve_mapping[log_type] = []
        
# #         # Build final provenance data structure
# #         return {
# #             'input_files': input_files,
# #             'output_curve_mapping': curve_mapping
# #         }


# # # ============================================================================
# # # SuitSplice: Merges lateral and vertical results and finally saves provenance.
# # # ============================================================================
# # class SuitSplice():
# #     def __init__(self, suits, params):
# #         self.filepaths = []
# #         self.resultLas = VerticalLas(params=params)
# #         self.suits = suits
# #         self.laterallases = []
# #         self.curve_origins = {}
# #         self.input_files = set()
# #         self.params = params
# #         for i in self.suits:
# #             print(f'Processing Suit Index: {i}')
# #             suit_data = self.suits[i]
# #             if isinstance(suit_data, dict) and suit_data:
# #                 print('Lateral Merging...')
# #                 self.laterallas = LateralLas(suit_data, params=self.params)
# #                 print("*************************************************************")
# #                 for key in self.laterallas.curve_origins:
# #                     if key not in self.curve_origins:
# #                         self.curve_origins[key] = []
# #                     self.curve_origins[key].extend(self.laterallas.curve_origins[key])
# #                     self.input_files.update(self.laterallas.contributing_input_files)
# #                 print(f"self.curve_origins: {self.curve_origins}")
# #                 print("*************************************************************")
# #                 if hasattr(self.laterallas, 'flexLogCurves'):
# #                     print('Vertical Merging...')
# #                     self.resultLas.extend(self.laterallas, delaybottom=0)
# #                     print(f'Logs after merging suit {i}: {self.resultLas.uniqueLogs}')
# #                     print(f'Shape of XYY matrix after suit {i}: {self.resultLas.flexlog.XY.shape}')
# #                 else:
# #                     print(f"Skipping vertical merge for suit {i} - No valid flexLogCurves.")
# #             else:
# #                 print(f"Warning: Suit index {i} has invalid or empty data. Skipping.")

# #     def get_spliced_curve_mnemonics(self):
# #         if hasattr(self.resultLas, 'uniqueLogs'):
# #             return list(self.resultLas.uniqueLogs)
# #         else:
# #             return []

# #     def get_provenance_data(self):
# #         if hasattr(self.resultLas, 'contributing_input_files') and hasattr(self, 'curve_origins'):
# #             return {
# #                 'input_files': list(self.input_files),
# #                 'output_curves': self.curve_origins
# #             }
# #         return {'input_files': [], 'output_curves': {}}

# #     def save_provenance(self, filepath):
# #         provenance_data = self.get_provenance_data()
# #         provenance_filepath = filepath.replace('.las', '_provenance.json')
# #         try:
# #             with open(provenance_filepath, 'w') as f:
# #                 json.dump(provenance_data, f, indent=2)
# #             print(f'Provenance data saved to {provenance_filepath}')
# #             return True
# #         except Exception as e:
# #             print(f'Error saving provenance data: {e}')
# #             return False

# #     def export(self, filepath, sampling_inteval):
# #         print(f"Starting export with sampling interval {sampling_inteval}...")
# #         self.resultLas.doSplicing(sampling_inteval)
# #         self.resultLas.export(filepath)
# #         self.save_provenance(filepath)
# #         print(f"Export complete! LAS file and provenance data created at {filepath} and corresponding provenance file.")
    
# # def read_params():
# #     try:
# #         with open(autosplice_params_file_path, 'r') as file:
# #             params = json.load(file)
# #         params['equal_val_allowed_width'] = int(params['equal_val_allowed_width'])
# #         params['export_sampling_interval'] = float(params['export_sampling_interval'])
# #         params['hist_bins'] = int(params['hist_bins'])
# #         params['n_big_patches'] = int(params['n_big_patches'])
# #         params['nan_patches_gap_ignored'] = int(params['nan_patches_gap_ignored'])
# #         return params
# #     except FileNotFoundError:
# #         print(f"Warning: Parameter file not found. Using defaults.")
# #         return {
# #             'equal_val_allowed_width': 3,
# #             'export_sampling_interval': 0.1524,
# #             'hist_bins': 100,
# #             'n_big_patches': 1,
# #             'nan_patches_gap_ignored': 20
# #         }
# #     except KeyError as e:
# #         print(f"Error: Missing key {e} in parameter file.")
# #         raise
# #     except (ValueError, TypeError) as e:
# #         print(f"Error: Invalid value type in parameter file: {e}")
# #         raise


# import lasio
# import os
# import time, json
# import numpy as np
# import logging
# from utils.SuitSplice.correlationNsplice import las_export
# from utils.categorize_v2 import LogCategorize
# from utils.helper import *
# from utils.SuitSplice.flex import FlexLogCurves
# from utils.loggy_settings import *
# from utils.LasTree import get_txtdict
# from utils.SuitSplice.Filters import hist_filter
# from utils.SuitSplice.manage_data_gaps import ZonalArray, updateTopXY, find_datazone_in_bottomrun

# # ============================================================================
# # A Simple Writer Class for Logging (unchanged)
# # ============================================================================
# class writer:
#     def __init__(self, *writers):
#         self.writers = writers

#     def write(self, text):
#         for w in self.writers:
#             w.write(text)

# def drangestrprint(optstr, dr):
#     try:
#         dr = np.array(dr, dtype=float)
#         if dr.size < 2:
#             print(f"{optstr} Invalid range data (size < 2)")
#             return
#         min_depth = dr[0]
#         max_depth = dr[-1]
#         if np.isnan(min_depth) or np.isnan(max_depth) or min_depth >= max_depth:
#             print(f"{optstr} {min_depth:.2f} -- {max_depth:.2f} (Invalid/NaN Range)")
#             return
#         st = min_depth / 50
#         en = max_depth / 50
#         num_dashes = max(0, int(en - st))
#         dash_str = '-' * num_dashes
#         field_width = 10 + int(st)
#         print(f"{optstr}{min_depth:{field_width}.2f}{dash_str}{max_depth:4.2f}")
#     except Exception as e:
#         print(f"{optstr} Error formatting range {dr}: {e}")

# # ============================================================================
# # LateralLas: Reads LAS files and collects provenance.
# # ============================================================================
# class LateralLas():
#     def __init__(self, suit, params):
#         self.hist_bins = int(params.get('hist_bins', 100))
#         self.n_big_patches = int(params.get('n_big_patches', 1))
#         self.equal_val_allowed_width = int(params.get('equal_val_allowed_width', 3))
#         self.curvetypesavoided = []
#         self.depthcol_name = 'DEPTH'
#         self.type_dict = get_txtdict(mnemonicsfile, delimiter=' ')
#         self.lc = LogCategorize(mnemonicsfile)
#         # Provenance attributes:
#         self.contributing_input_files = set()
#         self.curve_origins = {}
#         self.flexLogCurves = None
        
#         for i, l in enumerate(suit):
#             if isinstance(suit[l], dict) and 'path' in suit[l]:
#                 file_path = suit[l]['path']
#                 if os.path.isfile(file_path):
#                     filename_base = os.path.basename(file_path)
#                     print(f'    {i}.{filename_base}  ', end='|')
#                     self.ttle = l
#                     self.initiateLassing(file_path)
#                     if hasattr(self, 'XYY') and self.XYY is not None and self.XYY.shape[0] > 0 and self.XYY.shape[1] > 1:
#                         self.contributing_input_files.add(filename_base)
#                         for logname, log_cate in zip(self.interestedLognames, self.interestedKeynames):
#                             if log_cate not in self.curve_origins:
#                                 self.curve_origins[log_cate] = []
#                             self.curve_origins[log_cate].append({
#                                 'input_file': filename_base,
#                                 'curve': logname
#                             })
#                     else:
#                         print(f"Warning: No valid data found in file {filename_base}")
#                 else:
#                     print(f"Warning: File path does not exist: {file_path}")
#             else:
#                 print(f"Warning: Unexpected structure for suit item {l}: {suit[l]}")
    
#     def initiateLassing(self, path):
#         try:
#             self.las = lasio.read(path)
#             self.lc.set_las(self.las)
#             self.lc.lasCategorize()      
#             self.interestedKeynames = self.lc.get_catePresent()
#             self.interestedLognames = self.lc.getLogsPresent()

#             print('  ({}) -- ({})'.format('|'.join(self.interestedKeynames), '|'.join(self.interestedLognames)))
#             dcol = self.las.keys()[find_depth_indx(self.las)]
#             self.XYY = self.las[dcol]
            
#             if len(self.XYY) < 1 or isinstance(self.XYY[0], str):
#                 print('Corrupt file unable to process')
#                 return
                
#             # Making XYY and cleaning it
#             self.makeXYY()
#             drangestrprint('    Depth : ', [self.XYY[0, 0], self.XYY[-1, 0]])

#             # Despiking
#             self.applyfiltOnXYY(n_big_patches=self.n_big_patches, hist_bins=self.hist_bins)
            
#             # Processing for straight linear data patches
#             for i in range(1, len(self.XYY[0, :])):
#                 za = ZonalArray(self.XYY[:, i])
#                 self.XYY[:, i] = za.makeequalsNan(equal_val_allowed_width=self.equal_val_allowed_width)

#             if hasattr(self, 'flexLogCurves') and self.flexLogCurves is not None:
#                 self.flexLogCurves.sameSuitAppend(self.XYY, self.YcolNames)
#             else:
#                 self.flexLogCurves = FlexLogCurves(self.XYY, self.YcolNames)
                
#         except Exception as e:
#             print(f"Error reading LAS file: {e}")
#             import traceback
#             traceback.print_exc()
#             self.XYY = np.array([[0, 0]])
#             self.YcolNames = []

#     def makeXYY(self):
#         self.YcolNames = []
#         for logname, log_cate in zip(self.interestedLognames, self.interestedKeynames):
#             if log_cate not in self.curvetypesavoided:
#                 self.YcolNames.append(log_cate)
#                 try:
#                     self.XYY = np.column_stack((self.XYY, self.las[logname]))
#                 except Exception as e:
#                     print(f"Error adding curve {logname}: {e}")
#                     # Add NaN column instead
#                     self.XYY = np.column_stack((self.XYY, np.full(self.XYY.shape[0], np.nan)))
        
#         # Sort by depth and remove NaN depths
#         indxes = np.argsort(self.XYY[:, 0])
#         self.XYY = self.XYY[indxes, :]
#         self.XYY = self.XYY[~np.isnan(self.XYY[:, 0]), :]

#     def applyfiltOnXYY(self, n_big_patches=1, hist_bins=100):
#         for j, log_cate in enumerate(self.YcolNames):
#             try:
#                 logdata = self.XYY[:, j+1].copy()
#                 # Skip if all values are NaN
#                 if np.all(np.isnan(logdata)):
#                     continue
                    
#                 if self.lc.isResistivityCurve(log_cate):
#                     # Avoid log(0) by replacing zeros with small value
#                     logdata[logdata <= 0] = 0.001
#                     logdata = np.log10(logdata)
                
#                 res = hist_filter(logdata, n_big_patches=n_big_patches, hist_bins=hist_bins)
                
#                 if self.lc.isResistivityCurve(log_cate):
#                     res = np.power(10, res)
                
#                 self.XYY[:, j+1] = res
#             except Exception as e:
#                 print(f"Error filtering curve {log_cate}: {e}")

# # ============================================================================
# # VerticalLas: Merges lateral results into a vertical (spliced) LAS.
# # Provenance information is passed from lateral to vertical merging.
# # ============================================================================
# class VerticalLas():
#     def __init__(self, XY=np.array([[0, 0]]), YKeys=[], params={'nan_patches_gap_ignored': 20}):
#         self.min_data_gap_allowed = params.get('nan_patches_gap_ignored', 20)
#         self.contributing_input_files = set()
#         self.curve_origins = {}
#         self.flexlog = FlexLogCurves(XY, YKeys,
#                                      contributing_files=self.contributing_input_files,
#                                      curve_origins=self.curve_origins)
#         self.uniqueLogs = np.array(YKeys)

#     def extend(self, botlatlas, delaybottom=0):
#         try:
#             # Check if bottom dataset has valid data
#             if not hasattr(botlatlas, 'flexLogCurves') or botlatlas.flexLogCurves is None:
#                 print("    Bottom dataset has no valid data. Skipping merge.")
#                 return
                
#             trows, tcols = self.flexlog.XY.shape
#             brows, bcols = botlatlas.flexLogCurves.XY.shape
            
#             print('    Result Suit so far .....', end='|')
#             print(' (rows,cols): ({}, {}) | Logs: {}'.format(trows, tcols, '-'.join(self.uniqueLogs)))
#             drangestrprint('      Depth : ', self.flexlog.XY[[0, -1], 0])
            
#             print('    Present suit............', end='|')
#             print(' (rows,cols): ({}, {}) | Logs: {}'.format(brows, bcols, '-'.join(botlatlas.flexLogCurves.YKeys)))
#             drangestrprint('      Depth : ', botlatlas.flexLogCurves.XY[[0, -1], 0])
            
#             # If this is the first dataset, just initialize with it
#             if trows < 3:
#                 print("    Initializing VerticalLas with bottom suite data.")
#                 self.flexlog = FlexLogCurves(botlatlas.flexLogCurves.XY.copy(),
#                                             botlatlas.flexLogCurves.YKeys.copy(),
#                                             contributing_files=set(botlatlas.contributing_input_files),
#                                             curve_origins=botlatlas.curve_origins.copy())
#                 self.uniqueLogs = np.array(botlatlas.flexLogCurves.YKeys)
#                 self.contributing_input_files.update(botlatlas.contributing_input_files)
                
#                 # Update curve origins
#                 for key, origins in botlatlas.curve_origins.items():
#                     if key not in self.curve_origins:
#                         self.curve_origins[key] = []
#                     self.curve_origins[key].extend(origins)
#                 return
            
#             # Prepare for merging
#             toplogs = np.array(self.uniqueLogs)
#             botlogs = np.array(botlatlas.flexLogCurves.YKeys)
#             print('  Top Logs: {} \n  Bot Logs: {}'.format(toplogs, botlogs))
#             print('  <<<<<<<<<<<<<<<   Merging   <<<<<<<<<<<<<<<<<')
#             combined_unique_logs = np.unique(np.append(toplogs, botlogs))
#             print('  Combined Unique Logs: {}'.format(combined_unique_logs))
            
#             # Get depth ranges for determining overlap
#             top_min_depth = self.flexlog.XY[0, 0]
#             top_max_depth = self.flexlog.XY[-1, 0]
#             bot_min_depth = botlatlas.flexLogCurves.XY[0, 0] - delaybottom
#             bot_max_depth = botlatlas.flexLogCurves.XY[-1, 0] - delaybottom
            
#             # Create new merged dataset with all curves
#             new_depth_range = np.unique(np.concatenate((self.flexlog.XY[:, 0], 
#                                                       botlatlas.flexLogCurves.XY[:, 0] - delaybottom)))
#             new_depth_range = np.sort(new_depth_range)
            
#             # Create a new array with NaN values for all curves
#             merged_data = np.full((len(new_depth_range), len(combined_unique_logs) + 1), np.nan)
#             merged_data[:, 0] = new_depth_range  # Set depth column
            
#             # Create mapping from curve name to column index
#             merged_col_indices = {log: i+1 for i, log in enumerate(combined_unique_logs)}
            
#             # Fill in data from top dataset
#             for i, depth in enumerate(self.flexlog.XY[:, 0]):
#                 merged_idx = np.where(merged_data[:, 0] == depth)[0]
#                 if len(merged_idx) > 0:
#                     merged_idx = merged_idx[0]
#                     for j, log in enumerate(toplogs):
#                         if j+1 < self.flexlog.XY.shape[1]:  # Ensure column exists
#                             merged_data[merged_idx, merged_col_indices[log]] = self.flexlog.XY[i, j+1]
            
#             # Fill in data from bottom dataset (only where top data is NaN or doesn't exist)
#             bot_depths = botlatlas.flexLogCurves.XY[:, 0] - delaybottom
#             for i, depth in enumerate(bot_depths):
#                 merged_idx = np.where(merged_data[:, 0] == depth)[0]
#                 if len(merged_idx) > 0:
#                     merged_idx = merged_idx[0]
#                     for j, log in enumerate(botlogs):
#                         if j+1 < botlatlas.flexLogCurves.XY.shape[1]:  # Ensure column exists
#                             col_idx = merged_col_indices[log]
#                             # Only fill if top data is NaN or we're beyond the top dataset's range
#                             if np.isnan(merged_data[merged_idx, col_idx]) or depth > top_max_depth:
#                                 merged_data[merged_idx, col_idx] = botlatlas.flexLogCurves.XY[i, j+1]
            
#             # Update the flexlog with merged data
#             self.flexlog = FlexLogCurves(merged_data, combined_unique_logs.tolist())
#             self.uniqueLogs = combined_unique_logs
            
#             # Update contributing files and curve origins
#             self.contributing_input_files.update(botlatlas.contributing_input_files)
            
#             # Update curve origins from bottom dataset
#             for key, origins in botlatlas.curve_origins.items():
#                 if key not in self.curve_origins:
#                     self.curve_origins[key] = []
                
#                 # Add only unique origins
#                 existing = {(origin['input_file'], origin['curve']) for origin in self.curve_origins.get(key, [])}
#                 for origin in origins:
#                     if (origin['input_file'], origin['curve']) not in existing:
#                         self.curve_origins[key].append(origin)
            
#             print('    Final Unique Logs: {}'.format(self.uniqueLogs))
#             print('    Final XY Shape: {}'.format(self.flexlog.XY.shape))
            
#         except Exception as e:
#             print(f"Error in extend method: {e}")
#             import traceback
#             traceback.print_exc()

#     def doSplicing(self, sampling_interval):
#         print("Splicing starts....")
#         self.sampling_int = sampling_interval
#         try:
#             min_depth, max_depth = self.flexlog.XY[0, 0], self.flexlog.XY[-1, 0]
#             if np.isnan(min_depth) or np.isnan(max_depth) or min_depth >= max_depth:
#                 print(f"Warning: Invalid depth range [{min_depth}, {max_depth}]. Returning original data.")
#                 self.spliced_logs = self.flexlog.XY
#             else:
#                 if hasattr(self.flexlog, 'getSplicedLog') and callable(self.flexlog.getSplicedLog):
#                     self.spliced_logs = self.flexlog.getSplicedLog(logstep=self.sampling_int)
#                 else:
#                     print("Error: flexlog object missing 'getSplicedLog' method.")
#                     self.spliced_logs = self.flexlog.XY
#         except Exception as e:
#             print(f"Error during splicing: {e}")
#             import traceback
#             traceback.print_exc()
#             self.spliced_logs = self.flexlog.XY
            
#         # Ensure the output has the correct number of columns
#         expected_columns = len(self.uniqueLogs) + 1  # +1 for depth column
#         actual_columns = self.spliced_logs.shape[1]
#         if expected_columns != actual_columns:
#             print(f"Warning: Column count mismatch. Expected {expected_columns}, got {actual_columns}.")
#             if actual_columns > expected_columns:
#                 print(f"Truncating extra columns from {actual_columns} to {expected_columns}.")
#                 self.spliced_logs = self.spliced_logs[:, :expected_columns]
#             elif actual_columns < expected_columns:
#                 print(f"Adding {expected_columns - actual_columns} NaN columns.")
#                 missing_columns = expected_columns - actual_columns
#                 num_rows = self.spliced_logs.shape[0]
#                 nan_cols = np.full((num_rows, missing_columns), np.nan)
#                 self.spliced_logs = np.hstack((self.spliced_logs, nan_cols))
#             print(f"Adjusted spliced_logs shape: {self.spliced_logs.shape}")
#         print('Splicing Completes....')

#     def export(self, filepath):
#         print("Exporting starts....")
#         print("Unique Logs:", self.uniqueLogs, "Spliced Shape:", self.spliced_logs.shape)
#         try:
#             las_export(self.spliced_logs, self.uniqueLogs, filepath)
#             print(f"Export success. LAS file created at {filepath}")
#         except Exception as e:
#             print(f"Error during export: {e}")
#             import traceback
#             traceback.print_exc()
        
#     def get_detailed_provenance(self):
#         """Returns detailed provenance information for the spliced logs"""
#         # Collect input files
#         input_files = []
#         if hasattr(self, 'contributing_input_files'):
#             input_files = sorted(list(self.contributing_input_files))
        
#         # Collect curve mapping
#         curve_mapping = {}
#         if hasattr(self, 'uniqueLogs') and hasattr(self, 'curve_origins'):
#             for log_type in self.uniqueLogs:
#                 if log_type in self.curve_origins:
#                     curve_mapping[log_type] = self.curve_origins[log_type]
#                 else:
#                     curve_mapping[log_type] = []
        
#         # Build final provenance data structure
#         return {
#             'input_files': input_files,
#             'output_curve_mapping': curve_mapping
#         }

# # ============================================================================
# # SuitSplice: Merges lateral and vertical results and finally saves provenance.
# # ============================================================================
# class SuitSplice():
#     def __init__(self, suits, params):
#         self.filepaths = []
#         self.resultLas = VerticalLas(params=params)
#         self.suits = suits
#         self.laterallases = []
#         self.curve_origins = {}
#         self.input_files = set()
#         self.params = params
        
#         for i in self.suits:
#             print(f'Processing Suit Index: {i}')
#             suit_data = self.suits[i]
#             if isinstance(suit_data, dict) and suit_data:
#                 print('Lateral Merging...')
#                 try:
#                     self.laterallas = LateralLas(suit_data, params=self.params)
                    
#                     # Update provenance information
#                     if hasattr(self.laterallas, 'contributing_input_files'):
#                         self.input_files.update(self.laterallas.contributing_input_files)
                    
#                     if hasattr(self.laterallas, 'curve_origins'):
#                         for key, origins in self.laterallas.curve_origins.items():
#                             if key not in self.curve_origins:
#                                 self.curve_origins[key] = []
#                             self.curve_origins[key].extend(origins)
                    
#                     # Proceed with vertical merging if we have valid data
#                     if hasattr(self.laterallas, 'flexLogCurves') and self.laterallas.flexLogCurves is not None:
#                         print('Vertical Merging...')
#                         self.resultLas.extend(self.laterallas, delaybottom=0)
#                         print(f'Logs after merging suit {i}: {self.resultLas.uniqueLogs}')
#                         print(f'Shape of XYY matrix after suit {i}: {self.resultLas.flexlog.XY.shape}')
#                     else:
#                         print(f"Skipping vertical merge for suit {i} - No valid flexLogCurves.")
#                 except Exception as e:
#                     print(f"Error processing suit {i}: {e}")
#                     import traceback
#                     traceback.print_exc()
#             else:
#                 print(f"Warning: Suit index {i} has invalid or empty data. Skipping.")

#     def get_spliced_curve_mnemonics(self):
#         if hasattr(self.resultLas, 'uniqueLogs'):
#             return list(self.resultLas.uniqueLogs)
#         else:
#             return []

#     def get_provenance_data(self):
#         return {
#             'input_files': sorted(list(self.input_files)),
#             'output_curves': self.curve_origins
#         }

#     def save_provenance(self, filepath):
#         provenance_data = self.get_provenance_data()
#         provenance_filepath = filepath.replace('.las', '_provenance.json')
#         try:
#             with open(provenance_filepath, 'w') as f:
#                 json.dump(provenance_data, f, indent=2)
#             print(f'Provenance data saved to {provenance_filepath}')
#             return True
#         except Exception as e:
#             print(f'Error saving provenance data: {e}')
#             return False

#     def export(self, filepath, sampling_interval):
#         print(f"Starting export with sampling interval {sampling_interval}...")
#         try:
#             self.resultLas.doSplicing(sampling_interval)
#             self.resultLas.export(filepath)
#             self.save_provenance(filepath)
#             print(f"Export complete! LAS file and provenance data created at {filepath} and corresponding provenance file.")
#         except Exception as e:
#             print(f"Error during export: {e}")
#             import traceback
#             traceback.print_exc()
    
# def read_params():
#     try:
#         with open(autosplice_params_file_path, 'r') as file:
#             params = json.load(file)
#         params['equal_val_allowed_width'] = int(params.get('equal_val_allowed_width', 3))
#         params['export_sampling_interval'] = float(params.get('export_sampling_interval', 0.1524))
#         params['hist_bins'] = int(params.get('hist_bins', 100))
#         params['n_big_patches'] = int(params.get('n_big_patches', 1))
#         params['nan_patches_gap_ignored'] = int(params.get('nan_patches_gap_ignored', 20))
#         return params
#     except FileNotFoundError:
#         print(f"Warning: Parameter file not found at {autosplice_params_file_path}. Using defaults.")
#         return {
#             'equal_val_allowed_width': 3,
#             'export_sampling_interval': 0.1524,
#             'hist_bins': 100,
#             'n_big_patches': 1,
#             'nan_patches_gap_ignored': 20
#         }
#     except Exception as e:
#         print(f"Error reading parameter file: {e}")
#         return {
#             'equal_val_allowed_width': 3,
#             'export_sampling_interval': 0.1524,
#             'hist_bins': 100,
#             'n_big_patches': 1,
#             'nan_patches_gap_ignored': 20
#         }
import lasio
import os
import time
import json
import numpy as np
import logging

from utils.SuitSplice.correlationNsplice import las_export
from utils.categorize_v2 import LogCategorize
from utils.helper import *
from utils.SuitSplice.flex import FlexLogCurves
from utils.loggy_settings import *
from utils.LasTree import get_txtdict
from utils.SuitSplice.Filters import hist_filter
from utils.SuitSplice.manage_data_gaps import ZonalArray, updateTopXY, find_datazone_in_bottomrun

# ============================================================================ 
# A Simple Writer Class for Logging (unchanged)
# ============================================================================ 
class writer:
    def __init__(self, *writers):
        self.writers = writers

    def write(self, text):
        for w in self.writers:
            w.write(text)

def drangestrprint(optstr, dr):
    try:
        dr = np.array(dr, dtype=float)
        if dr.size < 2:
            print(f"{optstr} Invalid range data (size < 2)")
            return
        min_depth, max_depth = dr[0], dr[-1]
        if np.isnan(min_depth) or np.isnan(max_depth) or min_depth >= max_depth:
            print(f"{optstr} {min_depth:.2f} -- {max_depth:.2f} (Invalid/NaN Range)")
            return
        st, en = min_depth / 50, max_depth / 50
        num_dashes = max(0, int(en - st))
        dash_str = '-' * num_dashes
        field_width = 10 + int(st)
        print(f"{optstr}{min_depth:{field_width}.2f}{dash_str}{max_depth:4.2f}")
    except Exception as e:
        print(f"{optstr} Error formatting range {dr}: {e}")

# ============================================================================ 
# LateralLas: Reads LAS files and collects provenance.
# ============================================================================ 
class LateralLas():
    def __init__(self, suit, params):
        self.hist_bins = int(params.get('hist_bins', 100))
        self.n_big_patches = int(params.get('n_big_patches', 1))
        self.equal_val_allowed_width = int(params.get('equal_val_allowed_width', 3))
        self.curvetypesavoided = []
        self.depthcol_name = 'DEPTH'
        self.type_dict = get_txtdict(mnemonicsfile, delimiter=' ')
        self.lc = LogCategorize(mnemonicsfile)

        # Provenance
        self.contributing_input_files = set()
        self.curve_origins = {}
        self.flexLogCurves = None

        for i, l in enumerate(suit):
            suit_item = suit[l]
            if isinstance(suit_item, dict) and 'path' in suit_item:
                file_path = suit_item['path']
                if os.path.isfile(file_path):
                    filename_base = os.path.basename(file_path)
                    print(f'    {i}.{filename_base}  ', end='|')
                    self.initiateLassing(file_path)
                    if getattr(self, 'XYY', None) is not None and self.XYY.shape[1] > 1:
                        self.contributing_input_files.add(filename_base)
                        for logname, log_cate in zip(self.interestedLognames, self.interestedKeynames):
                            self.curve_origins.setdefault(log_cate, []).append({
                                'input_file': filename_base,
                                'curve': logname
                            })
                    else:
                        print(f"Warning: No valid data found in file {filename_base}")
                else:
                    print(f"Warning: File path does not exist: {file_path}")
            else:
                print(f"Warning: Unexpected structure for suit item {l}: {suit_item}")

    def initiateLassing(self, path):
        try:
            self.las = lasio.read(path)
            self.lc.set_las(self.las)
            self.lc.lasCategorize()
            self.interestedKeynames = self.lc.get_catePresent()
            self.interestedLognames = self.lc.getLogsPresent()

            print('  ({}) -- ({})'.format(
                '|'.join(self.interestedKeynames),
                '|'.join(self.interestedLognames)
            ))

            # Initialize XYY with depth column only
            depth_idx = find_depth_indx(self.las)
            depth_curve = np.array(self.las[self.las.keys()[depth_idx]])
            self.XYY = depth_curve.reshape(-1, 1)

            if len(self.XYY) < 1 or isinstance(self.XYY[0, 0], str):
                print('Corrupt file unable to process')
                return

            # Build the full array
            self.makeXYY()
            drangestrprint('    Depth : ', [self.XYY[0, 0], self.XYY[-1, 0]])

            # Despiking
            self.applyfiltOnXYY(n_big_patches=self.n_big_patches, hist_bins=self.hist_bins)

            # Handle equal‑value patches
            for col in range(1, self.XYY.shape[1]):
                za = ZonalArray(self.XYY[:, col])
                self.XYY[:, col] = za.makeequalsNan(
                    equal_val_allowed_width=self.equal_val_allowed_width
                )

            # Append or initialize FlexLogCurves
            if self.flexLogCurves is not None:
                self.flexLogCurves.sameSuitAppend(self.XYY, self.YcolNames)
            else:
                self.flexLogCurves = FlexLogCurves(self.XYY, self.YcolNames)

        except Exception as e:
            print(f"Error reading LAS file: {e}")
            import traceback; traceback.print_exc()
            # Fallback minimal array
            self.XYY = np.array([[0, 0]])
            self.YcolNames = []

    def makeXYY(self):
        data_array = self.XYY.copy()
        self.YcolNames = []

        for logname, log_cate in zip(self.interestedLognames, self.interestedKeynames):
            if log_cate in self.curvetypesavoided:
                continue

            self.YcolNames.append(log_cate)
            try:
                curve_data = np.array(self.las[logname])
                if len(curve_data) != len(data_array):
                    print(f"Warning: Length mismatch for {logname}: "
                          f"expected {len(data_array)}, got {len(curve_data)}.")
                    curve_data = np.full(len(data_array), np.nan)
                data_array = np.column_stack((data_array, curve_data))
            except Exception as e:
                print(f"Error adding curve {logname}: {e}")
                data_array = np.column_stack((
                    data_array, np.full(len(data_array), np.nan)
                ))

        # Sort by depth and remove NaN depths
        order = np.argsort(data_array[:, 0])
        data_array = data_array[order]
        data_array = data_array[~np.isnan(data_array[:, 0])]

        self.XYY = data_array

    def applyfiltOnXYY(self, n_big_patches=1, hist_bins=100):
        for j, log_cate in enumerate(self.YcolNames):
            try:
                col_data = self.XYY[:, j+1].copy()
                if np.all(np.isnan(col_data)):
                    continue

                if self.lc.isResistivityCurve(log_cate):
                    col_data[col_data <= 0] = 0.001
                    col_data = np.log10(col_data)

                filtered = hist_filter(col_data, n_big_patches=n_big_patches, hist_bins=hist_bins)

                if self.lc.isResistivityCurve(log_cate):
                    filtered = np.power(10, filtered)

                self.XYY[:, j+1] = filtered
            except Exception as e:
                print(f"Error filtering curve {log_cate}: {e}")

# ============================================================================ 
# VerticalLas: Merges lateral results into a vertical (spliced) LAS.
# ============================================================================ 
class VerticalLas():
    def __init__(self, XY=np.array([[0, 0]]), YKeys=[], params={'nan_patches_gap_ignored': 20}):
        self.min_data_gap_allowed = params.get('nan_patches_gap_ignored', 20)
        self.contributing_input_files = set()
        self.curve_origins = {}
        self.flexlog = FlexLogCurves(
            XY, YKeys,
            contributing_files=self.contributing_input_files,
            curve_origins=self.curve_origins
        )
        self.uniqueLogs = np.array(YKeys)

    def extend(self, botlatlas, delaybottom=0):
        try:
            bottom = getattr(botlatlas, 'flexLogCurves', None)
            if bottom is None or bottom.XY.shape[0] < 2:
                print("    Bottom dataset has no valid data. Skipping merge.")
                return

            topXY = self.flexlog.XY
            botXY = bottom.XY.copy()
            botXY[:, 0] -= delaybottom

            tlogs, blogs = self.uniqueLogs, bottom.YKeys
            print(f'    Merging Top Logs: {tlogs} with Bot Logs: {blogs}')

            # Combine and sort unique depths
            merged_depths = np.unique(np.concatenate((topXY[:, 0], botXY[:, 0])))
            merged_depths.sort()

            # Combined logs
            combined = np.unique(np.concatenate((tlogs, blogs)))
            merged = np.full((len(merged_depths), len(combined)+1), np.nan)
            merged[:, 0] = merged_depths

            # Map columns
            top_map = {log: i+1 for i, log in enumerate(tlogs)}
            bot_map = {log: i+1 for i, log in enumerate(blogs)}
            merged_map = {log: i+1 for i, log in enumerate(combined)}

            # Fill from top first
            for i, d in enumerate(merged_depths):
                idxs = np.where(np.isclose(topXY[:, 0], d))[0]
                if idxs.size:
                    row = topXY[idxs[0]]
                    for log in tlogs:
                        merged[i, merged_map[log]] = row[top_map[log]]

            # Then fill from bottom where needed
            for i, d in enumerate(merged_depths):
                idxs = np.where(np.isclose(botXY[:, 0], d))[0]
                if idxs.size:
                    row = botXY[idxs[0]]
                    for log in blogs:
                        col = merged_map[log]
                        if np.isnan(merged[i, col]) or d < topXY[0, 0] or d > topXY[-1, 0]:
                            merged[i, col] = row[bot_map[log]]

            # Update flexlog
            self.flexlog = FlexLogCurves(
                merged, combined.tolist(),
                contributing_files=self.contributing_input_files,
                curve_origins=self.curve_origins
            )
            self.uniqueLogs = combined

            # Merge provenance
            self.contributing_input_files.update(botlatlas.contributing_input_files)
            for k, v in botlatlas.curve_origins.items():
                self.curve_origins.setdefault(k, [])
                for origin in v:
                    tup = (origin['input_file'], origin['curve'])
                    if tup not in {(o['input_file'], o['curve']) for o in self.curve_origins[k]}:
                        self.curve_origins[k].append(origin)

            print(f'    Final Unique Logs: {self.uniqueLogs}')
            print(f'    Final XY Shape: {self.flexlog.XY.shape}')

        except Exception as e:
            print(f"Error in extend method: {e}")
            import traceback; traceback.print_exc()

    def doSplicing(self, sampling_interval):
        print("Splicing starts....")
        try:
            XY = self.flexlog.XY
            if XY.shape[0] < 2:
                print("Warning: Not enough data to splice.")
                self.spliced_logs = XY
                return

            min_d, max_d = XY[0, 0], XY[-1, 0]
            if np.isnan(min_d) or np.isnan(max_d) or min_d >= max_d:
                print(f"Warning: Invalid depth range [{min_d}, {max_d}].")
                self.spliced_logs = XY
                return

            grid = np.arange(min_d, max_d + sampling_interval, sampling_interval)
            spliced = np.full((len(grid), len(self.uniqueLogs)+1), np.nan)
            spliced[:, 0] = grid

            # Interpolate each log
            from scipy.interpolate import interp1d
            for idx, log in enumerate(self.uniqueLogs):
                col = idx + 1
                if col < XY.shape[1]:
                    depths, vals = XY[:, 0], XY[:, col]
                    mask = ~np.isnan(vals)
                    if mask.sum() > 1:
                        f = interp1d(depths[mask], vals[mask], 
                                     bounds_error=False, fill_value=np.nan)
                        spliced[:, col] = f(grid)
                    else:
                        print(f"Warning: insufficient points for {log}")

            self.spliced_logs = spliced
        except Exception as e:
            print(f"Error during splicing: {e}")
            import traceback; traceback.print_exc()
            self.spliced_logs = self.flexlog.XY
        print("Splicing completes....")

    def export(self, filepath):
        print("Exporting starts....")
        try:
            las_export(self.spliced_logs, self.uniqueLogs, filepath)
            print(f"Export success. LAS at {filepath}")
        except Exception as e:
            print(f"Error during export: {e}")
            import traceback; traceback.print_exc()

    def get_detailed_provenance(self):
        inputs = sorted(self.contributing_input_files)
        mapping = {log: self.curve_origins.get(log, []) for log in self.uniqueLogs}
        return {'input_files': inputs, 'output_curve_mapping': mapping}

# ============================================================================ 
# SuitSplice: Orchestrates lateral + vertical merging + provenance export
# ============================================================================ 
class SuitSplice():
    def __init__(self, suits, params):
        self.resultLas = VerticalLas(params=params)
        self.curve_origins = {}
        self.input_files = set()
        self.params = params

        for i, suit_data in suits.items():
            print(f'Processing Suit Index: {i}')
            if not (isinstance(suit_data, dict) and suit_data):
                print(f"Warning: Suit index {i} invalid/empty. Skipping.")
                continue

            print('Lateral Merging...')
            lat = LateralLas(suit_data, params)
            self.input_files.update(lat.contributing_input_files)
            for k, v in lat.curve_origins.items():
                self.curve_origins.setdefault(k, []).extend(v)

            if lat.flexLogCurves is not None:
                print('Vertical Merging...')
                self.resultLas.extend(lat, delaybottom=0)
                print(f'Logs after suit {i}: {self.resultLas.uniqueLogs}')
            else:
                print(f"Skipping vertical merge for suit {i} – no flexLogCurves.")

    def get_spliced_curve_mnemonics(self):
        return list(self.resultLas.uniqueLogs)

    def get_provenance_data(self):
        return {
            'input_files': sorted(self.input_files),
            'output_curves': self.curve_origins
        }

    def save_provenance(self, filepath):
        prov = self.get_provenance_data()
        pfile = filepath.replace('.las', '_provenance.json')
        try:
            with open(pfile, 'w') as f:
                json.dump(prov, f, indent=2)
            print(f'Provenance saved to {pfile}')
            return True
        except Exception as e:
            print(f'Error saving provenance: {e}')
            return False

    def export(self, filepath, sampling_interval):
        print(f"Starting export (interval={sampling_interval})...")
        try:
            self.resultLas.doSplicing(sampling_interval)
            self.resultLas.export(filepath)
            self.save_provenance(filepath)
            print("Export complete!")
        except Exception as e:
            print(f"Error during export: {e}")
            import traceback; traceback.print_exc()

def read_params():
    try:
        with open(autosplice_params_file_path, 'r') as f:
            params = json.load(f)
        # Ensure correct types
        params['equal_val_allowed_width'] = int(params.get('equal_val_allowed_width', 3))
        params['export_sampling_interval'] = float(params.get('export_sampling_interval', 0.1524))
        params['hist_bins'] = int(params.get('hist_bins', 100))
        params['n_big_patches'] = int(params.get('n_big_patches', 1))
        params['nan_patches_gap_ignored'] = int(params.get('nan_patches_gap_ignored', 20))
        return params
    except Exception:
        return {
            'equal_val_allowed_width': 3,
            'export_sampling_interval': 0.1524,
            'hist_bins': 100,
            'n_big_patches': 1,
            'nan_patches_gap_ignored': 20
        }
