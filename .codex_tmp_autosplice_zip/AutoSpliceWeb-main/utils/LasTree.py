
import os
from utils.loggy_settings import lwdVSwirelineFile, mnemonicsfile
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
def treeWidgetFrmArray(tree,heading,elementarray):
    tree.headerItem().setText(0, "Logs")  
    parent = QTreeWidgetItem(tree)     
    parent=parentWidgetFrmArray(parent,heading,elementarray)
    
    return tree
def parentWidgetFrmArray(parent,heading,elementarray):       
    parent.setText(0, heading)
    # parent.setFlags(parent.flags())
    parent.setFlags(parent.flags() | Qt.ItemIsTristate | Qt.ItemIsUserCheckable)
    parent.setCheckState(0, Qt.Unchecked)
    for element in elementarray:
        child = QTreeWidgetItem(parent)
        # child.setFlags(child.flags() | Qt.ItemIsTristate | Qt.ItemIsUserCheckable )
        child.setText(0, element)
    return parent
    

def treeWidgetFrmDict(tree,treeview_dict): #QTreeWidgetItem()
        # item    = QTreeWidgetItem()
        
        for key in treeview_dict:
            parent = QTreeWidgetItem(tree)
            parent.setText(0, key)
            # parent.setFlags(parent.flags() | Qt.ItemIsTristate )
            parent.setFlags(parent.flags())
            
            for subkey in treeview_dict[key]:
                child = QTreeWidgetItem(parent)
                child.setFlags(child.flags()  )
                # child.setFlags(child.flags() | Qt.ItemIsTristate | Qt.ItemIsUserCheckable)
                child.setText(0, subkey)
                # child.setCheckState(0, Qt.Unchecked)
                finaldict=treeview_dict[key][subkey]
                for thirdkey in finaldict:
                    subchild = QTreeWidgetItem(child)
                    subchild.setFlags(child.flags()  ) #| Qt.ItemIsUserCheckable
                    subchild.setText(0, thirdkey)

        tree.expandToDepth(1)
        return tree

class LasTree():
    def __init__(self):#
        # self.interval = interval
        self.isitfile=False
           
        # self.Lases=loadedlas         
        self.tree    = QTreeWidget ()  

        # thread = threading.Thread(target=self.run, args=())
        # thread.daemon = True                            # Daemonize thread
        # thread.start()  
    # def lasLoad(self):
    #     print(self.tree.selectedItems()[0].text(0))
    def set_files(self,lasfiles,make_tree_dict=True):
        self.files=lasfiles 
        if make_tree_dict:
            self.make_lastree_dict() 

    def make_lastree_dict(self):        
        def get_loggingtype(file_str,logging_type_dict):
            # filewords=multi_split(file_str,delims=['_','-','.'])
            for key in logging_type_dict.keys():
                for keyword in logging_type_dict[key]:
                    if keyword in file_str:
                        return key
                return 'WireLine'
        def get_category(log_mnemo,cat_dict):
        #     filewords=multi_split(file_str,delims=['_','-','.'])
            for key in cat_dict:
                if log_mnemo in cat_dict[key]:
                    return key
            return 'NA'

        # log_categoty_dict
        def split_strofarray(strArray,delim):
            resarray=[]
            for s in strArray:
                resarray.extend(s.split(delim))
            return resarray
        def multi_split(str_,delims=['_','-','.']):
            str_=[str_]
            for d in delims:
                str_=split_strofarray(str_,d)
            return str_
        #Defferentiate tvd vs nontvd files
        if len(self.files[0])>4:
            if (self.files[0][-4:].lower()=='.las')|(self.files[0][-4:].lower()=='dlis'):
                self.isitfile=True
                self.lwdVSwirelineFile= lwdVSwirelineFile
                tvd_files=[]
                nontvd_files=[]
                for f in self.files:
                    if 'TVD' in f:
                        tvd_files.append(f)
                    else:
                        nontvd_files.append(f)
                #Defferentiate lwd vs wireline files
                type_dict=get_txtdict(self.lwdVSwirelineFile)

                lwd_files=[]
                wireline_files=[]
                self.treeview_dict={
                'MD':{    }, #'LWD':[],'WireLine':[] 
                'TVD':{       }        
                }
                las_r_log_groups=[nontvd_files,tvd_files]
            else:
                self.isitfile=False
        if not self.isitfile: #Log category
            self.mnemonicsFile=mnemonicsfile
            type_dict=get_txtdict(self.mnemonicsFile,delimiter=' ')
            las_r_log_groups=[self.files]
            self.treeview_dict={
                'Log':{         }    
                }     
        
        
        for typefiles,key in zip(las_r_log_groups,self.treeview_dict.keys()):
            ilwd=0
            iwl=0
            # print(type_dict)
            for k in type_dict.keys(): 
                self.treeview_dict[key][k]=[]
            if not self.isitfile: self.treeview_dict[key]['NA']=[]
            for f in typefiles:
                if self.isitfile:
                    indxkey= get_loggingtype(f,type_dict)  
                else:
                    indxkey=get_category(f,type_dict)             
                self.treeview_dict[key][indxkey].append(f)
        myinterdict={}
        for key in self.treeview_dict:
            myinterdict[key]={}
            for k in self.treeview_dict[key]:
                if(len(self.treeview_dict[key][k])>0):
                    myinterdict[key][k]= self.treeview_dict[key][k]
        self.treeview_dict=myinterdict
        # print(self.treeview_dict)
        
         
    
    def buildTreeWidget(self):
          
        treeWidgetFrmDict(self.tree,self.treeview_dict)

# if __name__ == '__main__':
#     import sys
#     app = QApplication(sys.argv)
#     # folder=r'D:\Ameyem Office\Projects\Cairn\W1\LAS\\'
#     folder=well_folder
#     cols=[]
#     # las=[]
#     # log.df().sort_values([log.keys()[dindx]])
#     # log.keys()
#     files=os.listdir(folder)[:]
#     w = LasTree()
#     w.set_files(files)
#     w.buildTreeWidget()
#     w.tree.show()
#     sys.exit(app.exec_())