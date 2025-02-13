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
from py_src.contrib.replace_in_file import replaceInfile, findFileRe
from py_src.contrib.port_check import find_unused_port
import shutil
import eel
import imgkit
import concurrent.futures

g_node_data = {}
json_path = "./web_src/datasets/output.json"
def read_json():
    with open(json_path, "r", encoding="utf-8") as f:
        node_data = json.load(f)
    return node_data
def save_json(data):
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return


wkhtmltoimage_config = imgkit.config(wkhtmltoimage='./wkhtmltox/bin/wkhtmltoimage.exe')

node_styles = [
    "font-size: 32px; color: #6091d3; background: #FFF; border: solid 3px #6091d3; border-radius: 7px;",
    "font-size: 32px; color: #232323; background: #fff8e8; border-left: solid 6px #ffc06e;",
    "font-size: 32px; color: #00BCD4; background: #e4fcff; border-top: solid 6px #1dc1d6;",
    "font-size: 32px; color: #2c2c2f; background: #cde4ff; border-top: solid 6px #5989cf; border-bottom: solid 6px #5989cf;",
    "font-size: 32px; color: #565656; background: #ffeaea; border: dashed 4px #ffc3c3; border-radius: 8px;",
    "font-size: 32px; background: #f4f4f4; border-left: solid 6px #5bb7ae; "
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
def generate_image(node):
        html = f"""
                <!DOCTYPE html>
                <html lang="ja">
                <head>
                    <meta charset="UTF-8">
                </head>
                <body style="margin: 0; padding: 0; background: black;"></body>
                    <div style="
                        min-height: 120px;
                        min-width: 400px;
                        display: flex;
                        justify-content: center;
                        {node_styles[node['style_id']-1]}
                        ">
                        {node['name']}
                    </div>
                </body>
                </html>
                """
        options = {
            'width': '400',
            'height': '120'
        }
        #既存の画像がある場合は削除
        if os.path.exists(f"./web_src/assets/{node['img']}"):
            os.remove(f"./web_src/assets/{node['img']}")

        #現在の日時をyyyy-MM-dd-HH-mm-ss形式で取得
        now = datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
        imgkit.from_string(html, f"./web_src/assets/node_img/{node['id']}_{now}.png", config=wkhtmltoimage_config, options=options)
        node['img'] = f"node_img/{node['id']}_{now}.png"

        return node['img']
        
@eel.expose
def expand_user(folder):
    """Return the full path to display in the UI."""
    return '{}/*'.format(os.path.expanduser(folder))


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

    # 既に存在する場合は削除して再作成
    node_img_dir_name = "web_src/assets/node_img"
    if os.path.exists(node_img_dir_name):
        shutil.rmtree(node_img_dir_name)
    os.makedirs(node_img_dir_name)  

    g_node_data = read_json()
    with concurrent.futures.ThreadPoolExecutor() as executor:
        executor.map(generate_image, g_node_data.get("nodes", []))
    save_json(g_node_data)
    

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
