import time
# default_apiはエージェントの実行環境で提供されるため、通常のPython環境ではインポートできません。
# このスクリプトはエージェントが実行することを想定しています。
from default_api import browser_click, browser_type, browser_press_key, browser_snapshot

async def add_node_sequence():
    # ヘルパー関数：検索モーダルを開く
    async def open_search_modal():
        await browser_click(element="menu", ref="e5")
        # ref値はUIの変更により変わる可能性があります。必要に応じて更新してください。
        await browser_click(element="edit Edit", ref="e31") 
        await browser_click(element="Find …", ref="e48") 

    # ヘルパー関数：ノードを検索して選択する
    async def search_and_select_node(node_name):
        await browser_type(element="検索するノード名を入力", ref="e59", text=node_name)
        time.sleep(0.5) # 検索結果が表示されるまで待機
        # 検索結果のリストアイテムのrefは動的に変わる可能性があるため、テキスト内容で指定します。
        await browser_click(element=node_name, ref=None) 

    # ヘルパー関数：ノードエディタに入力し、OKをクリックする
    async def type_and_ok_node_editor(node_name):
        await browser_type(element="Contents", ref="e93", text=node_name)
        await browser_click(element="OK", ref="e118")
        time.sleep(0.5) # ノード処理の待機

    print("ノード追加シーケンスを開始します...")

    # 1. 「Root Child 1」を「SpaceMind」に追加
    print("'Root Child 1' を 'SpaceMind' に追加中...")
    await open_search_modal()
    await search_and_select_node("SpaceMind")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Root Child 1")
    print("'Root Child 1' を追加しました。")

    # 2. 「Root Child 2」を「SpaceMind」に追加
    print("'Root Child 2' を 'SpaceMind' に追加中...")
    await open_search_modal()
    await search_and_select_node("SpaceMind")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Root Child 2")
    print("'Root Child 2' を追加しました。")

    # 3. 「Root Child 1」に3つの子ノードを追加
    print("'Root Child 1' に子ノードを追加中...")
    await open_search_modal()
    await search_and_select_node("Root Child 1")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 1.1")
    print("'Child 1.1' を追加しました。")

    await open_search_modal()
    await search_and_select_node("Root Child 1")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 1.2")
    print("'Child 1.2' を追加しました。")

    await open_search_modal()
    await search_and_select_node("Root Child 1")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 1.3")
    print("'Child 1.3' を追加しました。")

    # 4. 「Root Child 2」に3つの子ノードを追加
    print("'Root Child 2' に子ノードを追加中...")
    await open_search_modal()
    await search_and_select_node("Root Child 2")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 2.1")
    print("'Child 2.1' を追加しました。")

    await open_search_modal()
    await search_and_select_node("Root Child 2")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 2.2")
    print("'Child 2.2' を追加しました。")

    await open_search_modal()
    await search_and_select_node("Root Child 2")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 2.3")
    print("'Child 2.3' を追加しました。")

    print("ノード追加シーケンスが完了しました。")

# このスクリプトは、エージェントが実行することを想定しています。
# ユーザーが直接実行する場合、default_apiのインポートエラーが発生します。
