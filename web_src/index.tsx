import React, {Suspense, useState,useEffect, useCallback,useRef} from 'react'
import ReactDOM from 'react-dom/client'

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";


import { Input, Button, Popover, message, Spin, Dropdown, Drawer, Modal, List, ConfigProvider } from 'antd';
import { MenuOutlined, SettingFilled, FileOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Menu } from 'antd';

import MindMapGraph from './MindMapGraph'
import NodeEditor from './NodeEditor'
import LinkEditor from './LinkEditor'
import GroupEditor from './GroupEditor'
import { FloatButton } from 'antd';
import { NODE_CONSTANTS } from './constants';

import { storageService } from './services';

declare const window: any;
export const eel = window.eel;

// Expose the `sayHelloJS` function to Python as `say_hello_js`
function sayHelloJS( x: any ) {
  //console.log( 'Hello from ' + x )
}

if (eel && import.meta.env.VITE_APP_MODE !== 'web') {
  try {
    eel.set_host( 'ws://localhost:5169' );
    window.eel.expose( sayHelloJS, '' );
  } catch (e) {
    console.warn("Failed to initialize Eel:", e);
  }
}

interface MindMapGraphRef {
    getGraphData: () => any;
    setGraphData: (data: any) => void;
    refreshNode: (node: any, options?: { skipHistory?: boolean, initialNode?: any }) => void;
    deleteNode: (node: any) => void;
    refreshLink: (link: any) => void;
    deleteLink: (link: any) => void;
    searchNodes: (text: string) => any[];
    selectNode: (node: any) => void;
    focusOnNode: (node: any) => void;
    copyNode: () => void;
    getCopiedNode: () => any;
    getSelectedNode: () => any;
    getSelectedNodeList: () => any[];
    getGroups: () => any[];
    updateGroup: (group: any, nodeIds: number[]) => void;
    deleteGroup: (groupId: number) => void;
    clearSelectedNode: () => void;
    clearSelectedNodeList: () => void;
    setSelectedNodeList: (nodes: any[]) => void;
    addNode: (node: any, parentNode?: any) => any;
    addNewNode: () => void;
    addLink: (source: any, target: any) => void;
    setFuncMode: (mode: boolean) => void;
    canUndo: () => boolean;
    undo: () => boolean;
    canRedo: () => boolean;
    redo: () => boolean;
    arrangeNodes: (layout: string) => void;
    setForceMode: (enabled: boolean) => void;
    getCameraState: () => any;
    setGlobalBackground: (bg: string) => void;
    getNodeScreenCoords: (node: any) => { x: number, y: number } | null;
}

interface ModalRef {
    showModal: (data: any, coords?: { x: number, y: number } | null) => void;
}

type MenuItem = Required<MenuProps>['items'][number];

const App = () => {
    const mindMapGraphRef = useRef<MindMapGraphRef>(null)
    const nodeEditorRef = useRef<ModalRef>(null)
    const linkAddModalRef = useRef<ModalRef>(null)
    const groupEditorRef = useRef<any>(null)
    const [x, setX] = useState(0)
    const [y, setY] = useState(0);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [currentFileName, setCurrentFileName] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
    const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
    const [isGroupEditorOpen, setIsGroupEditorOpen] = useState(false);
    const [groupActiveNode, setGroupActiveNode] = useState<any>(null);
    const [current, setCurrent] = useState('mail');
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [recentFiles, setRecentFiles] = useState<string[]>([]);
    const [isForceMode, setIsForceMode] = useState<boolean>(false);
    const [isParticlesEnabled, setIsParticlesEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem('space_mind_particles_enabled');
        return saved !== 'false';
    });

    useEffect(() => {
        localStorage.setItem('space_mind_particles_enabled', String(isParticlesEnabled));
    }, [isParticlesEnabled]);

    const handleOpenRecent = async (path: string) => {
        setLoading(true);
        try {
            const node_data = await storageService.loadJsonByPath(path);
            if (node_data) {
                const loadedForce = node_data.layoutMode === 'force';
                setIsForceMode(loadedForce);
                if (mindMapGraphRef.current) {
                    mindMapGraphRef.current.setGraphData(node_data);
                }
            }
        } catch (error) {
            console.error('Error loading recent file:', error);
            message.error('最近のファイルの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const getMenuItems = (recentFiles: string[]): MenuItem[] => [
        {
            label: 'File',
            key: 'file',
            icon: <FileOutlined rev={undefined} />,
            children: [
                { label: 'Open File …', key: 'open_file' },
                {
                    label: 'Open Recent',
                    key: 'open_recent',
                    children: recentFiles.map(file => ({
                        label: file,
                        key: `recent_file_${file}`,
                    })),
                },
                { type: 'divider' },
                { label: 'Import …', key: 'import_file' },
                { type: 'divider' },
                { label: 'Save', key: 'save' },
                { label: 'Save as …', key: 'save_as' },
                { type: 'divider' },
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
                { type: 'divider' },
                { label: 'Cut', key: 'cut' },
                { label: 'Copy', key: 'copy' },
                { label: 'Paste', key: 'paste' },
                { type: 'divider' },
                { label: 'Find …', key: 'find' },
            ],
        },
        {
            label: 'Layout',
            key: 'layout',
            icon: <SettingOutlined rev={undefined} />,
            children: [
                {
                    label: 'Tree Layout',
                    key: 'tree_layout',
                    children: [
                        { label: 'Right', key: 'right_tree_layout' },
                        { label: 'Left', key: 'left_tree_layout' },
                        { label: 'Upper', key: 'up_tree_layout' },
                        { label: 'lower', key: 'low_tree_layout' },
                    ],
                },
                { label: 'Circle Layout', key: 'circle_layout' },
                { label: 'Free Layout', key: 'free_layout' }
            ],
        },
        {
            label: 'Background',
            key: 'background',
            icon: <SettingOutlined rev={undefined} />,
            children: [
                { label: 'Space', key: 'bg_space' },
                { label: 'Sky', key: 'bg_sky' },
                { label: 'Snowy Morning', key: 'bg_snow' },
                { label: 'Sunset', key: 'bg_sunset' },
                { label: 'None', key: 'bg_none' }
            ],
        },
        {
            label: 'Setting',
            key: 'setting',
            icon: <SettingFilled rev={undefined} />,
            children: [
                { label: isForceMode ? 'Force layout: OFFにする' : 'Force layout: ONにする', key: 'setting_force_toggle' },
                { label: isParticlesEnabled ? 'Particles: OFFにする' : 'Particles: ONにする', key: 'setting_particles_toggle' }
            ],
        }
    ];

    const handleFileSelect = async () => {
        setLoading(true);
        try {
            const node_data = await storageService.selectFileDialog();
            if (node_data) {
                const loadedForce = node_data.layoutMode === 'force';
                setIsForceMode(loadedForce);
                node_data.nodes = node_data.nodes.map((node: any) => {
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

    const handleImportFile = async () => {
        setLoading(true);
        try {
            const result = await (storageService as any).importMarkdownDialog();
            if (result) {
                const [node_data, file_path] = result;
                if (node_data) {
                    const loadedForce = node_data.layoutMode === 'force';
                    setIsForceMode(loadedForce);
                    if (mindMapGraphRef.current) {
                        mindMapGraphRef.current.setGraphData(node_data);
                    }
                    message.success(`Markdownファイルをインポートしました: ${file_path}`);
                }
            }
        } catch (error) {
            console.error('Error importing file:', error);
            message.error('Markdownファイルのインポートに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    // ファイルを開く関数
    const handleOpenFile = async (node: any) => {
        if (!node || !node.file_path) return;
        
        try {
            const result = await storageService.openFile(node.file_path);
            if (result) {
                console.log(`File opened: ${node.file_path}`);
                message.success(`ファイルを開きました: ${node.file_path}`);
            } else {
                console.error(`Failed to open file: ${node.file_path}`);
                message.error(`ファイルを開けませんでした: ${node.file_path}`);
            }
        } catch (error: any) {
            console.error('Error opening file:', error);
            message.error(error.message || 'ファイルを開く際にエラーが発生しました');
        }
    };

    // フォルダを開く関数
    const handleOpenFolder = async (node: any) => {
        if (!node || !node.folder_path) return;
        
        try {
            const result = await storageService.openFolder(node.folder_path);
            if (result) {
                console.log(`Folder opened: ${node.folder_path}`);
                message.success(`フォルダを開きました: ${node.folder_path}`);
            } else {
                console.error(`Failed to open folder: ${node.folder_path}`);
                message.error(`フォルダを開けませんでした: ${node.folder_path}`);
            }
        } catch (error: any) {
            console.error('Error opening folder:', error);
            message.error(error.message || 'フォルダを開く際にエラーが発生しました');
        }
    };

    const hasInitialized = useRef(false);
    // 初期データの読み込み
    useEffect(() => {
        if (mindMapGraphRef.current && !hasInitialized.current) {
            hasInitialized.current = true;
            storageService.init();
            mindMapGraphRef.current.setGraphData({nodes:[],links:[]});
        }
    }, [mindMapGraphRef.current]);



    useEffect(() => {
        if (window.eel && mindMapGraphRef.current) {
            window.eel.expose(mindMapGraphRef.current.getGraphData, 'get_graph_data');
        }
    }, [mindMapGraphRef.current]);

    const resetGraph = useCallback(() => {
        setIsForceMode(false);
        if (mindMapGraphRef.current) {
            const now = new Date().toISOString();
            mindMapGraphRef.current.setGraphData({
                nodes: [{
                    id: 1,
                    img: "logo.png",
                    type: "issue",
                    group: 1,
                    style_id: 1,
                    fx: 0,
                    fy: 0,
                    fz: -300,
                    size_x: 300,
                    size_y: 200,
                    name: "",
                    createdAt: now,
                    updatedAt: now
                }],
                links: []
            });
        }
    }, []);

    useEffect(() => {
        if (window.eel) {
            window.eel.expose(resetGraph, 'reset_graph');
        }
    }, [resetGraph]);

    const [menuPosition, setMenuPosition] = useState<{x: number, y: number}>({x: 0, y: 0});
    const [menuOpen, setMenuOpen] = useState(false);

    const handleNodeEdit = (node:any) => {
        if(nodeEditorRef.current){
            const coords = mindMapGraphRef.current?.getNodeScreenCoords(node);
            setIsNodeEditorOpen(true);
            const graphData = mindMapGraphRef.current?.getGraphData();
            const isChild = graphData ? graphData.links.some((l: any) => {
                if (l.type === 'friend') return false;
                const targetId = (l.target && typeof l.target === 'object') ? l.target.id : l.target;
                return String(targetId) === String(node.id);
            }) : false;
            nodeEditorRef.current.showModal({ ...node, isChild }, coords);
        }
    }

    
    const handleNodeRightClick = (node: any, x: number, y: number) => {
        if (mindMapGraphRef.current) {
            mindMapGraphRef.current.selectNode(node);
        }
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
                    const coords = mindMapGraphRef.current?.getNodeScreenCoords(selectedNode);
                    setIsNodeEditorOpen(true);
                    nodeEditorRef.current.showModal(selectedNode, coords);
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
                        const keys = [
                            'name', 'group', 'style_id', 'deadline', 'priority', 'urgency', 
                            'disabled', 'icon_img', 'size_x', 'size_y', 'img', 'type', 
                            'url', 'file_path', 'folder_path', 'node_bg_color', 
                            'node_pattern_color', 'node_custom_bg_color'
                        ];
                        Object.keys(copied).forEach(key => {
                            if (!keys.includes(key)) {
                                delete copied[key];
                            }
                        });

                        mindMapGraphRef.current.addNode(copied, selectedNode);
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
        },
        {
            key: 'group_submenu',
            label: 'グループ',
            children: (() => {
                const activeNode = mindMapGraphRef.current?.getSelectedNode();
                const selectedNodes = mindMapGraphRef.current?.getSelectedNodeList() || [];
                const allNodes = mindMapGraphRef.current?.getGraphData().nodes || [];
                const groups = mindMapGraphRef.current?.getGroups() || [];

                // 「追加」のアクション
                const handleAddGroup = () => {
                    if (!activeNode) return;
                    // 新規グループを作成
                    const newGroupId = groups.length > 0 ? Math.max(...groups.map((g: any) => g.id)) + 1 : 1;
                    const newGroup = {
                        id: newGroupId,
                        name: `グループ ${newGroupId}`,
                        color: '#4c9ac0'
                    };

                    // 選択中の全ノード、もしくはアクティブノード
                    const nodesToAssign = selectedNodes.length > 0 ? selectedNodes : [activeNode];
                    const initialMemberIds = nodesToAssign.map((n: any) => n.id);

                    mindMapGraphRef.current?.updateGroup(newGroup, initialMemberIds);

                    if (groupEditorRef.current) {
                        const coords = mindMapGraphRef.current?.getNodeScreenCoords(activeNode);
                        setGroupActiveNode(activeNode);
                        setIsGroupEditorOpen(true);
                        groupEditorRef.current.showModal(newGroup, initialMemberIds, coords, true);
                    }
                };

                // 「編集」のための所属グループ一覧を取得
                let nodeGroups: any[] = [];
                if (activeNode) {
                    let activeNodeGroupIds: number[] = [];
                    if (activeNode.groupIds && Array.isArray(activeNode.groupIds)) {
                        activeNodeGroupIds = activeNode.groupIds;
                    } else if (activeNode.groupId !== undefined) {
                        activeNodeGroupIds = [activeNode.groupId];
                    }
                    nodeGroups = groups.filter((g: any) => activeNodeGroupIds.includes(g.id));
                }

                const submenuItems: any[] = [
                    {
                        key: 'group_add',
                        label: '新規追加',
                        onClick: handleAddGroup,
                        disabled: !activeNode
                    }
                ];

                // 「既存グループへの追加」メニューを追加
                if (groups.length > 0) {
                    submenuItems.push({
                        key: 'group_add_existing_submenu',
                        label: '既存グループへの追加',
                        disabled: !activeNode,
                        children: groups.map((g: any) => ({
                            key: `group_add_existing_${g.id}`,
                            label: g.name || `グループ ${g.id}`,
                            onClick: () => {
                                const nodesToAdd = selectedNodes.length > 0 ? selectedNodes : (activeNode ? [activeNode] : []);
                                if (nodesToAdd.length === 0) return;
                                
                                // 既存メンバーを特定
                                const currentGroupMembers = allNodes.filter((n: any) => {
                                    if (n.groupIds && Array.isArray(n.groupIds)) {
                                        return n.groupIds.includes(g.id);
                                    }
                                    return n.groupId === g.id;
                                });
                                const currentMemberIds = currentGroupMembers.map((n: any) => n.id);
                                const idsToAdd = nodesToAdd.map((n: any) => n.id);
                                const updatedMemberIds = Array.from(new Set([...currentMemberIds, ...idsToAdd]));
                                
                                mindMapGraphRef.current?.updateGroup(g, updatedMemberIds);
                                message.success(`既存グループ「${g.name || `グループ ${g.id}`}」に選択したノードを追加しました。`);
                            }
                        }))
                    });
                } else {
                    submenuItems.push({
                        key: 'group_add_existing_disabled',
                        label: '既存グループへの追加 (既存グループなし)',
                        disabled: true
                    });
                }

                if (nodeGroups.length > 0) {
                    submenuItems.push({
                        key: 'group_edit_submenu',
                        label: '編集',
                        children: nodeGroups.map((g: any) => ({
                            key: `group_edit_${g.id}`,
                            label: g.name || `グループ ${g.id}`,
                            onClick: () => {
                                const nodesInGroup = allNodes.filter((n: any) => {
                                    if (n.groupIds && Array.isArray(n.groupIds)) {
                                        return n.groupIds.includes(g.id);
                                    }
                                    return n.groupId === g.id;
                                });
                                const initialMemberIds = nodesInGroup.map((n: any) => n.id);

                                if (groupEditorRef.current && activeNode) {
                                    const coords = mindMapGraphRef.current?.getNodeScreenCoords(activeNode);
                                    setGroupActiveNode(activeNode);
                                    setIsGroupEditorOpen(true);
                                    groupEditorRef.current.showModal(g, initialMemberIds, coords);
                                }
                            }
                        }))
                    });
                } else {
                    submenuItems.push({
                        key: 'group_edit_disabled',
                        label: '編集 (所属グループなし)',
                        disabled: true
                    });
                }

                // 「離脱」のアクションと所属グループの共通集合（インターセクション）の計算
                const nodesToProcess = selectedNodes.length > 0 ? selectedNodes : (activeNode ? [activeNode] : []);
                
                const getNodeGroupIds = (n: any): number[] => {
                    if (n.groupIds && Array.isArray(n.groupIds)) {
                        return n.groupIds;
                    } else if (n.groupId !== undefined) {
                        return [n.groupId];
                    }
                    return [];
                };

                let sharedGroupIds: number[] = [];
                if (nodesToProcess.length > 0) {
                    sharedGroupIds = getNodeGroupIds(nodesToProcess[0]);
                    for (let i = 1; i < nodesToProcess.length; i++) {
                        const nGroupIds = getNodeGroupIds(nodesToProcess[i]);
                        sharedGroupIds = sharedGroupIds.filter(id => nGroupIds.includes(id));
                    }
                }
                const sharedGroups = groups.filter((g: any) => sharedGroupIds.includes(g.id));

                if (sharedGroups.length > 0) {
                    submenuItems.push({
                        key: 'group_leave_submenu',
                        label: '離脱',
                        children: sharedGroups.map((g: any) => ({
                            key: `group_leave_${g.id}`,
                            label: g.name || `グループ ${g.id}`,
                            onClick: () => {
                                const nodesToLeaveIds = nodesToProcess.map((n: any) => n.id);
                                const nodesInGroup = allNodes.filter((n: any) => {
                                    if (n.groupIds && Array.isArray(n.groupIds)) {
                                        return n.groupIds.includes(g.id);
                                    }
                                    return n.groupId === g.id;
                                });
                                const remainingMemberIds = nodesInGroup
                                    .map((n: any) => n.id)
                                    .filter((id: number) => !nodesToLeaveIds.includes(id));

                                mindMapGraphRef.current?.updateGroup(g, remainingMemberIds);
                                message.success(`グループ「${g.name || `グループ ${g.id}`}」から離脱しました。`);
                            }
                        }))
                    });
                } else {
                    submenuItems.push({
                        key: 'group_leave_disabled',
                        label: '離脱 (共通所属グループなし)',
                        disabled: true
                    });
                }

                return submenuItems;
            })()
        }
    ];

    const handleGroupRightClick = (groupId: number, x: number, y: number) => {
        if (!mindMapGraphRef.current) return;
        const groups = mindMapGraphRef.current.getGroups() || [];
        const targetGroup = groups.find((g: any) => g.id === groupId);
        if (!targetGroup) return;

        const allNodes = mindMapGraphRef.current.getGraphData().nodes || [];
        const nodesInGroup = allNodes.filter((n: any) => {
            if (n.groupIds && Array.isArray(n.groupIds)) {
                return n.groupIds.includes(groupId);
            }
            return n.groupId === groupId;
        });
        const initialMemberIds = nodesInGroup.map((n: any) => n.id);

        if (groupEditorRef.current) {
            setGroupActiveNode(nodesInGroup[0] || null);
            setIsGroupEditorOpen(true);
            groupEditorRef.current.showModal(targetGroup, initialMemberIds, { x, y });
        }
    };

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

    const handleRefreshNode = (node:any, options?: { skipHistory?: boolean, initialNode?: any }) => {
        sayHelloJS( 'Javascript World!' )
        if (window.eel && import.meta.env.VITE_APP_MODE !== 'web') {
            try {
                window.eel.say_hello_py( 'Javascript World!' );
            } catch (e) {}
        }
        
        // HTMLノードのデフォルトサイズ設定
        if (node.type && node.type !== '3dobject' && node.type !== 'image') {
            if (node.type === 'normal') {
                node.size_x = node.size_x || 200;
                node.size_y = node.size_y || 120;
            } else if (node.type === 'issue') {
                node.size_x = node.size_x || 300;
                node.size_y = node.size_y || 200;
            } else if (node.type === 'task') {
                node.size_x = node.size_x || 250;
                node.size_y = node.size_y || 150;
            } else {
                node.size_x = node.size_x || 250;
                node.size_y = node.size_y || 100;
            }
        }

        if(mindMapGraphRef.current){
            mindMapGraphRef.current.refreshNode(node, options);
        }
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


    const saveData = useCallback(async (isSaveAs: boolean) => {
        if(!mindMapGraphRef.current) return;
        
        let data = mindMapGraphRef.current.getGraphData();
        // Python側でin-place変更されるため、ディープコピーを作成
        data = JSON.parse(JSON.stringify(data));
        data.nodes = data.nodes.map((node: any) => {
            delete node.__threeObj;
            // 固定位置（fx, fy, fz）がないノードについては、座標情報を保存しない
            if (node.fx === undefined && node.fy === undefined) {
                delete node.x;
                delete node.y;
                delete node.z;
                delete node.vx;
                delete node.vy;
                delete node.vz;
                delete node.fx;
                delete node.fy;
                delete node.fz;
            }
            return node;
        });

        data.links = data.links.map((link: any) => {
            const cleanLink = { ...link };
            if (link.source !== undefined) {
                cleanLink.source = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
            }
            if (link.target !== undefined) {
                cleanLink.target = (link.target && typeof link.target === 'object') ? link.target.id : link.target;
            }
            delete cleanLink.__threeObj;
            return cleanLink;
        });

        // カメラ位置と視点方向を取得して保存
        const cameraState = mindMapGraphRef.current.getCameraState?.();
        if (cameraState) {
            data.camera = cameraState;
        }

        try {
            const result = isSaveAs 
                ? await storageService.saveAsData(data)
                : await storageService.saveData(data);
            
            console.log("Save result:", result);
            if (result && result[0]) {
                const filename = result[1];
                message.success({
                    content: `${filename}に保存しました`,
                    duration: 3,
                });
                if (filename) setCurrentFileName(filename);
            } else {
                message.error('保存に失敗しました');
            }
        } catch (error) {
            console.error('Error saving file:', error);
            message.error('保存に失敗しました');
        }
    }, []);

    const handleSave = useCallback(() => {
        return saveData(false);
    }, [saveData]);

    const handleSaveAs = useCallback(() => {
        return saveData(true);
    }, [saveData]);

    const handleSearch = useCallback((text: string) => {
        if (!mindMapGraphRef.current || !text) return [];
        return mindMapGraphRef.current.searchNodes(text);
    }, []);

    const handleNodeSelect = useCallback((node: any) => {
        if (!mindMapGraphRef.current) return;
        mindMapGraphRef.current.selectNode(node);
    }, []);

    const lastKeyActionTime = useRef<{undo: number, redo: number}>({undo: 0, redo: 0});
    const KEY_DEBOUNCE_MS = 300;

    const keyFunction = useCallback((event:any) => {
        if (isNodeEditorOpen || isLinkEditorOpen) return;
        if(event.ctrlKey) {
            if(event.code === "KeyS"){
                event.preventDefault();
                handleSave();
            }
            else if(event.code === "KeyZ" && !event.repeat){
                event.preventDefault();
                const now = Date.now();
                if (now - lastKeyActionTime.current.undo < KEY_DEBOUNCE_MS) {
                    console.log("Undo debounced, ignoring duplicate event");
                    return;
                }
                lastKeyActionTime.current.undo = now;
                if(mindMapGraphRef.current) {
                    const result = mindMapGraphRef.current.undo();
                    console.log("Undo operation via Ctrl+Z, result:", result);
                    if(!result) {
                        message.info('元に戻せる操作がありません');
                    }
                }
            }
            else if(event.code === "KeyY" && !event.repeat){
                event.preventDefault();
                const now = Date.now();
                if (now - lastKeyActionTime.current.redo < KEY_DEBOUNCE_MS) {
                    console.log("Redo debounced, ignoring duplicate event");
                    return;
                }
                lastKeyActionTime.current.redo = now;
                if(mindMapGraphRef.current) {
                    const result = mindMapGraphRef.current.redo();
                    console.log("Redo operation via Ctrl+Y, result:", result);
                    if(!result) {
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
                        const keys = [
                            'name', 'group', 'style_id', 'deadline', 'priority', 'urgency', 
                            'disabled', 'icon_img', 'size_x', 'size_y', 'img', 'type', 
                            'url', 'file_path', 'folder_path', 'node_bg_color', 
                            'node_pattern_color', 'node_custom_bg_color'
                        ];
                        //必要なキーだけを残し他は削除する
                        Object.keys(copied).forEach(key => {
                            if(!keys.includes(key)){
                                delete copied[key];
                            }
                        });

                        mindMapGraphRef.current.addNode(copied, selectedNode);
                        
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
        else if((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
            if (event.key === "Tab") {
                event.preventDefault();
            }
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

                // 選択されたリンクを削除
                const selectedLink = (mindMapGraphRef.current as any).getSelectedLink();
                if (selectedLink) {
                    mindMapGraphRef.current.deleteLink(selectedLink);
                }
            }
        }
        else if (event.key === "F2" && !event.repeat) {
            event.preventDefault();
            if (mindMapGraphRef.current) {
                const selectedNode = mindMapGraphRef.current.getSelectedNode();
                if (selectedNode) {
                    handleNodeEdit(selectedNode);
                }

                // 選択されたリンクを編集
                const selectedLink = (mindMapGraphRef.current as any).getSelectedLink();
                if (selectedLink) {
                    handleLinkEdit(selectedLink);
                }
            }
        }
      }, [handleSave, isNodeEditorOpen, isLinkEditorOpen]);
    
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
      }, [keyFunction, isNodeEditorOpen, isLinkEditorOpen]);



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
        <Spin spinning={loading} tip="ファイルを読み込み中..." wrapperClassName="full-height-spin" style={{ height: '100%', width: '100%' }}>
            <Button 
                icon={<MenuOutlined rev={undefined} />}
                onClick={() => setDrawerVisible(!drawerVisible)}
                style={{
                    position: 'fixed',
                    left: 10,
                    top: 10,
                    zIndex: 1001
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
                        padding: "0px 0px 0px 40px",
                        backgroundColor: "#141414"
                    },
                    mask: {
                        backgroundColor: "transparent"
                    },
                    wrapper: {
                        backgroundColor: "#141414"
                    }
                }}
            >
                <ConfigProvider theme={{
                    components: {
                        Menu: {
                        }
                    }
                }}>
                    <Menu 
                        mode="horizontal"
                        items={getMenuItems(recentFiles)}
                        theme="dark"
                        selectedKeys={[current]}
                        onOpenChange={async (keys) => {
                            if (keys.includes('file')) {
                                const files = await storageService.getRecentFiles();
                                setRecentFiles(files);
                            }
                        }}
                        onClick={({ key }) => {
                            setCurrent(''); // 選択状態をリセット
                            setDrawerVisible(false);
                            if (key === 'open_file') {
                                handleFileSelect();
                            } else if (key === 'import_file') {
                                handleImportFile();
                            } else if (key.startsWith('recent_file_')) {
                                const filePath = key.replace('recent_file_', '');
                                handleOpenRecent(filePath);
                            } else if (key === 'new_window') {
                                window.open(window.location.href, '_blank');
                            } else if (key === 'save') {
                                handleSave();
                            } else if (key === 'save_as') {
                                handleSaveAs();
                            } else if (key === 'undo') {
                                if (mindMapGraphRef.current) {
                                    if (!mindMapGraphRef.current.undo()) {
                                        message.info('元に戻せる操作がありません');
                                    }
                                }
                            } else if (key === 'redo') {
                                if (mindMapGraphRef.current) {
                                    if (!mindMapGraphRef.current.redo()) {
                                        message.info('やり直せる操作がありません');
                                    }
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
                                    const keys = [
                                        'name', 'group', 'style_id', 'deadline', 'priority', 'urgency', 
                                        'disabled', 'icon_img', 'size_x', 'size_y', 'img', 'type', 
                                        'url', 'file_path', 'folder_path', 'node_bg_color', 
                                        'node_pattern_color', 'node_custom_bg_color'
                                    ];
                                    Object.keys(copied).forEach(key => {
                                        if (!keys.includes(key)) {
                                            delete copied[key];
                                        }
                                    });

                                    mindMapGraphRef.current.addNode(copied, selectedNode);
                                }
                            }
                        } else if (key === 'find') {
                            setIsSearchModalOpen(true);
                        } else if (key === 'right_tree_layout') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.arrangeNodes('right-tree');
                            }
                        } else if (key === 'left_tree_layout') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.arrangeNodes('left-tree');
                            }
                        } else if (key === 'up_tree_layout') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.arrangeNodes('lower-tree');
                            }
                        } else if (key === 'low_tree_layout') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.arrangeNodes('upper-tree');
                            }
                        } else if (key === 'circle_layout') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.arrangeNodes('circle');
                            }
                        } else if (key === 'free_layout') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.arrangeNodes('free');
                            }
                        } else if (key === 'setting_force_toggle') {
                            if (mindMapGraphRef.current) {
                                const nextForce = !isForceMode;
                                mindMapGraphRef.current.setForceMode(nextForce);
                                setIsForceMode(nextForce);
                                message.success(`Forceモードを${nextForce ? 'ON' : 'OFF'}にしました`);
                            }
                        } else if (key === 'setting_particles_toggle') {
                            const nextParticles = !isParticlesEnabled;
                            setIsParticlesEnabled(nextParticles);
                            message.success(`パーティクル表示を${nextParticles ? 'ON' : 'OFF'}にしました`);
                        } else if (key === 'bg_space') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.setGlobalBackground('space');
                            }
                        } else if (key === 'bg_sky') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.setGlobalBackground('sky');
                            }
                        } else if (key === 'bg_snow') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.setGlobalBackground('snow');
                            }
                        } else if (key === 'bg_sunset') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.setGlobalBackground('sunset');
                            }
                        } else if (key === 'bg_none') {
                            if (mindMapGraphRef.current) {
                                mindMapGraphRef.current.setGlobalBackground('none');
                            }
                        }
                    }}
                    />
                </ConfigProvider>
            </Drawer>

        <MindMapGraph 
            ref={mindMapGraphRef}
            enableParticles={isParticlesEnabled}
            onHover={handleHover}
            onNodeEdit={handleNodeEdit}
            onRefreshNode={handleRefreshNode}
            onNodeRightClick={handleNodeRightClick}
            onLinkEdit={handleLinkEdit}
            onOpenFile={handleOpenFile}
            onOpenFolder={handleOpenFolder}
            onGroupRightClick={handleGroupRightClick} />
            
        <div style={{ position: 'relative' }}>
            <Dropdown 
                transitionName=""
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
            open={isNodeEditorOpen}
            getNodeScreenCoords={(node) => mindMapGraphRef.current?.getNodeScreenCoords(node) || null}
            groups={mindMapGraphRef.current?.getGroups() || []} />

        <LinkEditor
            ref={linkAddModalRef}
            onRefreshLink={handleRefreshLink}
            onDeleteLink={handleDeleteLink}
            onSelectNode={handleNodeSelect}
            onClose={() => setIsLinkEditorOpen(false)}
            open={isLinkEditorOpen}
            links={mindMapGraphRef.current?.getGraphData().links || []} />

        <GroupEditor
            ref={groupEditorRef}
            onSaveGroup={(group, nodeIds) => {
                mindMapGraphRef.current?.updateGroup(group, nodeIds);
            }}
            onPreviewGroup={(group, nodeIds) => {
                mindMapGraphRef.current?.updateGroup(group, nodeIds);
            }}
            onDeleteGroup={(groupId) => {
                mindMapGraphRef.current?.deleteGroup(groupId);
            }}
            onClose={() => setIsGroupEditorOpen(false)}
            open={isGroupEditorOpen}
            allNodes={mindMapGraphRef.current?.getGraphData().nodes || []}
            getNodeScreenCoords={(node) => mindMapGraphRef.current?.getNodeScreenCoords(node) || null}
            activeNode={groupActiveNode} />


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
                                mindMapGraphRef.current.focusOnNode(item);
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
