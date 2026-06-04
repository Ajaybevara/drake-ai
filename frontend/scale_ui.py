import os
import re

files = [
    r'c:\Users\HP\Desktop\drake-ai\frontend\src\components\layout\TopBar.tsx',
    r'c:\Users\HP\Desktop\drake-ai\frontend\src\components\layout\Ribbon.tsx',
    r'c:\Users\HP\Desktop\drake-ai\frontend\src\components\layout\Sidebar.tsx',
    r'c:\Users\HP\Desktop\drake-ai\frontend\src\components\layout\Workspace.tsx',
    r'c:\Users\HP\Desktop\drake-ai\frontend\src\components\layout\RightPanel.tsx'
]

multiplier = 0.82

def scale_value(match):
    prefix = match.group(1)
    val = float(match.group(2))
    suffix = match.group(3)
    
    new_val = val * multiplier
    if new_val < 7.5:
        new_val = 7.5
    
    new_val = round(new_val, 1)
    if new_val.is_integer():
        return f"{prefix}{int(new_val)}{suffix}"
    return f"{prefix}{new_val}{suffix}"

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Scale fontSize
    content = re.sub(r'(fontSize:\s*)([\d\.]+)([,}])', scale_value, content)
    
    # Scale heights/widths for specific known large values
    # TopBar height
    content = content.replace("height: 52", "height: 42")
    # Ribbon height
    content = content.replace("height: 85", "height: 68")
    # Sidebar logo container
    content = content.replace("height: 104", "height: 84")
    content = content.replace("maxHeight: 82", "maxHeight: 62")
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Font sizes and dimensions successfully scaled down.")
