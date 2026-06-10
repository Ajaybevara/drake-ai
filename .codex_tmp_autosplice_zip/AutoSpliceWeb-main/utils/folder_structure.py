# import os
# from urllib.parse import quote
# import time

# def get_folder_structure_dict(root_path, current_path='', max_depth=1):
#     folder_structure = []
#     current_full_path = os.path.join(root_path, current_path)

#     try:
#         for item in os.listdir(current_full_path):
#             item_path = os.path.join(current_full_path, item)
#             rel_path = os.path.relpath(item_path, root_path)
#             url_encoded_path = quote(rel_path)

#             if os.path.isdir(item_path):
#                 child_structure = []
#                 if max_depth > 0:
#                     child_structure = get_folder_structure_dict(root_path, rel_path, max_depth - 1)
#                 folder_structure.append({
#                     'name': item,
#                     'is_dir': True,
#                     'path': url_encoded_path,
#                     'children': child_structure
#                 })
#             elif item.lower().endswith('.las'):
#                 folder_structure.append({
#                     'name': item,
#                     'is_dir': False,
#                     'path': url_encoded_path
#                 })
#     except PermissionError:
#         print(f"Permission denied: {current_full_path}")
#     except Exception as e:
#         print(f"Error accessing {current_full_path}: {str(e)}")

#     return folder_structure

# def get_folder_contents(root_path, current_path='', page=1, items_per_page=50):
#     current_full_path = os.path.join(root_path, current_path)
#     contents = []

#     try:
#         all_items = os.listdir(current_full_path)
#         start_index = (page - 1) * items_per_page
#         end_index = start_index + items_per_page
#         paginated_items = all_items[start_index:end_index]

#         for item in paginated_items:
#             item_path = os.path.join(current_full_path, item)
#             rel_path = os.path.relpath(item_path, root_path)
#             url_encoded_path = quote(rel_path)

#             if os.path.isdir(item_path):
#                 contents.append({
#                     'name': item,
#                     'is_dir': True,
#                     'path': url_encoded_path,
#                 })
#             elif item.lower().endswith('.las'):
#                 contents.append({
#                     'name': item,
#                     'is_dir': False,
#                     'path': url_encoded_path
#                 })

#         total_items = len(all_items)
#         total_pages = (total_items + items_per_page - 1) // items_per_page

#     except PermissionError:
#         print(f"Permission denied: {current_full_path}")
#         return [], 0, 0
#     except Exception as e:
#         print(f"Error accessing {current_full_path}: {str(e)}")
#         return [], 0, 0

#     return contents, total_items, total_pages

# # Example usage
# if __name__ == "__main__":
#     root_path = r"C:\Ameyem\Drake\AutoSpliceWeb_extract\uploads\default_user\default_project\cairn"
#     start_time = time.time()
#     structure = get_folder_structure_dict(root_path)
#     print(f"Time taken: {time.time() - start_time:.2f} seconds")
#     print(structure)

#     start_time = time.time()
#     contents, total_items, total_pages = get_folder_contents(root_path, '', page=1, items_per_page=50)
#     print(f"Time taken: {time.time() - start_time:.2f} seconds")
#     print(f"Total items: {total_items}, Total pages: {total_pages}")
#     print(contents)  # Print first 5 items

# utils/folder_structure.py
import os
from urllib.parse import quote

def get_folder_structure_dict(root_path, current_path='', max_depth=1):
    folder_structure = []
    current_full_path = os.path.join(root_path, current_path)

    try:
        for item in os.listdir(current_full_path):
            item_path = os.path.join(current_full_path, item)
            rel_path = os.path.relpath(item_path, root_path)
            url_encoded_path = quote(rel_path)

            if os.path.isdir(item_path):
                child_structure = []
                if max_depth > 0:
                    child_structure = get_folder_structure_dict(root_path, rel_path, max_depth - 1)
                folder_structure.append({
                    'name': item,
                    'is_dir': True,
                    'path': url_encoded_path,
                    'children': child_structure
                })
            elif item.lower().endswith('.las'):
                folder_structure.append({
                    'name': item,
                    'is_dir': False,
                    'path': url_encoded_path
                })
    except PermissionError:
        print(f"Permission denied: {current_full_path}")
    except Exception as e:
        print(f"Error accessing {current_full_path}: {str(e)}")

    return folder_structure



def get_project_structure(project_path):
    project_structure = {}
    for well in os.listdir(project_path):
        well_path = os.path.join(project_path, well)
        if os.path.isdir(well_path):
            las_files = [f for f in os.listdir(well_path) if f.lower().endswith('.las')]
            project_structure[well] = las_files
    return project_structure