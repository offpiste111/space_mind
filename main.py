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
import io

g_current_file_path = None  # 現在開いているファイルのパスを保持

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
        return load_json(file_path)
    return None

def read_json(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        node_data = json.load(f)
    return node_data

def save_json(data, json_path):
    print(json_path)
    # data["nodes"]の各要素のキーはid,name,group,x,y,color,index,fx,fyのみ、それ以外は削除
    for node in data["nodes"]:
        node_keys = list(node.keys())
        for key in node_keys:
            if key not in ["id","name","group","x","y","z","fx","fy","fz","img","style_id","color","index"]:
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

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return


wkhtmltoimage_config = imgkit.config(wkhtmltoimage='./wkhtmltox/bin/wkhtmltoimage.exe')

node_styles = [
    "color: #000000; background: #ffffff; border: solid 6px #6091d3; border-radius: 7px;",
    "color: #000000; background: #ffffff; border: solid 6px #ffc06e; border-radius: 7px;",
    "color: #000000; background: #ffffff; border: solid 6px #1dc1d6; border-radius: 7px;",
    "color: #000000; background: #ffffff; border-top: solid 6px #5989cf; border-bottom: solid 6px #5989cf;",
    "color: #000000; background: #ffffff; border: dashed 6px #ffc3c3; border-radius: 7px;",
    "color: #000000; background: #ffffff; border: solid 6px #5bb7ae; border-radius: 7px;"
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
    node_img_dir_name = "web_src/assets/node_img"
    if os.path.exists(node_img_dir_name):
        shutil.rmtree(node_img_dir_name)
    os.makedirs(node_img_dir_name)  

    with concurrent.futures.ThreadPoolExecutor() as executor:
        executor.map(generate_image, node_data.get("nodes", []))

    return node_data

@eel.expose
def generate_image(node):
    if os.name == 'nt':  # Execute only on Windows
        import imgkit
        html = f"""
                <!DOCTYPE html>
                <html lang="ja">
                <head>
                    <meta charset="UTF-8">
                </head>
                <body style="margin: 0; padding: 0; background: white;"></body>
                    <div style="
                        display: inline-block;
                        padding: 10px;
                        font-size: 20px;
                        white-space: pre-wrap;
                        //text-align: center;
                        {node_styles[node['style_id']-1]}
                        ">{node['name']}</div>
                </body>
                </html>
                """
        options = {
            'width': '1200',
            'height': '1200'
        }
        #既存の画像がある場合は削除
        if 'isNew' not in node or node['isNew'] == False:
            if node['img'] != "logo.png":
                if os.path.exists(f"./web_src/assets/{node['img']}"):
                    os.remove(f"./web_src/assets/{node['img']}")

        #現在の日時をyyyy-MM-dd-HH-mm-ss形式で取得
        now = datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
        imgkit.from_string(html, f"./web_src/assets/node_img/{node['id']}_{now}.png", config=wkhtmltoimage_config, options=options)
        node['img'] = f"node_img/{node['id']}_{now}.png"

        img = Image.open(f"./web_src/assets/{node['img']}").convert("RGB")
        img = ImageOps.invert(img)

        print(node['img'])
        
        img = img.crop(img.getbbox())
        img = ImageOps.invert(img)
        mask = Image.new("L", img.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle((0, 0, img.width, img.height), 8, fill=255)
        img.putalpha(mask)
        img.save(f"./web_src/assets/{node['img']}", 'PNG')

        node['size_x'] = img.size[0]
        node['size_y'] = img.size[1]

    else:
        from jinja2 import Template
        from weasyprint import HTML
        from pdf2image import convert_from_bytes

        # HTMLテンプレート
        html_template = Template("""
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <style>
                * {
                    margin: 0;
                    padding: 5px;
                    box-sizing: border-box;
                }
                .node-content {
                    display: inline-block;
                    min-height: 60px;
                    min-width: 60px;
                    font-size: 20px;
                    //text-align: center;
                    white-space: pre-wrap;
                    {{ node_style }}
                }
                .node-text {
                    white-space: pre-wrap; /* Preserve whitespace and handle newlines */
                }
            </style>
        </head>
        <body>
            <div class="node-content">{{ node_name }}</div>
        </body>
        </html>
        """)

        # HTMLを生成
        html_content = html_template.render(
            node_style=node_styles[node['style_id']-1],
            node_name=node['name']
        )

        # デバッグ用：HTMLファイルを出力
        debug_dir = "debug_output"
        #if not os.path.exists(debug_dir):
        #    os.makedirs(debug_dir)
        
        now = datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
        #html_debug_path = f"{debug_dir}/node_{node['id']}_{now}.html"
        #with open(html_debug_path, 'w', encoding='utf-8') as f:
        #    f.write(html_content)

        #既存の画像がある場合は削除
        if 'isNew' not in node or node['isNew'] == False:
            if node['img'] != "logo.png":
                if os.path.exists(f"./web_src/assets/{node['img']}"):
                    os.remove(f"./web_src/assets/{node['img']}")

        #現在の日時をyyyy-MM-dd-HH-mm-ss形式で取得
        output_path = f"./web_src/assets/node_img/{node['id']}_{now}.png"
        pdf_debug_path = f"{debug_dir}/node_{node['id']}_{now}.pdf"

        # HTMLをPDFに変換
        html = HTML(string=html_content)
        pdf_bytes = html.write_pdf(presentational_hints=True)

        # デバッグ用：PDFファイルを出力
        #with open(pdf_debug_path, 'wb') as f:
        #    f.write(pdf_bytes)

        # PDFをPNGに変換
        images = convert_from_bytes(pdf_bytes)
        
        # 最初のページを保存（通常は1ページのみ）
        if images:
            img = ImageOps.invert(images[0])
            img = img.crop(img.getbbox())
            img = ImageOps.invert(img)
            mask = Image.new("L", img.size, 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.rounded_rectangle((0, 0, img.width, img.height), 17, fill=255)

            img.putalpha(mask)
            img.save(output_path, 'PNG')

        node['img'] = f"node_img/{node['id']}_{now}.png"
        node['size_x'] = img.size[0]
        node['size_y'] = img.size[1]
        print(node['img'])
        
    return node['img'], img.size

@eel.expose
def save_data(data):
    global g_current_file_path

    if g_current_file_path:
        save_json(data, g_current_file_path)
        return True
    else:
        # ファイルが選択されていない場合は保存ダイアログを表示
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
            return True
    return False

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

        # replace the port in the web files
        replace_file = findFileRe("./dist_vite/assets", "index.*.js")
        replaceInfile(f"./dist_vite/assets/{replace_file}", 'ws://localhost:....', f"ws://localhost:{eel_port}")
        replaceInfile("./dist_vite/index.html", 'http://localhost:.....eel.js', f"http://localhost:{eel_port}/eel.js")

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
