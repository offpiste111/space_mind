import React, {Suspense, useState,useEffect, useCallback,useRef} from 'react'
import ReactDOM from 'react-dom/client'

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";


import { Input , Button, Popover, message, Spin} from 'antd';  

import MindMapGraph from './MindMapGraph'
import NodeEditor from './NodeEditor'
import LinkEditor from './LinkEditor'
import TreeDrawer from './TreeDrawer'
import { FloatButton } from 'antd';

declare const window: any;
export const eel = window.eel
eel.set_host( 'ws://localhost:5169' )

// Expose the `sayHelloJS` function to Python as `say_hello_js`
function sayHelloJS( x: any ) {
  console.log( 'Hello from ' + x )
}
// WARN: must use window.eel to keep parse-able eel.expose{...}
window.eel.expose( sayHelloJS, 'say_hello_js' )

const App = () => {
    const [x, setX] = useState(0)
    const [y, setY] = useState(0);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [currentFileName, setCurrentFileName] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
    const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
    const [isTreeDrawerOpen, setIsTreeDrawerOpen] = useState(false);

    const handleFileSelect = async () => {
        setLoading(true);
        try {
            const node_data = await eel.select_file_dialog()();
            if (node_data) {
                node_data.nodes = node_data.nodes.map((node: any) => {
                    //node['fx'] = node['x']
                    //node['fy'] = node['y']
                    //node['fz'] = node['z']
                    //delete node['fx']; 
                    //delete node['fy']; 
                    //delete node['fz']; 
                    return node;
                });
                if (mindMapGraphRef.current) {
                    mindMapGraphRef.current.setGraphData(node_data);
                }
            }
        } catch (error) {
            console.error('Error loading file:', error);
            message.error('ファイルの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    // ファイルを開く関数
    const handleOpenFile = async (node: any) => {
        if (!node || !node.file_path) return;
        
        try {
            const result = await eel.open_file(node.file_path)();
            if (result) {
                console.log(`File opened: ${node.file_path}`);
                message.success(`ファイルを開きました: ${node.file_path}`);
            } else {
                console.error(`Failed to open file: ${node.file_path}`);
                message.error(`ファイルを開けませんでした: ${node.file_path}`);
            }
        } catch (error) {
            console.error('Error opening file:', error);
            message.error('ファイルを開く際にエラーが発生しました');
        }
    };

    // フォルダを開く関数
    const handleOpenFolder = async (node: any) => {
        if (!node || !node.folder_path) return;
        
        try {
            const result = await eel.open_folder(node.folder_path)();
            if (result) {
                console.log(`Folder opened: ${node.folder_path}`);
                message.success(`フォルダを開きました: ${node.folder_path}`);
            } else {
                console.error(`Failed to open folder: ${node.folder_path}`);
                message.error(`フォルダを開けませんでした: ${node.folder_path}`);
            }
        } catch (error) {
            console.error('Error opening folder:', error);
            message.error('フォルダを開く際にエラーが発生しました');
        }
    };

    // 初期データの読み込み
    useEffect(() => {
        if (mindMapGraphRef.current) {
            eel.init();
            mindMapGraphRef.current.setGraphData({nodes:[],links:[]});
        }
    }, []);

    interface MindMapGraphRef {
        getGraphData: () => any;
        setGraphData: (data: any) => void;
        refreshNode: (node: any) => void;
        deleteNode: (node: any) => void;
        refreshLink: (link: any) => void;
        deleteLink: (link: any) => void;
        searchNodes: (text: string) => any[];
        selectNode: (node: any) => void;
        copyNode: () => void;
        getCopiedNode: () => any;
        getSelectedNode: () => any;
        getSelectedNodeList: () => any[];
        clearSelectedNode: () => void;
        clearSelectedNodeList: () => void;
        setSelectedNodeList: (nodes: any[]) => void;
        addNode: (node: any) => void;
        addNewNode: () => void;
        addLink: (source: any, target: any) => void;
        setFuncMode: (mode: boolean) => void;
        canUndo: () => boolean;
        undo: () => void;
        canRedo: () => boolean;
        redo: () => void;
    }

    interface ModalRef {
        showModal: (data: any) => void;
    }

    interface TreeDrawerRef {
        showDrawer: () => void;
    }

    const mindMapGraphRef = useRef<MindMapGraphRef>(null)
    const nodeEditorRef = useRef<ModalRef>(null)
    const linkAddModalRef = useRef<ModalRef>(null)
    const treeDrawerRef = useRef<TreeDrawerRef>(null)


  
    const handleNodeEdit = (node:any) => {
        if(nodeEditorRef.current){
            setIsNodeEditorOpen(true);
            nodeEditorRef.current.showModal(node);
        }
        //setIsNodeEditorOpen(true);

        /*
        if (document.getElementById("add_popup") !== null)
        {
            document.getElementById("add_popup")?.click();
        }
        */

    }

    const handleLinkEdit = (link:any) => {
        if(linkAddModalRef.current){
            setIsLinkEditorOpen(true);
            linkAddModalRef.current.showModal(link);
        }
    }

    const handleRefreshLink = (link:any) => {
        if(mindMapGraphRef.current){
            mindMapGraphRef.current.refreshLink(link);
        }
    }

    const handleDeleteLink = (link:any) => {
        if(mindMapGraphRef.current){
            mindMapGraphRef.current.deleteLink(link);
        }
    }

    const handleRefreshNode = (node:any) => {
        sayHelloJS( 'Javascript World!' )
        eel.say_hello_py( 'Javascript World!' )
        
        // icon_sizeがある場合はそれを渡し、なければデフォルト値(300)を使用
        const maxSize = node.icon_size || 300;
        
        eel.generate_image(node)((generatedImage: any) => {
            let result = generatedImage;
            node.img = result[0];
            node.size_x = result[1][0];
            node.size_y = result[1][1];
            if(mindMapGraphRef.current){
                mindMapGraphRef.current.refreshNode(node);
            }
        })
    }

    const handleDeleteNode = (node:any) => {
        if (mindMapGraphRef.current) {
            mindMapGraphRef.current.deleteNode(node);
        }
    }
     
    const handleHover = (node_x:number, node_y:number) => {
        

        //setX(node_x);
        //setY(node_y);

    }

    const showDrawer = () => {
        if (treeDrawerRef.current){
            setIsTreeDrawerOpen(true);
            treeDrawerRef.current.showDrawer();
        }

    }

    const handleSave = useCallback(async () => {
        if(mindMapGraphRef.current){
            let data = mindMapGraphRef.current.getGraphData();

            //data.nodes.__threeObjを削除する
            data.nodes = data.nodes.map((node: any) => {
                delete node.__threeObj;
                return node;
            });
            console.log(data)
            try {
                const result = await eel.save_data(data)();
                if (result && result[0]) {
                    const filename = result[1];
                    message.success({
                        content: `${filename}に保存しました`,
                        duration: 3,
                    });
                    setCurrentFileName(filename);
                } else {
                    message.error('保存に失敗しました');
                }
            } catch (error) {
                console.error('Error saving file:', error);
                message.error('保存に失敗しました');
            }
        }
    }, []);

    const handleSearch = useCallback((text: string) => {
        if (!mindMapGraphRef.current || !text) return [];
        return mindMapGraphRef.current.searchNodes(text);
    }, []);

    const handleNodeSelect = useCallback((node: any) => {
        if (!mindMapGraphRef.current) return;
        mindMapGraphRef.current.selectNode(node);
    }, []);

    const keyFunction = useCallback((event:any) => {
        // いずれかのエディターが開いているときはキー受付を無効化
        if (isNodeEditorOpen || isLinkEditorOpen || isTreeDrawerOpen) return;
        if(event.ctrlKey) {
            if(event.code === "KeyS"){
                event.preventDefault();
                handleSave();
            }
            else if(event.code === "KeyZ"){
                event.preventDefault();
                if(mindMapGraphRef.current) {
                    if(mindMapGraphRef.current.canUndo()) {
                        mindMapGraphRef.current.undo();
                        console.log("Undo operation via Ctrl+Z");
                    } else {
                        message.info('元に戻せる操作がありません');
                    }
                }
            }
            else if(event.code === "KeyY"){
                event.preventDefault();
                if(mindMapGraphRef.current) {
                    if(mindMapGraphRef.current.canRedo()) {
                        mindMapGraphRef.current.redo();
                        console.log("Redo operation via Ctrl+Y");
                    } else {
                        message.info('やり直せる操作がありません');
                    }
                }
            }
            else if(event.code === "KeyC"){
                if(mindMapGraphRef.current) {
                    (mindMapGraphRef.current as any).copyNode();
                    console.log("Node copied via Ctrl+C");
                }
            }
            else if(event.code === "KeyX"){
                if(mindMapGraphRef.current) {
                    // 最初にノードをコピー
                    (mindMapGraphRef.current as any).copyNode();
                    
                    // 選択中のノードを削除
                    const selectedNode = mindMapGraphRef.current.getSelectedNode();
                    if (selectedNode) {
                        mindMapGraphRef.current.deleteNode(selectedNode);
                        console.log("Node cut via Ctrl+X");
                    }
                }
            }
            else if(event.code === "KeyV"){
                if(mindMapGraphRef.current) {
                    const copied = (mindMapGraphRef.current as any).getCopiedNode();
                    const selectedNode = (mindMapGraphRef.current as any).getSelectedNode();
                    
                    if(copied) {
                        //必要なキーのリスト
                        const keys = ['id','name','group','style_id','deadline','priority','urgency','disabled','icon_img',"size_x","size_y","fx","fy","fz","img"];
                        //必要なキーだけを残し他は削除する
                        Object.keys(copied).forEach(key => {
                            if(!keys.includes(key)){
                                delete copied[key];
                            }
                        });

                        mindMapGraphRef.current.addNode(copied);
                        
                        // 選択中のノードがある場合、貼り付けたノードとのリンクを作成
                        if (selectedNode) {
                            const data = mindMapGraphRef.current.getGraphData();
                            const pastedNode = data.nodes[data.nodes.length - 1]; // 最後に追加されたノード
                            mindMapGraphRef.current.addLink(selectedNode, pastedNode);
                        }
                        
                        console.log("Add Node:",copied);
                    } else {
                        console.log("No node to paste");
                    }
                }
            }
            // Ctrl+A で全ノード選択
            else if(event.code === "KeyA"){
                event.preventDefault(); // デフォルトの全選択を防ぐ
                if(mindMapGraphRef.current) {
                    const data = mindMapGraphRef.current.getGraphData();
                    mindMapGraphRef.current.clearSelectedNode();
                    mindMapGraphRef.current.setSelectedNodeList(data.nodes);
                }
            }
        }
        else if(event.key === "Enter" && !event.shiftKey) {
            if(mindMapGraphRef.current) {
                mindMapGraphRef.current.addNewNode();
            }
        }
        else if(event.key === "Escape") {
            if(mindMapGraphRef.current) {
                mindMapGraphRef.current.clearSelectedNode();
                mindMapGraphRef.current.clearSelectedNodeList();
            }
        }
        else if(event.key === "L" || event.key === "l") {
            const mindMap = mindMapGraphRef.current;
            if(mindMap) {
                const selectedNode = mindMap.getSelectedNode();
                const selectedNodeList = mindMap.getSelectedNodeList();
                if(selectedNode && selectedNodeList && selectedNodeList.length > 0) {
                    selectedNodeList.forEach((target: any) => {
                        mindMap.addLink(selectedNode, target);
                    });
                }
            }
        }
        else if(event.key === "Delete") {
            if(mindMapGraphRef.current) {
                // 通常選択されたノードを削除
                const selectedNode = mindMapGraphRef.current!.getSelectedNode();
                if (selectedNode) {
                    mindMapGraphRef.current!.deleteNode(selectedNode);
                }
                
                // 複数選択されたノードを削除
                const selectedNodes = mindMapGraphRef.current!.getSelectedNodeList();
                if (selectedNodes && selectedNodes.length > 0) {
                    selectedNodes.forEach(node => {
                        mindMapGraphRef.current!.deleteNode(node);
                    });
                }
            }
        }
      }, [handleSave, isNodeEditorOpen, isLinkEditorOpen, isTreeDrawerOpen]);
    
      useEffect(() => {
        // キーボードイベントのリスナーを追加
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Control') {
                if(!isCtrlPressed){
                    mindMapGraphRef.current!.setFuncMode(true);
                }
                setIsCtrlPressed(true);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Control') {
                if(isCtrlPressed){
                    mindMapGraphRef.current!.setFuncMode(false);
                }
                setIsCtrlPressed(false);
            }
        };

        document.addEventListener("keydown", keyFunction, false);
        document.addEventListener("keydown", handleKeyDown, false);
        document.addEventListener("keyup", handleKeyUp, false);

        return () => {
            document.removeEventListener("keydown", keyFunction, false);
            document.removeEventListener("keydown", handleKeyDown, false);
            document.removeEventListener("keyup", handleKeyUp, false);
        };
      }, [keyFunction, isCtrlPressed, isNodeEditorOpen, isLinkEditorOpen, isTreeDrawerOpen]);



    const setCss = (x:number,y:number) =>(
        css`
          position: absolute;
          opacity: 0;
          top: ${y}px;
          left: ${x}px;
        `
      );

    const content = (
        <div>
          <Input placeholder="Contents" />

        </div>
      );

    return (
        <Spin spinning={loading} tip="ファイルを読み込み中...">
        <MindMapGraph 
            ref={mindMapGraphRef}
            onHover={handleHover}
            onRefreshNode={handleRefreshNode}
            onNodeEdit={handleNodeEdit}
            onLinkEdit={handleLinkEdit}
            onOpenFile={handleOpenFile}
            onOpenFolder={handleOpenFolder} />

        <Popover content={content} title="Node Edit" trigger="click" >
            <Button id="add_popup" css={setCss(x,y)}></Button>
        </Popover>

        <NodeEditor
            ref={nodeEditorRef}
            onRefreshNode={handleRefreshNode}
            onDeleteNode={handleDeleteNode}
            onClose={() => setIsNodeEditorOpen(false)}
            open={isNodeEditorOpen} />

        <LinkEditor
            ref={linkAddModalRef}
            onRefreshLink={handleRefreshLink}
            onDeleteLink={handleDeleteLink}
            onSelectNode={handleNodeSelect}
            onClose={() => setIsLinkEditorOpen(false)}
            open={isLinkEditorOpen} />

        <TreeDrawer
            ref={treeDrawerRef}
            onSave={handleSave}
            onSearch={handleSearch}
            onNodeSelect={handleNodeSelect}
            onFileSelect={handleFileSelect}
            currentFileName={currentFileName}
            onClose={() => setIsTreeDrawerOpen(false)}
            open={isTreeDrawerOpen} />

        <FloatButton onClick={() => showDrawer()} />

        </Spin>
    );

}



ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>

    <App/>

  </React.StrictMode>,
);
