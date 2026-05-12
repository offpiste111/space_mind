from io import TextIOWrapper
import re
import os

def replaceInfile(file_path, search_text_re, replace_text):
    """ 
    Replace a part of a file safely.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = re.sub(search_text_re, replace_text, content, count=1)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
    except Exception as e:
        print(f"Error replacing text in {file_path}: {e}")

def findFileRe(rootdir, regex_str):
    """
    Find a file in a folder based on a regex search

    Usage: findFileRe("./dist_vite/assets", "index.*.js")
    """
    regex = re.compile(regex_str)
    for root, dirs, files in os.walk(rootdir):
        for file in files:
            if regex.match(file):
                return file
    return None

