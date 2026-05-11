import time
from default_api import browser_click, browser_type, browser_press_key, browser_snapshot

async def add_node_sequence():
    # Helper function to open search modal
    async def open_search_modal():
        await browser_click(element="menu", ref="e5")
        await browser_click(element="edit Edit", ref="e172") # Assuming ref is stable
        await browser_click(element="Find …", ref="e189") # Assuming ref is stable

    # Helper function to search and select a node
    async def search_and_select_node(node_name):
        await browser_type(element="検索するノード名を入力", ref="e116", text=node_name)
        time.sleep(0.5) # Give time for search results to appear
        # The ref for the list item might change, so we use the text content
        await browser_click(element=node_name, ref=None) # ref=None to allow Playwright to find by text

    # Helper function to type into node editor and click OK
    async def type_and_ok_node_editor(node_name):
        await browser_type(element="Contents", ref="e53", text=node_name)
        await browser_click(element="OK", ref="e78")
        time.sleep(0.5) # Give time for node to be processed

    print("Starting node addition sequence...")

    # Add "Root Child 1" to "SpaceMind"
    await open_search_modal()
    await search_and_select_node("SpaceMind")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Root Child 1")
    print("Added 'Root Child 1'.")

    # Add "Root Child 2" to "SpaceMind"
    await open_search_modal()
    await search_and_select_node("SpaceMind")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Root Child 2")
    print("Added 'Root Child 2'.")

    # Add 3 children to "Root Child 1"
    await open_search_modal()
    await search_and_select_node("Root Child 1")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 1.1")
    print("Added 'Child 1.1'.")

    await open_search_modal()
    await search_and_select_node("Root Child 1")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 1.2")
    print("Added 'Child 1.2'.")

    await open_search_modal()
    await search_and_select_node("Root Child 1")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 1.3")
    print("Added 'Child 1.3'.")

    # Add 3 children to "Root Child 2"
    await open_search_modal()
    await search_and_select_node("Root Child 2")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 2.1")
    print("Added 'Child 2.1'.")

    await open_search_modal()
    await search_and_select_node("Root Child 2")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 2.2")
    print("Added 'Child 2.2'.")

    await open_search_modal()
    await search_and_select_node("Root Child 2")
    await browser_press_key(key="Enter")
    await type_and_ok_node_editor("Child 2.3")
    print("Added 'Child 2.3'.")

    print("Node addition sequence completed.")

# To run this script, you would typically call it from an async context, e.g.:
# import asyncio
# asyncio.run(add_node_sequence())
