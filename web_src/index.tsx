import React, {Suspense, useState,useEffect, useCallback,useRef} from 'react'
import ReactDOM from 'react-dom/client'

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";


import { Input, Button, Popover, message, Spin, Dropdown, Drawer, Modal, List } from 'antd';
import { MenuOutlined, SettingFilled, FileOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Menu } from 'antd';

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

type MenuItem = Required<MenuProps>['items'][number];

const items: MenuItem[] = [
  {
    label: 'File',
    key: 'file',
    icon: <FileOutlined rev={undefined} />,
    children: [
          { label: 'Open File …', key: 'open_file' },
          { label: 'Open Recent', key: 'open_recent' },
          
          { type: 'divider'},
     
          { label: 'Save', key: 'save' },
          { label: 'Save as …', key: 'save_as' },

          { type: 'divider'},

          { label: 'New Window', key: 'new_window' },
    ],
  },
  {
    label: 'Edit',
    key: 'edit',
    icon: <EditOutlined rev={undefined} />,
    children: [

        { label: 'Undo', key: 'undo' },
        { label: 'Redo', key: 'redo' },
        
        { type: 'divider'},

        { label: 'Cut', key: 'cut' },
        { label: 'Copy', key: 'copy' },
        { label: 'Paste', key: 'paste' },

        { type: 'divider'},

        { label: 'Find …', key: 'find' },
    ],
  }
];

const App = () => {
    const [x, setX] = useState(0)
    const [y, setY] = useState(0);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [currentFileName, setCurrentFileName] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
    const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
    const [isTreeDrawerOpen, setIsTreeDrawerOpen] = useState(false);
    const [current, setCurrent] = useState('mail');
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

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

    const [menuPosition, setMenuPosition] = useState<{x: number, y: number}>({x: 0, y: 0});
    const [menuOpen, setMenuOpen] = useState(false);

    const handleNodeEdit = (node:any) => {
        if(nodeEditorRef.current){
            setIsNodeEditorOpen(true);
            nodeEditorRef.current.showModal(node);
        }
    }

    
    const handleNodeRightClick = (node: any, x: number, y: number) => {
        setMenuPosition({x, y});
        setMenuOpen(true);
    };

    const handleMenuOpenChange = (open: boolean) => {
        setMenuOpen(open);
    };

    const menuItems: MenuProps['items'] = [
        {
            key: 'add',
            label: '追加',
            onClick: () => {
                if (mindMapGraphRef.current) {
                    mindMapGraphRef.current.addNewNode();
                }
            }
        },
        {
            key: 'edit',
            label: '編集',
            onClick: () => {
                const selectedNode = mindMapGraphRef.current?.getSelectedNode();
                if (selectedNode && nodeEditorRef.current) {
                    setIsNodeEditorOpen(true);
                    nodeEditorRef.current.showModal(selectedNode);
                }
            }
        },
        {
            key: 'copy',
            label: 'コピー',
            onClick: () => {
                if (mindMapGraphRef.current) {
                    mindMapGraphRef.current.copyNode();
                }
            }
        },
        {
            key: 'paste',
            label: '貼り付け',
            onClick: () => {
                if (mindMapGraphRef.current) {
                    const copied = mindMapGraphRef.current.getCopiedNode();
                    const selectedNode = mindMapGraphRef.current.getSelectedNode();
                    
                    if (copied) {
                        const keys = ['id','name','group','style_id','deadline','priority','urgency','disabled','icon_img',"size_x","size_y","fx","fy","fz","img"];
                        Object.keys(copied).forEach(key => {
                            if (!keys.includes(key)) {
                                delete copied[key];
                            }
                        });

                        mindMapGraphRef.current.addNode(copied);
                        
                        if (selectedNode) {
                            const data = mindMapGraphRef.current.getGraphData();
                            const pastedNode = data.nodes[data.nodes.length - 1];
                            mindMapGraphRef.current.addLink(selectedNode, pastedNode);
                        }
                    }
                }
            }
        },
        {
            key: 'delete',
            label: '削除',
            onClick: () => {
                const selectedNode = mindMapGraphRef.current?.getSelectedNode();
                if (selectedNode) {
                    mindMapGraphRef.current?.deleteNode(selectedNode);
                }
            }
        }
    ];

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

    const saveData = useCallback(async (saveFunction: (data: any) => Promise<any>) => {
        if(!mindMapGraphRef.current) return;
        
        let data = mindMapGraphRef.current.getGraphData();
        data.nodes = data.nodes.map((node: any) => {
            delete node.__threeObj;
            return node;
        });

        try {
            const result = await saveFunction(data);
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
    }, []);

    const handleSave = useCallback(() => {
        return saveData(eel.save_data);
    }, [saveData]);

    const handleSaveAs = useCallback(() => {
        return saveData(eel.save_as_data);
    }, [saveData]);

    const handleSearch = useCallback((text: string) => {
        if (!mindMapGraphRef.current || !text) return [];
        return mindMapGraphRef.current.searchNodes(text);
    }, []);

    const handleNodeSelect = useCallback((node: any) => {
        if (!mindMapGraphRef.current) return;
        mindMapGraphRef.current.selectNode(node);
    }, []);

    const keyFunction = useCallback((event:any) => {
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
            else if(event.code === "KeyF"){
                // 現在フォーカスされている要素がinput要素でない場合のみ検索モーダルを表示
                if (!(document.activeElement instanceof HTMLInputElement) &&
                    !(document.activeElement instanceof HTMLTextAreaElement)) {
                    event.preventDefault();
                    setIsSearchModalOpen(true);
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
                mindMapGraphRef.current!.setFuncMode(true);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Control') {
                mindMapGraphRef.current!.setFuncMode(false);
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
      }, [keyFunction, isNodeEditorOpen, isLinkEditorOpen, isTreeDrawerOpen]);



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
            <Button 
                icon={<MenuOutlined rev={undefined} />}
                onClick={() => setDrawerVisible(true)}
                style={{
                    position: 'fixed',
                    left: 10,
                    top: 10,
                    zIndex: 1000
                }}
            />
            <Drawer
                title=""
                placement="top"
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                closeIcon={false}
                height={46}
                styles={{
                    body: {
                        padding: "0px"
                    }
                }}
            >
                <Menu 
                    mode="horizontal"
                    items={items}
                    theme="dark"
                    selectedKeys={[current]}
                    onClick={({ key }) => {
                        setCurrent(key);
                        setDrawerVisible(false);
                        if (key === 'open_file') {
                            handleFileSelect();
                        } else if (key === 'new_window') {
                            window.open(window.location.href, '_blank');
                        } else if (key === 'save') {
                            handleSave();
                        } else if (key === 'save_as') {
                            handleSaveAs();
                        } else if (key === 'undo') {
                            if (mindMapGraphRef.current && mindMapGraphRef.current.canUndo()) {
                                mindMapGraphRef.current.undo();
                            } else {
                                message.info('元に戻せる操作がありません');
                            }
                        } else if (key === 'redo') {
                            if (mindMapGraphRef.current && mindMapGraphRef.current.canRedo()) {
                                mindMapGraphRef.current.redo();
                            } else {
                                message.info('やり直せる操作がありません');
                            }
                        } else if (key === 'copy') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.copyNode();
                            }
                        } else if (key === 'cut') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.copyNode();
                                const selectedNode = mindMapGraphRef.current.getSelectedNode();
                                if (selectedNode) {
                                    mindMapGraphRef.current.deleteNode(selectedNode);
                                }
                            }
                        } else if (key === 'paste') {
                            if (mindMapGraphRef.current) {
                                const copied = mindMapGraphRef.current.getCopiedNode();
                                const selectedNode = mindMapGraphRef.current.getSelectedNode();
                                
                                if (copied) {
                                    const keys = ['id','name','group','style_id','deadline','priority','urgency','disabled','icon_img',"size_x","size_y","fx","fy","fz","img"];
                                    Object.keys(copied).forEach(key => {
                                        if (!keys.includes(key)) {
                                            delete copied[key];
                                        }
                                    });

                                    mindMapGraphRef.current.addNode(copied);
                                    
                                    if (selectedNode) {
                                        const data = mindMapGraphRef.current.getGraphData();
                                        const pastedNode = data.nodes[data.nodes.length - 1];
                                        mindMapGraphRef.current.addLink(selectedNode, pastedNode);
                                    }
                                }
                            }
                        } else if (key === 'find') {
                            setIsSearchModalOpen(true);
                        }
                    }}
                />
            </Drawer>

        <MindMapGraph 
            ref={mindMapGraphRef}
            onHover={handleHover}
            onNodeEdit={handleNodeEdit}
            onRefreshNode={handleRefreshNode}
            onNodeRightClick={handleNodeRightClick}
            onLinkEdit={handleLinkEdit}
            onOpenFile={handleOpenFile}
            onOpenFolder={handleOpenFolder} />
            
        <div style={{ position: 'relative' }}>
            <Dropdown 
                menu={{
                    items: menuItems,
                    onClick: () => {
                        setMenuOpen(false);
                    }
                }}
                open={menuOpen}
                onOpenChange={handleMenuOpenChange}
                trigger={['contextMenu']}
                dropdownRender={(menu) => (
                    <div style={{
                        position: 'fixed',
                        left: menuPosition.x,
                        top: menuPosition.y,
                    }}>
                        {menu}
                    </div>
                )}
            >
                <div style={{ width: '100%', height: '100%' }} />
            </Dropdown>
        </div>

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

        <FloatButton 
            icon={<SettingFilled rev={undefined} />}
            onClick={() => showDrawer()}
            style={{
                right: 24,
                top: 24
            }}
        />

        <Modal
            title="ノード検索"
            open={isSearchModalOpen}
            afterOpenChange={(visible) => {
                if (visible) {
                    // モーダルが開いた後に実行
                    setTimeout(() => {
                        const input = document.querySelector('.ant-modal .ant-input') as HTMLInputElement;
                        if (input) {
                            input.focus();
                        }
                    }, 100);
                }
            }}
            onCancel={() => {
                setIsSearchModalOpen(false);
                setSearchText('');
                setSearchResults([]);
            }}
            footer={null}
        >
            <Input
                placeholder="検索するノード名を入力"
                value={searchText}
                onChange={(e) => {
                    setSearchText(e.target.value);
                    if (mindMapGraphRef.current) {
                        const results = mindMapGraphRef.current.searchNodes(e.target.value);
                        setSearchResults(results);
                    }
                }}
                style={{ marginBottom: 16 }}
            />
            <List
                dataSource={searchResults}
                renderItem={(item) => (
                    <List.Item
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.selectNode(item);
                                setIsSearchModalOpen(false);
                                setSearchText('');
                                setSearchResults([]);
                            }
                        }}
                    >
                        {item.name}
                    </List.Item>
                )}
            />
        </Modal>

        </Spin>
    );

}



ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>,
);
