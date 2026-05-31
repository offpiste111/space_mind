"""Main Python application file for the EEL-CRA demo.

To build for production:
npm run build
python -m eel main.py dist_vite --onefile --splash splashfile.png --path env/lib/site-packages --noconsole --name space-mind-windows-v0.1.0 --icon assets/app_icon.ico
"""

import json
import os
import platform
import random
import sys
import importlib
import socket, errno
from py_src.contrib.replace_in_file import replaceInfile, findFileRe
from py_src.contrib.port_check import find_unused_port
import eel
import subprocess

# Windows用のタスクバー・タイトルバーアイコン適用対策 (AppUserModelIDの設定)
if sys.platform.startswith('win'):
    import ctypes
    try:
        # 独自のユニークなIDを設定してWindowsに別アプリとして認識させる
        myappid = 'jp.co.spacemind.app.0.1.0'
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
    except Exception as e:
        pass



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
    import tkinter as tk
    from tkinter import filedialog

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
    import tkinter as tk
    from tkinter import filedialog

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
    import tkinter as tk
    from tkinter import filedialog

    # Create and configure main Tkinter window
    root = tk.Tk()
    root.withdraw()
    
    # Make it appear on top of other windows
    root.attributes('-topmost', True)
    root.lift()
    
    # Show file dialog and get selected file path
    file_path = filedialog.askopenfilename(
        parent=root,
        filetypes=[
            ('SpaceMind Files', '*.json;*.md'),
            ('JSON files', '*.json'),
            ('Markdown files', '*.md'),
            ('All files', '*.*')
        ]
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

def parse_markdown_to_mindmap(filepath):
    import re
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading markdown file: {e}")
        return None
        
    nodes = []
    links = []
    groups = []
    
    # 階層スタック。各要素は (level, node_id, group_id)
    stack = []
    
    node_id_counter = 1
    link_id_counter = 0
    group_id_counter = 1
    
    # フロントエンドの EMPHASIS_BG_COLORS と完全に同じカラーパレット
    group_colors = [
        '#2255aa', # 青系
        '#226644', # 緑系
        '#886600', # 黄系
        '#aa4400', # 橙系
        '#993366', # ピンク系
        '#553399', # 紫系
        '#444444'  # グレー系
    ]
    
    current_h_level = 1
    
    for line_raw in lines:
        line_clean = line_raw.strip()
        if not line_clean:
            continue
            
        if line_clean == "---" or line_clean == "***":
            continue
            
        # 見出し判定
        if line_clean.startswith("#"):
            parts = line_clean.split(" ", 1)
            hashes = parts[0]
            if not all(c == "#" for c in hashes):
                continue
            h_len = len(hashes)
            title = parts[1].strip() if len(parts) > 1 else ""
            if not title:
                continue
                
            current_h_level = h_len
            level = h_len * 4
            
            node_id = node_id_counter
            node_id_counter += 1
            
            node = {
                "id": node_id,
                "name": title,
                "group": 1,
                "style_id": 1,
                "x": 0.0,
                "y": 0.0,
                "z": 0.0,
                "fx": 0.0,
                "fy": 0.0,
                "fz": -300.0,
                "type": "normal"
            }
            
            if node_id == 1:
                # 最初の見出し（ルート）は課題ノード
                node["type"] = "issue"
                node["size_x"] = 350
                node["size_y"] = 100
                nodes.append(node)
                stack.append((level, node_id, None))
                continue
                
            # 親を見つける
            while stack and stack[-1][0] >= level:
                stack.pop()
                
            parent_id = stack[-1][1] if stack else 1
            parent_group_id = stack[-1][2] if stack else None
            
            current_group_id = parent_group_id
            if h_len == 2:
                # 新グループ
                current_group_id = group_id_counter
                group_id_counter += 1
                color = group_colors[(current_group_id - 1) % len(group_colors)]
                groups.append({
                    "id": current_group_id,
                    "name": title,
                    "color": color
                })
                
            if current_group_id is not None:
                color_idx = (current_group_id - 1) % len(group_colors)
                node["groupId"] = current_group_id
                node["groupIds"] = [current_group_id]
                node["color"] = group_colors[color_idx]
                node["node_bg_color"] = color_idx
                node["node_pattern_color"] = color_idx
                node["style_id"] = 4 if h_len == 2 else 1 # H2(グループのトップレベル)のみ強調スタイル、それ以外はノーマルスタイル
                node["size_x"] = 240
                node["size_y"] = 80
            else:
                node["size_x"] = 240
                node["size_y"] = 80
                
            nodes.append(node)
            
            links.append({
                "index": link_id_counter,
                "source": parent_id,
                "target": node_id,
                "name": ""
            })
            link_id_counter += 1
            
            stack.append((level, node_id, current_group_id))
            
        # 箇条書きリスト判定
        elif line_clean.startswith(("- ", "* ", "+ ")):
            lspace = len(line_raw) - len(line_raw.lstrip())
            text = line_clean[2:].strip()
            
            # 太字装飾 (**項目名**)
            match_bold = re.match(r"\*\*(.*?)\*\*", text)
            if match_bold:
                text_clean = match_bold.group(1)
                rest = text[match_bold.end():].strip()
                if rest:
                    if rest.startswith(":") or rest.startswith("："):
                        rest = rest[1:].strip()
                    text_clean = f"【{text_clean}】\n{rest}"
            else:
                text_clean = text
                
            if not text_clean:
                continue
                
            level = (current_h_level * 4) + 4 + lspace
            
            while stack and stack[-1][0] >= level:
                stack.pop()
                
            parent_id = stack[-1][1] if stack else 1
            parent_group_id = stack[-1][2] if stack else None
            
            node_id = node_id_counter
            node_id_counter += 1
            
            node = {
                "id": node_id,
                "name": text_clean,
                "group": 1,
                "style_id": 1,
                "x": 0.0,
                "y": 0.0,
                "z": 0.0,
                "fx": 0.0,
                "fy": 0.0,
                "fz": -300.0,
                "type": "normal"
            }
            
            if parent_group_id is not None:
                color_idx = (parent_group_id - 1) % len(group_colors)
                node["groupId"] = parent_group_id
                node["groupIds"] = [parent_group_id]
                node["color"] = group_colors[color_idx]
                node["node_bg_color"] = color_idx
                node["node_pattern_color"] = color_idx
                node["style_id"] = 1 # 配下はノーマルスタイル(style_id=1)にする
                node["size_x"] = 240
                node["size_y"] = 80
            else:
                node["size_x"] = 240
                node["size_y"] = 80
                
            nodes.append(node)
            
            links.append({
                "index": link_id_counter,
                "source": parent_id,
                "target": node_id,
                "name": ""
            })
            link_id_counter += 1
            
            stack.append((level, node_id, parent_group_id))
            
    if not nodes:
        nodes = [{
            "id": 1,
            "name": "新規マインドマップ",
            "group": 1,
            "style_id": 1,
            "x": 0.0, "y": 0.0, "z": 0.0,
            "fx": 0.0, "fy": 0.0, "fz": -300.0,
            "type": "issue"
        }]
        
    return {
        "nodes": nodes,
        "links": links,
        "groups": groups,
        "globalBackground": "sky",
        "layoutMode": "force"
    }

def read_json(json_path):
    if json_path.lower().endswith('.md'):
        return parse_markdown_to_mindmap(json_path)
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
            if key not in ["id","name","group","x","y","z","fx","fy","fz","img","icon_img","style_id","color","index","deadline","priority","urgency","disabled","type","url","file_path","folder_path","scale","background", "size_x", "size_y", "rot_x", "rot_y", "groupId", "groupIds", "node_bg_color", "node_pattern_color"]:
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
    {"class": "issue_1", "rounded_rectangle_radius": 20, "background_trasparent": False}, 
    {"class": "issue_2", "rounded_rectangle_radius": 20, "background_trasparent": True}, 
    {"class": "issue_3", "rounded_rectangle_radius": 20, "background_trasparent": True},
    {"class": "issue_4", "rounded_rectangle_radius": 8, "background_trasparent": True},
    {"class": "issue_5", "rounded_rectangle_radius": 8, "background_trasparent": False}, 
    {"class": "issue_6", "rounded_rectangle_radius": 8, "background_trasparent": True},
]

# Splash screen will be closed in start_eel() after the window is ready

@eel.expose  # Expose function to JavaScript
def say_hello_py(x):
    """Print message from JavaScript on app initialization, then call a JS function."""
    # eel.say_hello_js('') # JavaScript側で未定義のため無効化
    pass

@eel.expose
def load_json(path):
    node_data = read_json(path)
    return node_data

@eel.expose
def load_data(node_data):
    return node_data



@eel.expose
def save_data(data):
    """現在のファイルパスにデータを保存する"""
    global g_current_file_path

    if g_current_file_path:
        # Markdownファイル（.md）としてロードされた状態で保存された場合は、マニュアルファイルを上書きしないよう拡張子を.jsonに変更する
        if g_current_file_path.lower().endswith('.md'):
            g_current_file_path = os.path.splitext(g_current_file_path)[0] + '.json'
            
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
    import tkinter as tk
    from tkinter import filedialog

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
def get_ogp_image(url):
    """URLからOGP画像を取得してBase64形式で返す"""
    import requests
    from bs4 import BeautifulSoup
    import base64

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "max-age=0",
            "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Upgrade-Insecure-Requests": "1",
        }
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # OGP画像タグを探す
        og_image = soup.find("meta", property="og:image")
        if not og_image:
            og_image = soup.find("meta", attrs={"name": "twitter:image"})
        if not og_image:
            # ファビコンをバックアップとして探す
            og_image = soup.find("link", rel=lambda x: x and 'icon' in x.lower())
            if og_image:
                og_image["content"] = og_image.get("href")
            
        if og_image and (og_image.get("content") or og_image.get("href")):
            img_url = og_image.get("content") or og_image.get("href")
            
            # 相対パスの場合は絶対パスに変換
            if not img_url.startswith(('http://', 'https://')):
                from urllib.parse import urljoin
                img_url = urljoin(url, img_url)

            # 画像をダウンロード
            img_response = requests.get(img_url, headers=headers, timeout=10)
            img_response.raise_for_status()
            
            # Base64エンコード
            img_base64 = base64.b64encode(img_response.content).decode("utf-8")
            return f"data:{img_response.headers.get('Content-Type', 'image/png')};base64,{img_base64}"
            
        return None
    except Exception as e:
        print(f"Error fetching OGP image: {e}")
        return None

@eel.expose
def init():
    print('Initalized')
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

    # Close splash screen after initialization
    if importlib.util.find_spec("pyi_splash"):
        try:
            import pyi_splash
            pyi_splash.update_text('UI Loaded ...')
            pyi_splash.close()
        except Exception:
            pass

    # These will be queued until the first connection is made, but won't be repeated on a page reload
    # say_hello_py('')  # JavaScript側で未定義のため無効化
    # eel.say_hello_js('')   # Call a JavaScript function (must be after `eel.init()`)

    #eel.show_log('https://github.com/samuelhwilliams/Eel/issues/363 (show_log)')

    #create images

    eel_kwargs = dict(
        host='localhost',
        port=eel_port,
        size=(1280, 800),
        cmdline_args=['--disable-http-cache']
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
