#!/usr/bin/env python3
import json

def add_img_to_nodes(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for node in data.get("nodes", []):
        node_id = node.get("id")
        node["img"] = f"node_img/{node_id}.png"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Updated {file_path} successfully.")

if __name__ == "__main__":
    file_path = "web_src/datasets/output.json"
    add_img_to_nodes(file_path)
