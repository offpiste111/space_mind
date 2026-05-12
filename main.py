"""Main Python application file for the EEL-CRA demo.

To build for production:
npm run build
python -m eel main.py dist_vite --onefile --splash splashfile.png --path env/lib/site-packages --noconsole
"""

import datetime
import json
import os
import platform
import random
import sys
import importlib
import socket, errno
import tkinter as tk
from tkinter import filedialog
from py_src.contrib.replace_in_file import replaceInfile, findFileRe
from py_src.contrib.port_check import find_unused_port
import shutil
import eel
import concurrent.futures
from PIL import Image, ImageOps, ImageDraw
import numpy as np
import io
import base64
import subprocess
from jinja2 import Environment, FileSystemLoader

# Import imgkit at module level to avoid repeated imports across threads
import imgkit

def get_resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    # Try several common locations
    locations = [
        os.path.join(base_path, relative_path),
        os.path.join(base_path, "web_src", relative_path),
        os.path.join(base_path, "dist_vite", relative_path)
    ]
    
    for loc in locations:
        if os.path.exists(loc):
            return loc
    return os.path.join(base_path, relative_path)

env = Environment(loader=FileSystemLoader('templates'))
node_template = env.get_template('node_template.html')

g_current_file_path = None  # 現在開いているファイルのパスを保持
RECENT_FILES_PATH = os.path.expanduser("~/.space_mind_recent_files.json")

def update_recent_files(path):
    """最近使用したファイルのリストを更新する"""
    try:
        if os.path.exists(RECENT_FILES_PATH):
            with open(RECENT_FILES_PATH, 'r', encoding='utf-8') as f:
                recent_files = json.load(f)
        else:
            recent_files = []

        # 既存のパスを削除
        if path in recent_files:
            recent_files.remove(path)

        # 先頭に追加
        recent_files.insert(0, path)

        # 10件に制限
        recent_files = recent_files[:10]

        with open(RECENT_FILES_PATH, 'w', encoding='utf-8') as f:
            json.dump(recent_files, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error updating recent files: {e}")

@eel.expose
def get_recent_files():
    """最近使用したファイルのリストを取得する"""
    if os.path.exists(RECENT_FILES_PATH):
        with open(RECENT_FILES_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

@eel.expose
def load_json_by_path(path):
    """指定されたパスからJSONファイルを読み込む"""
    global g_current_file_path
    if os.path.exists(path):
        g_current_file_path = path
        update_recent_files(path)
        return load_json(path)
    return None

@eel.expose
def select_folder():
    """
    フォルダを選択するダイアログを表示する
    
    Returns:
        str: 選択されたフォルダのパス。キャンセルされた場合は空文字列
    """
    # Create and configure main Tkinter window
    root = tk.Tk()
    root.withdraw()
    
    # Make it appear on top of other windows
    root.attributes('-topmost', True)
    root.lift()
    
    # Show folder selection dialog
    folder_path = filedialog.askdirectory(
        parent=root,
        title='フォルダを選択',
        mustexist=True
    )
    
    return folder_path if folder_path else ""

@eel.expose
def select_any_file():
    """
    任意のファイルを選択するダイアログを表示する
    
    Returns:
        str: 選択されたファイルのパス。キャンセルされた場合は空文字列
    """
    # Create and configure main Tkinter window
    root = tk.Tk()
    root.withdraw()
    
    # Make it appear on top of other windows
    root.attributes('-topmost', True)
    root.lift()
    
    # Show file dialog and get selected file path
    file_path = filedialog.askopenfilename(
        parent=root,
        title='ファイルを選択',
        filetypes=[('All files', '*.*')]
    )
    
    return file_path if file_path else ""

@eel.expose
def select_file_dialog():
    # Create and configure main Tkinter window
    root = tk.Tk()
    root.withdraw()
    
    # Make it appear on top of other windows
    root.attributes('-topmost', True)
    root.lift()
    
    # Show file dialog and get selected file path
    file_path = filedialog.askopenfilename(
        parent=root,
        filetypes=[('JSON files', '*.json'), ('All files', '*.*')]
    )
    
    if file_path:
        global g_current_file_path
        g_current_file_path = file_path
        update_recent_files(file_path)
        return load_json(file_path)
    return None

@eel.expose
def open_file(file_path):
    """
    システムの既定のアプリケーションでファイルを開く
    
    Args:
        file_path: 開くファイルのパス
        
    Returns:
        bool: ファイルを開くことができたかどうか
    """
    try:
        if os.path.exists(file_path.replace('/', os.sep).replace('\\', os.sep)):
            # OSに応じて適切なコマンドを使用
            if platform.system() == 'Windows':
                os.startfile(file_path)
            elif platform.system() == 'Darwin':  # macOS
                subprocess.call(['open', file_path])
            else:  # Linux
                subprocess.call(['xdg-open', file_path])
            return True
        else:
            print(f"File not found: {file_path}")
            return False
    except Exception as e:
        print(f"Error opening file: {e}")
        return False

@eel.expose
def open_folder(folder_path):
    """
    システムの既定のファイルエクスプローラーでフォルダを開く
    
    Args:
        folder_path: 開くフォルダのパス
        
    Returns:
        bool: フォルダを開くことができたかどうか
    """
    try:
        if os.path.exists(folder_path.replace('/', os.sep).replace('\\', os.sep)):
            # OSに応じて適切なコマンドを使用
            if platform.system() == 'Windows':
                os.startfile(folder_path)
            elif platform.system() == 'Darwin':  # macOS
                subprocess.call(['open', folder_path])
            else:  # Linux
                subprocess.call(['xdg-open', folder_path])
            return True
        else:
            print(f"Folder not found: {folder_path}")
            return False
    except Exception as e:
        print(f"Error opening folder: {e}")
        return False

def read_json(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        node_data = json.load(f)
    return node_data

def save_json(data, json_path):
    print("--- Saving data to:", json_path)
    print("--- Original data:", json.dumps(data, indent=2, ensure_ascii=False))
    
    # data["nodes"]の各要素のキーはid,name,group,x,y,color,index,fx,fyのみ、それ以外は削除
    for node in data["nodes"]:
        node_keys = list(node.keys())
        for key in node_keys:
            if key not in ["id","name","group","x","y","z","fx","fy","fz","img","icon_img","style_id","color","index","deadline","priority","urgency","disabled","type","url","file_path","folder_path","scale","baackground", "size_x", "size_y", "rot_x", "rot_y"]:
                del node[key]

    # data["links"]の各要素のキーはsource,target,__indexColor,index,__controlPointsのみ、それ以外は削除、ただしsource,targetはidに変換
    for link in data["links"]:
        link_keys = list(link.keys())
        for key in link_keys:
            if key not in ["source","target","index","name"]:
                del link[key]

        #source,targetをidに変換
        #link["source"]がハッシュ配列型であるかつidキーがある場合のみ変換
        if isinstance(link["source"], dict) and "id" in link["source"]:
            link["source"] = link["source"]["id"]
        #link["target"]がハッシュ配列型であるかつidキーがある場合のみ変換
        if isinstance(link["target"], dict) and "id" in link["target"]:
            link["target"] = link["target"]["id"]
    
    print("--- Cleaned data:", json.dumps(data, indent=2, ensure_ascii=False))

    try:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"--- Error saving file: {e}")
        return False


node_styles = [
    {"class": "normal_1", "rounded_rectangle_radius": 8, "background_trasparent": False}, 
    {"class": "normal_2", "rounded_rectangle_radius": 8, "background_trasparent": False}, 
    {"class": "normal_3", "rounded_rectangle_radius": 0, "background_trasparent": True},
    {"class": "normal_4", "rounded_rectangle_radius": 8, "background_trasparent": False},
    {"class": "normal_5", "rounded_rectangle_radius": 0, "background_trasparent": True}, 
    {"class": "normal_6", "rounded_rectangle_radius": 8, "background_trasparent": False},
]

node_link_styles = [
    {"class": "link_1", "rounded_rectangle_radius": 8, "background_trasparent": False},
]

node_task_styles = [
    {"class": "task_1", "rounded_rectangle_radius": 8, "background_trasparent": False}, 
]

node_file_styles = [
    {"class": "file_1", "rounded_rectangle_radius": 8, "background_trasparent": False},
]

node_folder_styles = [
    {"class": "folder_1", "rounded_rectangle_radius": 8, "background_trasparent": False},
]

node_issue_styles = [
    {"class": "issue_1", "rounded_rectangle_radius": 0, "background_trasparent": True}, 
    {"class": "issue_2", "rounded_rectangle_radius": 8, "background_trasparent": True}, 
    {"class": "issue_3", "rounded_rectangle_radius": 0, "background_trasparent": True},
    {"class": "issue_4", "rounded_rectangle_radius": 8, "background_trasparent": True},
    {"class": "issue_5", "rounded_rectangle_radius": 8, "background_trasparent": False}, 
    {"class": "issue_6", "rounded_rectangle_radius": 8, "background_trasparent": True},
]

if '_PYIBoot_SPLASH' in os.environ and importlib.util.find_spec("pyi_splash"):
    import pyi_splash
    pyi_splash.update_text('UI Loaded ...')
    pyi_splash.close()

@eel.expose  # Expose function to JavaScript
def say_hello_py(x):
    """Print message from JavaScript on app initialization, then call a JS function."""
    print('Hello from %s' % x)  # noqa T001
    eel.say_hello_js('Python {from within say_hello_py()}!')

@eel.expose
def load_json(path):
    node_data = read_json(path)
    generate_images(node_data)
    return node_data

@eel.expose
def load_data(node_data):
    generate_images(node_data)
    return node_data

def generate_images(node_data):
    # Determine the actual writable assets directory
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    # Prioritize the directory being served by Eel
    if os.path.exists(os.path.join(base_path, "web_src/assets")):
        node_img_dir_name = os.path.join(base_path, "web_src/assets/node_img")
    elif os.path.exists(os.path.join(base_path, "dist_vite/assets")):
        node_img_dir_name = os.path.join(base_path, "dist_vite/assets/node_img")
    else:
        node_img_dir_name = os.path.join(base_path, "assets/node_img")

    print(f"--- Target node_img directory: {node_img_dir_name}")
    
    if os.path.exists(node_img_dir_name):
        try:
            shutil.rmtree(node_img_dir_name)
        except Exception as e:
            print(f"Could not remove old node_img dir: {e}")
    
    os.makedirs(node_img_dir_name, exist_ok=True)

    with concurrent.futures.ThreadPoolExecutor() as executor:
        executor.map(generate_image, node_data.get("nodes", []))

    return node_data

def process_base64_image(base64_str, max_size=150):
    """Base64形式の画像を処理してサイズを調整する"""
    # Base64ヘッダーを削除
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]
    
    # Base64をデコードして画像を開く
    img_data = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_data))
    
    # アスペクト比を保持しながらリサイズ
    width, height = img.size
    if width > height:
        if width > max_size:
            ratio = max_size / width
            new_width = max_size
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    else:
        if height > max_size:
            ratio = max_size / height
            new_height = max_size
            new_width = int(width * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    return img

@eel.expose
def generate_image(node):
    # icon_imgがある場合は、それを処理
    icon_base64 = None
    if 'icon_img' in node and node['icon_img']:
        # icon_sizeの値があれば取得し、なければデフォルト値の300を使用
        icon_size = node.get('icon_size', 300)
        img = process_base64_image(node['icon_img'], max_size=icon_size)
        # 処理した画像をbase64に変換
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        icon_base64 = base64.b64encode(buffered.getvalue()).decode()

    frame_bushes_base64 = ""
    frame_bushes2_base64 = ""
    frame_bushes3_base64 = ""
    frame_bushes4_base64 = ""
    frame_bushes5_base64 = ""
    frame_bushes6_base64 = ""

    styles = node_styles
    if "type" in node and node["type"] == "link":
        styles = node_link_styles
    elif "type" in node and node["type"] == "task":
        styles = node_task_styles
    elif "type" in node and node["type"] == "file":
        styles = node_file_styles
    elif "type" in node and node["type"] == "folder":
        styles = node_folder_styles
    elif "type" in node and node["type"] == "issue":
        styles = node_issue_styles

        if node["style_id"] == 1:
            with open(get_resource_path('assets/frame_bushes.png'), 'rb') as img_file:
                frame_bushes_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        if node["style_id"] == 2:
            with open(get_resource_path('assets/frame_bushes2.png'), 'rb') as img_file:
                frame_bushes2_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        if node["style_id"] == 3:
            with open(get_resource_path('assets/frame_bushes3.png'), 'rb') as img_file:
                frame_bushes3_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        if node["style_id"] == 4:
            with open(get_resource_path('assets/frame_bushes4.png'), 'rb') as img_file:
                frame_bushes4_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        if node["style_id"] == 5:
            with open(get_resource_path('assets/frame_bushes5.png'), 'rb') as img_file:
                frame_bushes5_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        if node["style_id"] == 6:
            with open(get_resource_path('assets/frame_bushes6.png'), 'rb') as img_file:
                frame_bushes6_base64 = base64.b64encode(img_file.read()).decode('utf-8')

    html_content = node_template.render(
        style_class=styles[node['style_id']-1]['class'],
        icon_base64=icon_base64,
        node_name=node['name'],
        deadline=node.get('deadline', '').strip() if 'deadline' in node and node['deadline'] else None,
        priority=node.get('priority'),
        urgency=node.get('urgency'),
        frame_bushes_base64=frame_bushes_base64,
        frame_bushes2_base64=frame_bushes2_base64,
        frame_bushes3_base64=frame_bushes3_base64,
        frame_bushes4_base64=frame_bushes4_base64,
        frame_bushes5_base64=frame_bushes5_base64,
        frame_bushes6_base64=frame_bushes6_base64
    )

    # Determine where to store and load generated images
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    if os.path.exists(os.path.join(base_path, "web_src/assets")):
        assets_base = os.path.join(base_path, "web_src/assets")
    elif os.path.exists(os.path.join(base_path, "dist_vite/assets")):
        assets_base = os.path.join(base_path, "dist_vite/assets")
    else:
        assets_base = os.path.join(base_path, "assets")

    now = datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
    output_path = os.path.join(assets_base, f"node_img/{node['id']}_{now}.png")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    options = {
        'width': '1200',
        'height': '1200'
    }

    if 'isNew' not in node or node['isNew'] == False:
        if node['img'] != "logo.png":
            # if os.path.exists(os.path.join(assets_base, node['img'])):
            #     os.remove(os.path.join(assets_base, node['img']))
            pass

    if os.name == 'nt':
        wkhtmltoimage_config = imgkit.config(wkhtmltoimage='./wkhtmltox/bin/wkhtmltoimage.exe')
        imgkit.from_string(html_content, output_path, config=wkhtmltoimage_config, options=options)
    else:
        # On Linux, try system path first
        wk_path = '/usr/bin/wkhtmltoimage'
        if not os.path.exists(wk_path):
            # Fallback to 'wkhtmltoimage' in PATH
            imgkit.from_string(html_content, output_path, options=options)
        else:
            wkhtmltoimage_config = imgkit.config(wkhtmltoimage=wk_path)
            imgkit.from_string(html_content, output_path, config=wkhtmltoimage_config, options=options)
    
    node['img'] = f"node_img/{node['id']}_{now}.png"

    img = Image.open(output_path).convert("RGB")
    img = ImageOps.invert(img)
    img = img.crop(img.getbbox())
    img = ImageOps.invert(img)

    img.save(output_path + "_", 'PNG')

    if styles[node['style_id']-1]['background_trasparent']:
        img = img.convert("RGBA")
        np_img = np.array(img)
        alpha_mask = np.all(np_img[:, :, :3] > 240, axis=-1)
        np_img[:, :, 3] = np.where(alpha_mask, 0, np_img[:, :, 3])
        img = Image.fromarray(np_img)

    if styles[node['style_id']-1]['rounded_rectangle_radius'] > 0:
        mask = Image.new("L", img.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle((0, 0, img.width, img.height), styles[node['style_id']-1]['rounded_rectangle_radius'], fill=255)
        img.putalpha(mask)
        
    img.save(output_path, 'PNG')
    node['size_x'] = img.size[0]
    node['size_y'] = img.size[1]
    print(node['img'])
        
    return node['img'], img.size

@eel.expose
def save_data(data):
    """現在のファイルパスにデータを保存する"""
    global g_current_file_path

    if g_current_file_path:
        print(f"--- g_current_file_path in save_data: {g_current_file_path}")
        if save_json(data, g_current_file_path):
            return [True, g_current_file_path]
        else:
            return [False, None]
    else:
        return save_as_data(data)

@eel.expose
def save_as_data(data):
    global g_current_file_path
    # 保存ダイアログを表示
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    root.lift()
    
    file_path = filedialog.asksaveasfilename(
        parent=root,
        defaultextension='.json',
        filetypes=[('JSON files', '*.json'), ('All files', '*.*')]
    )
    
    if file_path:
        g_current_file_path = file_path
        save_json(data, file_path)
        return [True, file_path]
    return [False, None]

@eel.expose
def expand_user(folder):
    """Return the full path to display in the UI."""
    return '{}/*'.format(os.path.expanduser(folder))

@eel.expose
def init():
    print('Hello! Initalized')
    global g_current_file_path
    g_current_file_path = None

    return True

@eel.expose
def pick_file(folder):
    """Return a random file from the specified folder."""
    folder = os.path.expanduser(folder)
    if os.path.isdir(folder):
        listFiles = [_f for _f in os.listdir(folder) if not os.path.isdir(os.path.join(folder, _f))]
        if len(listFiles) == 0:
            return 'No Files found in {}'.format(folder)
        return random.choice(listFiles)
    else:
        return '{} is not a valid folder'.format(folder)

def start_eel(develop):
    """Start Eel with either production or development configuration."""

    if develop:
        directory = 'web_src'
        app = None
        page = {'port': 5173}
        eel_port = 5169
    else:
        directory = 'dist_vite'
        app = 'chrome'
        page = 'index.html'

        # find a unused port to host the eel server/websocket
        eel_port = find_unused_port()

        # Determine path to build files for replacement
        try:
            base_path = sys._MEIPASS
        except Exception:
            base_path = os.path.abspath(".")

        # replace the port in the web files
        assets_dir = os.path.join(base_path, "dist_vite/assets")
        index_file = os.path.join(base_path, "dist_vite/index.html")
        
        replace_file = findFileRe(assets_dir, "index.*.js")
        if replace_file:
            replaceInfile(os.path.join(assets_dir, replace_file), 'ws://localhost:....', f"ws://localhost:{eel_port}")
        
        if os.path.exists(index_file):
            replaceInfile(index_file, 'http://localhost:.....eel.js', f"http://localhost:{eel_port}/eel.js")

    eel.init(directory, ['.tsx', '.ts', '.jsx', '.js', '.html'])

    # These will be queued until the first connection is made, but won't be repeated on a page reload
    say_hello_py('Python World!')
    eel.say_hello_js('Python World!')   # Call a JavaScript function (must be after `eel.init()`)

    #eel.show_log('https://github.com/samuelhwilliams/Eel/issues/363 (show_log)')

    #create images

    eel_kwargs = dict(
        host='localhost',
        port=eel_port,
        size=(1280, 800),
    )
    try:
        eel.start(page, mode=app, **eel_kwargs)
    except EnvironmentError:
        # If Chrome isn't found, fallback to Microsoft Edge on Win10 or greater
        if sys.platform in ['win32', 'win64'] and int(platform.release()) >= 10:
            eel.start(page, mode='edge', **eel_kwargs)
        else:
            raise

if __name__ == '__main__':
    import sys

    # Pass any second argument to enable debugging
    start_eel(develop=len(sys.argv) == 2)
