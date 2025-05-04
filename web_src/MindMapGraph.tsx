import React from 'react'
import ReactDOM from 'react-dom/client'
import _, { cloneDeep, has } from 'lodash';
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as d3force from 'd3-force'
import * as forceCollide from 'd3-force'
import * as THREE from 'three'

import {CSS2DObject, CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';

import { useState, forwardRef, useImperativeHandle, useMemo, useCallback} from 'react'


import { Canvas, useFrame, useLoader} from '@react-three/fiber'
import { Html, Loader, useGLTF, Sky, Cloud,Stars } from '@react-three/drei'
import { TextureLoader, SpriteMaterial, Sprite } from 'three'
import { OrbitControls } from '@react-three/drei'
import { render, useThree, useGraph } from '@react-three/fiber'
import ThreeForceGraph from 'three-forcegraph'

import { Popconfirm } from 'antd'

import { executeTreeLayout, calculateCameraPosition } from './layouts/TreeLayout';
import { executeCircleLayout } from './layouts/CircleLayout';

import './index.css'
import { useHistory } from './hooks/useHistory';


const { useRef, useEffect } = React;

// バッチ更新用のカスタムフック
const useBatchUpdate = () => {
    const [isPending, startTransition] = React.useTransition();
    const batchedUpdates = React.useRef<Function[]>([]);
    
    const scheduleBatchedUpdate = React.useCallback((update: Function) => {
        batchedUpdates.current.push(update);
        
        if (batchedUpdates.current.length === 1) {
            startTransition(() => {
                const updates = [...batchedUpdates.current];
                batchedUpdates.current = [];
                updates.forEach(u => u());
            });
        }
    }, []);
    
    return { scheduleBatchedUpdate, isPending };
};

import { SpaceScene } from './components/SpaceScene';

const MindMapGraph = forwardRef((props: any, ref:any) => {
    const fgRef = useRef<any>();
    const { addToHistory, undo, redo, canUndo, canRedo } = useHistory();

    // 選択されたノードを追跡するstate
    const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
    // 複数選択されたノードを追跡するstate
    const [selectedNodeList, setSelectedNodeList] = useState<NodeData[]>([]);
    // 機能モードを管理するstate
    const [funcMode, setFuncMode] = useState<boolean>(false);
    const copiedNodeRef = useRef<any>(null);
    // ダブルクリック検出用の変数
    const lastClickTime = useRef<number>(0);
    const lastClickedNode = useRef<any>(null);

    const { scheduleBatchedUpdate, isPending } = useBatchUpdate();

    interface NodeData {
        id: number;
        img: string;
        name?: string;
        group?: number;
        x?: number;
        y?: number;
        z?: number;
        fx?: number;
        fy?: number;
        fz?: number;
        isNew?: boolean;
        deadline?: string;
        createdAt?: string;
        updatedAt?: string;
        disabled?: boolean;
        type?: string;      // "folder" | "file" | "link" などのタイプを指定
        folder_path?: string;  // フォルダパスを保存
        style_id?: number;  // 1: Horse.glb, 2: 次のモデル... などのスタイルを指定
        scale?: number;     // 3Dオブジェクトのスケール (0.3 to 2.0)
        size_x?: number;    // ノードの幅
        size_y?: number;    // ノードの高さ
    }

    interface GraphData {
        nodes: NodeData[];
        links: any[];
    }

    const [graphData, setGraphData] = useState<GraphData>({nodes:[], links:[]});
    const [backgroundColor, setBackgroundColor] = useState<string>("rgba(0,0,0,0)");
    const setRotateVecFunc = () => {
        return new THREE.Vector3(0,0,3000);
    };   

    const isDraggingNode = useRef<boolean>(false);
    const dragCounter = useRef<number>(0);
    const isHovering = useRef<boolean>(false);
    const label_key = "name";
    const z_layer = -300
    const [rotateVec, setRotateVec] = useState<THREE.Vector3>(setRotateVecFunc);
    const [lookAtTarget, setLookAtTarget] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, z_layer));
    useImperativeHandle(ref, () => ({
        getGraphData: () => {
            //const jsonData = JSON.stringify(graphData, null, 2);
            return graphData;
        },
        setFuncMode: (mode: boolean) => {
            console.log('setFuncMode', mode);
            setFuncMode(mode);
        },
        setGraphData: (graphData:any) => {
            // nodesとlinksが空の場合、を作成
            if (graphData.nodes.length === 0 && graphData.links.length === 0) {
                let camera = fgRef.current.camera();
                const distance = 700;
                // 画面中央に新規ノードを配置
                const coords = { x: 0, y: 0, z: -300 };
                
                const now = new Date().toISOString();
                let new_node = { 
                    id: 1, 
                    img: "logo.png", 
                    group: 1, 
                    style_id: 1, 
                    fx: coords.x, 
                    fy: coords.y, 
                    fz: coords.z, 
                    size_x: 120,
                    size_y: 40,
                    name: "SpaceMind",
                    createdAt: now,
                    updatedAt: now
                };
                
                setGraphData({
                    nodes: [new_node],
                    links: []
                });
                
                // 編集モーダルを表示
                //props.onNodeEdit(new_node);
            } else {
                setGraphData(graphData);
            }
        },
        refreshNode: (node:any) => {
            console.log('refreshNode', node);
            
            // 更新前のノードの状態を取得（ディープコピーを作成）
            const originalNode = graphData.nodes.find(n => n.id === node.id);
            const originalNodeCopy = originalNode ? cloneDeep(originalNode) : null;
            const isNew = node && has(node, 'isNew');
            
            // nodeがコピーでないことを確認し、コピーを作成
            const nodeToUpdate = cloneDeep(node);
            
            //nodeにisNewがある場合、キーを削除する
            if (isNew) {
                delete node.isNew;

                const links = graphData.links.filter(l => l.source.id === node.id || l.target.id === node.id);
                
                links.forEach(link => {
                    refreshLink(link);
                });         
                addToHistory('add_node', {"node":node, "links":links});
            }
            // 更新日時を設定
            node.updatedAt = new Date().toISOString();
            
            // ノードが新規でない場合、履歴に追加
            if (!isNew && originalNodeCopy) {
                addToHistory('edit_node', {
                    before: originalNodeCopy,
                    after: node
                });
            }

            // graphData内のノードを新しいノードで置き換え
            if (originalNode) {
                const nodeIndex = graphData.nodes.findIndex(n => n.id === node.id);
                if (nodeIndex !== -1) {
                    graphData.nodes[nodeIndex] = node;
                }

                // リンクのsource/targetが更新された場合、リンクも更新
                graphData.links.forEach(link => {
                    if (link.source.id === node.id) {
                        link.source = node;
                        refreshLink(link);
                    }
                    if (link.target.id === node.id) {
                        link.target = node;
                        refreshLink(link);
                    }
                });
            }
            fgRef.current.refresh();
        },
        deleteNode: (node: any) => {
            console.log('deleteNode', node);
            // 削除前のノードとそれに関連するリンクを保存
            const nodeToDelete = cloneDeep(node);
            const relatedLinks = graphData.links.filter(l => 
                l.source.id === node.id || l.target.id === node.id
            );
            
            deleteNode(node.id);
            
            // 履歴に追加
            if (!nodeToDelete.isNew) {
                addToHistory('delete_node', {
                    node: nodeToDelete,
                    links: relatedLinks
                });
            }
            
            fgRef.current.refresh();
        },
        deleteLink: (link: any) => {
            console.log('deleteLink', link);

            deleteLink(link);
            
            // 履歴に追加
            addToHistory('delete_link', link);
            
            fgRef.current.refresh();
        },
        refreshLink: (link: any) => {
            // リンク更新前の状態を保存
            const originalLink = graphData.links.find(l => l.index === link.index);
            const originalLinkCopy = originalLink ? cloneDeep(originalLink) : null;
            const isNew = link && has(link, 'isNew');
            
            link.source = originalLink.source;
            link.target = originalLink.target;

            refreshLink(link);
            
            // 新規リンクでない場合、履歴に追加
            if (!isNew && originalLinkCopy) {
                addToHistory('edit_link', {
                    before: originalLinkCopy,
                    after: link
                });
            }

            // graphData内のリンクを新しいリンクで置き換え
            const linkIndex = graphData.links.findIndex(l => l.index === link.index);
            if (linkIndex !== -1) {
                graphData.links[linkIndex] = link;
            }
            fgRef.current.refresh();
        },
        // 検索用のメソッドを追加
        searchNodes: (searchText: string) => {
            if (!searchText) return [];
            return graphData.nodes.filter(node => 
                node.name && node.name.toLowerCase().includes(searchText.toLowerCase())
            );
        },
        // ノード選択用のメソッドを追加
        selectNode: (node: any) => {
            handleClick(node, null as any);
        },
        // 選択中のノードを取得する関数を追加
        getSelectedNode: () => {
            return selectedNode;
        },
        copyNode: () => {
            if (!selectedNode) return;
            copiedNodeRef.current = selectedNode;
        },
        getCopiedNode: () => {
            return cloneDeep(copiedNodeRef.current);
        },
        // 複数選択中のノードリストを取得する関数を追加
        getSelectedNodeList: () => {
            return selectedNodeList;
        },
        // 複数選択をクリアする関数を追加
        clearSelectedNodeList: () => {
            console.log('clearSelectedNodeList');
            setSelectedNodeList([]);
        },
        // 選択中のノードをクリアする関数を追加
        clearSelectedNode: () => {
            setSelectedNode(null);
        },
        setSelectedNodeList: (nodes: any[]) => {
            setSelectedNodeList(nodes);
        },
        addLink: (source: any, target: any) => {
            const existingLink = graphData.links.find((link: any) => link.source.id === source.id && link.target.id === target.id);
            if (!existingLink) {
                const newIndex = graphData.links.length > 0 ? Math.max(...graphData.links.map((l: any) => l.index)) + 1 : 1;
                const newLink = { index: newIndex, source: source, target: target, isNew: true };
                graphData.links.push(newLink);
                refreshLink(newLink)
                fgRef.current.refresh();

                addToHistory('add_link', newLink);
            }
        },
        // 新規ノード追加用のインターフェース
        addNode: (newNode:any) => {

            if (selectedNode){
                newNode.fx = selectedNode.fx;
                newNode.fy = selectedNode.fy;
                newNode.fz = selectedNode.fz;                           
            }
            
            const nodeId = Math.max(...graphData.nodes.map((item:any) => item.id)) + 1;
            newNode.id = nodeId;
            newNode.fx = newNode.fx + (10 + Math.floor(Math.random() * 21));
            newNode.fy = newNode.fy + (10 + Math.floor(Math.random() * 21));
            newNode.fz = newNode.fz + (10 + Math.floor(Math.random() * 21));
            newNode.isNew = true;
            
            // 新規ノードを追加
            props.onRefreshNode(newNode);
            graphData.nodes.push(newNode);
            fgRef.current.refresh();


        },
        // 新規ノード追加用のインターフェース
        addNewNode: () => {
            if (!selectedNode) return;
            
            const nodeId = Math.max(...graphData.nodes.map((item:any) => item.id)) + 1;
            const groupId = selectedNode.group || 1;
            const now = new Date().toISOString();
            const newNode = { 
                id: nodeId, 
                img: "new_node.png", 
                group: groupId, 
                style_id: 1, 
                fx: (selectedNode.fx || selectedNode.x || 0) + (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 51) + 50), 
                fy: (selectedNode.fy || selectedNode.y || 0) + (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 51) + 50), 
                fz: selectedNode.fz,
                size_x: 240,
                size_y: 80,
                name: "",
                isNew: true,
                createdAt: now,
                updatedAt: now
            };

            // 新規ノードを追加
            graphData.nodes.push(newNode);
            graphData.links.push({
                index: graphData.links.length > 0 ? Math.max(...graphData.links.map((link: any) => link.index)) + 1 : 1,
                source: selectedNode,
                target: newNode,
                isNew: true,
            });

            // 編集モーダルを表示
            props.onNodeEdit(newNode);
        },
        canUndo,
        undo: () => {
            undo(graphData, {
                deleteNode,
                deleteLink,
                setGraphData,
                refreshLink
            });
            fgRef.current.refresh();
        },
        arrangeNodes: (layout: string) => {
            // 連結成分を特定する関数
            const findConnectedComponents = () => {
                const visited = new Set<number>();
                const components: Array<NodeData[]> = [];
                
                // 深さ優先探索でノードとその連結成分を見つける
                const dfs = (nodeId: number, component: NodeData[]) => {
                    if (visited.has(nodeId)) return;
                    
                    visited.add(nodeId);
                    const node = graphData.nodes.find(n => n.id === nodeId);
                    if (node) {
                        component.push(node);
                        
                        // このノードに接続されたすべてのノードを探索
                        graphData.links.forEach(link => {
                            if (link.source.id === nodeId) {
                                dfs(link.target.id, component);
                            } else if (link.target.id === nodeId) {
                                dfs(link.source.id, component);
                            }
                        });
                    }
                };
                
                // すべてのノードが訪問されるまで連結成分を探索
                for (const node of graphData.nodes) {
                    if (!visited.has(node.id)) {
                        const component: NodeData[] = [];
                        dfs(node.id, component);
                        components.push(component);
                    }
                }
                
                return components;
            };
            
            // 連結成分ごとのリンクを取得
            const getLinksForComponent = (componentNodes: NodeData[]) => {
                const nodeIds = new Set(componentNodes.map(node => node.id));
                return graphData.links.filter(link => 
                    nodeIds.has(link.source.id) && nodeIds.has(link.target.id)
                );
            };

            // 連結成分を見つける
            const components = findConnectedComponents();
            console.log(`Found ${components.length} disconnected graph components`);
            
            // 各連結成分のノードにオリジナルの位置を保存
            graphData.nodes.forEach(node => {
                node._originalX = node.fx;
                node._originalY = node.fy;
                node._originalZ = node.fz;
            });

            if (layout === 'free') {
                // force graphによる配置
                // すべてのノードのfx, fy, fzを一時的に削除して自由に動くようにする
                graphData.nodes.forEach(node => {
                    // 現在の位置を記憶
                    node._tempX = node.x || 0;
                    node._tempY = node.y || 0;
                    node._tempZ = node.z || 0;
                    
                    // 固定位置を削除
                    delete node.fx;
                    delete node.fy;
                    delete node.fz;
                });
                
                // グラフを更新
                fgRef.current.refresh();
                
                // 1秒後に固定位置を復元
                setTimeout(() => {
                    graphData.nodes.forEach(node => {
                        // 現在の位置をfx, fy, fzに設定
                        node.fx = node.x;
                        node.fy = node.y;
                        node.fz = node.z;
                        
                        // 一時変数を削除
                        delete node._tempX;
                        delete node._tempY;
                        delete node._tempZ;
                        delete node._originalX;
                        delete node._originalY;
                        delete node._originalZ;
                    });
                    
                    fgRef.current.refresh();
                }, 1000);
                return;
            }

            // 各連結成分に対して独立してレイアウトを適用
            let xOffset = 0;
            const spacing = 800; // 連結成分間の間隔
            
            for (let i = 0; i < components.length; i++) {
                const component = components[i];
                const componentLinks = getLinksForComponent(component);
                
                // 一時的なグラフデータ構造を作成
                const tempGraphData = {
                    nodes: component,
                    links: componentLinks
                };
                
                // 選択されたレイアウトに基づいて配置
                if (layout.endsWith('-tree')) {
                    const direction = layout.split('-')[0] as 'right' | 'left' | 'upper' | 'lower';
                    executeTreeLayout(tempGraphData, direction, z_layer);
                } else if (layout === 'circle') {
                    const baseRadius = 200; // 中心円の基本半径
                    const radiusIncrement = 200; // レベルごとの半径の増分
                    executeCircleLayout(tempGraphData, baseRadius, radiusIncrement, z_layer);
                }
                
                // 各コンポーネントのグラフの範囲を計算
                let minX = Infinity, maxX = -Infinity;
                component.forEach(node => {
                    minX = Math.min(minX, node.fx || 0);
                    maxX = Math.max(maxX, node.fx || 0);
                });
                
                // コンポーネントの幅を計算
                const componentWidth = maxX - minX;
                
                // すべてのノードをX軸に沿ってシフト
                component.forEach(node => {
                    if (node.fx !== undefined) {
                        node.fx += xOffset - minX;
                    }
                });
                
                // 次のコンポーネントの開始位置を更新
                xOffset += componentWidth + spacing;
            }
            
            // グラフを更新
            fgRef.current.refresh();
            
            // カメラ位置の更新
            if (fgRef.current) {
                const { centerX, centerY, distance } = calculateCameraPosition(graphData);
                
                fgRef.current.cameraPosition(
                    { 
                        x: centerX, 
                        y: centerY, 
                        z: distance + z_layer 
                    },
                    { 
                        x: centerX, 
                        y: centerY, 
                        z: z_layer 
                    },
                    800 // transition duration
                );
                
                // カメラの向きを設定
                setCameraOrientation();
            }
        },
        redo: () => {
            redo(graphData, {
                deleteNode,
                deleteLink,
                setGraphData,
                refreshLink
            });
            fgRef.current.refresh();
        }
    }));

    // カメラの向きを設定する関数
    const setCameraOrientation = () => {
        if (fgRef.current) {
            let camera = fgRef.current.camera();
            camera.up.set(0, 1, 0); // Y軸を上向きに設定
        }
    };

    // node.idと一致するnodeをgraphDataから削除する関数
    const deleteNode = (nodeId: number) => {
        setGraphData(prevData => ({
        nodes: prevData.nodes.filter(node => node.id !== nodeId),
        links: prevData.links.filter(link => link.source.id !== nodeId && link.target.id !== nodeId)
        }));
    };
    // リンクを削除する関数
    const deleteLink = (link: any) => {
        setGraphData(prevData => ({
            ...prevData,
            links: prevData.links.filter(l => l.index !== link.index)
        }));
    };
    const refreshLink = (link: any) => {
        console.log('refreshLink', link);
        //linkにisNewがある場合、キーを削除する
        if (link && has(link, 'isNew')) {
            delete link.isNew;

            link.name = "";
        }
    };
    const handleClick = useCallback((node: NodeData | null, event: MouseEvent) => {
        console.log('Node clicked:', node);
        console.log('camera rotation:', fgRef.current.camera().rotation);
        
        if (!node) {
            setSelectedNode(null);
            return;
        }

        // Ctrlキーが押されている場合は複数選択モード
        if ( funcMode  && node) {
            console.log('funcMode Node clicked:', node);

            // ノードが通常選択されている場合、選択を解除
            if (selectedNode && node.id == selectedNode.id) {
                setSelectedNode(null);
            }
            
            // 既に選択されているノードをクリックした場合は選択解除
            if (selectedNodeList.some(n => n.id === node.id)) {
                console.log('Node unselected:', node);
                setSelectedNodeList(prev => prev.filter(n => n.id !== node.id));
            } else {
                // 新しいノードを選択リストに追加
                console.log('Node selected:', node);
                setSelectedNodeList(prev => [...prev, node]);
            }
            return;
        } 

        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime.current;
        
        // ダブルクリック検出（300ms以内に同じノードをクリック）
        if (timeSinceLastClick < 300 && lastClickedNode.current && node.id === lastClickedNode.current.id) {
            // ダブルクリック処理
            handleDoubleClick(node);
            lastClickTime.current = 0; // ダブルクリック後にリセット
            lastClickedNode.current = null;
            return;
        }
        
        // シングルクリックの時刻とノードを記録
        lastClickTime.current = now;
        lastClickedNode.current = node;


        // 選択されたノードを更新（これは常に行う）
        setSelectedNode(node);
    }, [fgRef,selectedNodeList, graphData,funcMode]);
    
    // ノードのダブルクリックを処理する関数
    const handleDoubleClick = (node: any) => {
        console.log('Node double clicked:', node);
        
        // issueタイプのノードの場合、背景色を更新
        if (node.type === "issue" && node.background) {
            setBackgroundColor(node.background);
        }
        
        // リンクタイプのノードの場合、URLを開く
        if (node.type === "link" && node.url) {
            console.log('Opening URL:', node.url);
            // URLの形式を確認し、必要に応じてhttps://を追加
            let url = node.url;
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }
            // 新しいタブでURLを開く
            window.open(url, '_blank');
        }
        // ファイルタイプのノードの場合、親コンポーネントにファイルを開く要求を委譲
        else if (node.type === "file" && node.file_path) {
            console.log('Opening file:', node.file_path);
            props.onOpenFile && props.onOpenFile(node);
        }
        // フォルダタイプのノードの場合、親コンポーネントにフォルダを開く要求を委譲
        else if (node.type === "folder" && node.folder_path) {
            console.log('Opening folder:', node.folder_path);
            props.onOpenFolder && props.onOpenFolder(node);
        }
        else {
            // 通常の選択モード
            if (node && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
                // クリックしたノードが複数選択ノード配列に含まれていた場合、複数選択をクリア
                if (selectedNodeList.some(n => n.id === node.id)) {
                    setSelectedNodeList([]);
                }
                const distance = 700;
                const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

                // 視点座標を保存
                setLookAtTarget(new THREE.Vector3(node.x, node.y, node.z));

                if (fgRef.current) {
                    fgRef.current.cameraPosition(
                        { x: node.x, y: node.y, z: node.z + distance }, // new position
                        { x: node.x, y: node.y, z: node.z }, // lookAt ({ x, y, z })
                        600  // ms transition duration
                    );
                }
                // カメラの向きを設定
                setCameraOrientation();

            }
        }
    };

    const handleRightClick = (node: NodeData | null, event: MouseEvent) => {
        if (!node || !event) return;
        
        setSelectedNodeList([]);
        setSelectedNode(node);

        console.log(event.clientX, event.clientY);
        
        // 画面上のクリック座標を親コンポーネントに通知
        props.onNodeRightClick && props.onNodeRightClick(node, event.clientX, event.clientY);
    };

    const handleLinkRightClick = (link: any) => {
        props.onLinkEdit(link)
    };
    const handleLinkClick = (link: any) => {
        console.log('handleLinkClick', link);
    };
const [kebabMenuPosition, setKebabMenuPosition] = useState<{ x: number, y: number } | null>(null);

const handleHover = (node: NodeData | null, prevNode: NodeData | null) => {
    isHovering.current = !!node;

    // setSelectedNode(node);
    
    // if (node) {
    //     // ノードの位置を画面座標に変換
    //     const { x, y } = fgRef.current.graph2ScreenCoords(node.x, node.y, node.z);
        
    //     // ノードのサイズを考慮してケバブメニューの位置を計算
    //     const nodeWidth = node.size_x || 120;
    //     const menuX = x + (nodeWidth / 2) - 20; // 右端から少し内側に
    //     const menuY = y - (node.size_y || 40) / 2; // 上端
        
    //     setKebabMenuPosition({ x: menuX, y: menuY });
    // } else {
    //     setKebabMenuPosition(null);
    // }
};

const handleKebabMenuClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (selectedNode) {
        // 現在のマウス位置でコンテキストメニューを表示
        props.onNodeRightClick && props.onNodeRightClick(selectedNode, event.clientX, event.clientY);
    }
};

    const handleNodeDrag = (dragNode:any) => {

        if (!isDraggingNode.current) {
            addToHistory('move_node', dragNode);
        }
        isDraggingNode.current = true;
    
        // ドラッグ中のノードが複数選択リストに含まれている場合、他の選択ノードも同じ移動量で移動させる
        if (selectedNodeList.some(node => node.id === dragNode.id)) {
            if (dragNode.px !== undefined) {
                dragNode.dx = dragNode.x - dragNode.px;
                dragNode.dy = dragNode.y - dragNode.py;
                dragNode.dz = dragNode.z - dragNode.pz;
                selectedNodeList.forEach(node => {
                    if (node.id !== dragNode.id) {
                        node.x = node.x + dragNode.dx;
                        node.y = node.y + dragNode.dy;
                        node.z = node.z + dragNode.dz;
                        node.fx = node.fx + dragNode.dx;
                        node.fy = node.fy + dragNode.dy;
                        node.fz = node.fz + dragNode.dz;
                    }
                });
            }
            dragNode.px = dragNode.x;
            dragNode.py = dragNode.y;
            dragNode.pz = dragNode.z;

            console.log('dragNode:', dragNode.dx, dragNode.dy, dragNode.dz);


        }

        // Ctrlキーが押されていない場合は以降の処理をスキップ
        if (!funcMode) {
            return;
        }

        //onNodeDragが実行される回数をカウントしておき、100回に1回しか実行しない
        dragCounter.current += 1;
        if (dragCounter.current < 100) return;

        dragCounter.current = 0;
        for (let node of graphData.nodes) {
          console.log("onNodeDrag loop")
          if (dragNode.id === node.id) {
            continue;
          }
          console.log("onNodeDrag",distance(dragNode, node))
          // 十分に近い：推奨リンクのターゲットとしてノードにスナップする
          if (!interimLink && distance(dragNode, node) < snapInDistance) {
            setInterimLink(-1, dragNode, node);
            break;
          }
          // 十分に他のノードに近い場合: 推奨リンクのターゲットとして他のノードにスナップ
          if (interimLink && node.id !== interimLink.target.id && distance(dragNode, node) < snapInDistance) {
            let removed_index = removeLink(interimLink);
            setInterimLink(removed_index, dragNode, node);
            break;
          }
        }

        // 十分に離れている場合：現在のターゲットノードからスナップアウト
        if (interimLink && distance(dragNode, interimLink.target) > snapOutDistance) {
            removeLink(interimLink);
            setInterimLinkState(null);
        }

    };

    const handleBackgroundClick = (event:any) => {
        let camera = fgRef.current.camera();
        let distance = 800;
        if (selectedNode) {
            distance = Math.abs((selectedNode.fz ?? 0) - camera.position.z);
            console.log('distance', distance);
        }
        let coords = fgRef.current.screen2GraphCoords(event.layerX, event.layerY, distance );

        let nodeId = Math.max(...graphData.nodes.map((item:any) => item.id)) + 1;
        let groupId = 1
        if(graphData.nodes.length > 0){
            groupId = Math.max(...graphData.nodes.map((item:any) => item.group)) + 1
        }
        //enableNavigationControls={true}にしたとき、なぜかhandleBackgroundClickが走り、-Infinityのnodeが追加されるため暫定処置
        if (nodeId === -Infinity) {
            return;
        }
        const now = new Date().toISOString();
        let new_node = { 
            id: nodeId, 
            img: "new_node.png", 
            group: groupId, 
            style_id: 1, 
            fx: coords.x, 
            fy: coords.y, 
            fz: coords.z, 
            size_x: 240,
            size_y: 80,
            name: "",
            isNew: true,
            createdAt: now,
            updatedAt: now
        };
        graphData.nodes.push(new_node);
        fgRef.current.refresh();
        setSelectedNodeList([]);
        props.onNodeEdit(new_node);
    };

    const nodeThreeObjectCustomMesh = (node: any) => {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(500, 200, 1),
            new THREE.MeshLambertMaterial({
                color: 'rgba(250,250,250,0.9)',
                transparent: true,
                opacity: 0.75
            })
        );

        const MultilineText = new SpriteText(node["name"], 16);
        MultilineText.color = 'rgba(8,250,9,0.9)';
        MultilineText.backgroundColor = 'rgba(250,250,250,0.9)';
        MultilineText.borderColor = "#0044ff";
        MultilineText.borderWidth = 0.2;
        MultilineText.padding = 3;
        MultilineText.borderRadius = 0;
        MultilineText.position.x = 0;
        MultilineText.position.y = 0;

        const nodeEl = document.createElement('div');
        nodeEl.textContent = node[label_key];
        nodeEl.className = 'node-label2';
        
        const node_el = new CSS2DObject(nodeEl);
        node_el.position.set(0, 0.5, 0);

        MultilineText.add(node_el);

        return MultilineText;
    };

    const nodeThreeObjectSt = (node:any) => {
        const MultilineText = new SpriteText(node[label_key], 3);
        MultilineText.color = node.color;
        MultilineText.backgroundColor = 'rgba(250,250,250,0.9)';
        MultilineText.borderColor = "#0044ff";
        MultilineText.borderWidth = 0.2;
        MultilineText.padding = 3;
        MultilineText.borderRadius = 5;
        MultilineText.position.x = 0;
        MultilineText.position.y = 0;

        return MultilineText;
    };

    const horseModel = useMemo(() => useGLTF('./assets/Horse.glb'), []);
    const watchModel = useMemo(() => useGLTF('./assets/watch-v1.glb'), []);
    const [catModel, setCatModel] = useState<THREE.Group | null>(null);
    const [birdModel, setBirdModel] = useState<THREE.Group | null>(null);
    const [bird2Model, setBird2Model] = useState<THREE.Group | null>(null);
    const [airplaneModel, setAirplaneModel] = useState<THREE.Group | null>(null);

    useEffect(() => {
        // // Load Tree model
        // const tdsLoader = new TDSLoader();
        // tdsLoader.load('./assets/Plants1/Plants1.3ds', (object) => {
        //     setTrexModel(object);
        // });

        // Load Cat model
        const mtlLoader = new MTLLoader();
        mtlLoader.setPath('./assets/cat/');
        mtlLoader.load('12221_Cat_v1_l3.mtl', (materials) => {
            materials.preload();
            
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath('./assets/cat/');
            objLoader.load('12221_Cat_v1_l3.obj', (object) => {
                setCatModel(object);
            });
        });

        // Load Bird model
        const birdMtlLoader = new MTLLoader();
        birdMtlLoader.setPath('./assets/bird1/');
        birdMtlLoader.load('12213_Bird_v1_l3.mtl', (materials) => {
            materials.preload();
            
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath('./assets/bird1/');
            objLoader.load('12213_Bird_v1_l3.obj', (object) => {
                setBirdModel(object);
            });
        });

        // Load Bird2 model
        const bird2MtlLoader = new MTLLoader();
        bird2MtlLoader.setPath('./assets/bird2/');
        bird2MtlLoader.load('12249_Bird_v1_L2.mtl', (materials) => {
            materials.preload();
            
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath('./assets/bird2/');
            objLoader.load('12249_Bird_v1_L2.obj', (object) => {
                setBird2Model(object);
            });
        });

        // Load Airplane model
        const airplaneMtlLoader = new MTLLoader();
        airplaneMtlLoader.setPath('./assets/airplane/');
        airplaneMtlLoader.load('11803_Airplane_v1_l1.mtl', (materials) => {
            materials.preload();
            
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath('./assets/airplane/');
            objLoader.load('11803_Airplane_v1_l1.obj', (object) => {
                setAirplaneModel(object);
            });
        });
    }, []);

    const nodeThreeObjectImageTexture = useCallback((node: any): THREE.Object3D | SpriteText => {
        if (node.id < 0) {
            return nodeThreeObjectCustomMesh(node);
        }

        if (node.type === "3dobject") {
            if (node.style_id === 1) {  // Horse.glbモデル
                const scene = horseModel.scene.clone();
                const scale = node.scale || 1;  
                scene.scale.set(scale * 0.7, scale * 0.7, scale * 0.7);
                scene.rotation.y = Math.PI/2;
                return scene;
            } else if (node.style_id === 2 && watchModel) {  // watchモデル
                const scene = watchModel.scene.clone();
                const scale = node.scale || 1; 
                scene.scale.set(scale* 0.1, scale * 0.1, scale* 0.1);
                scene.rotation.y = Math.PI/12;
                return scene;
            } else if (node.style_id === 3 && catModel) {  // Cat.objモデル
                const scene = catModel.clone();
                const scale = node.scale || 1; 
                scene.scale.set(scale * 2, scale * 2, scale * 2);
                scene.rotation.x = -Math.PI/2;
                scene.rotation.z = -Math.PI/6;
                return scene;
            } else if (node.style_id === 4 && birdModel) {  // Bird.objモデル
                const scene = birdModel.clone();
                const scale = node.scale || 1  
                scene.scale.set(scale * 5, scale * 5, scale * 5);
                scene.rotation.x = -Math.PI/2;
                scene.rotation.z = Math.PI/6;
                return scene;
            } else if (node.style_id === 5 && bird2Model) {  // Bird2.objモデル
                const scene = bird2Model.clone();
                const scale = node.scale || 1;  
                scene.scale.set(scale, scale, scale);
                scene.rotation.x = -Math.PI/2;
                scene.rotation.z = Math.PI/6;
                return scene;
            } else if (node.style_id === 6 && airplaneModel) {  // Airplane.objモデル
                const scene = airplaneModel.clone();
                const scale = node.scale || 1;  // デフォルトスケール0.05
                scene.scale.set(scale * 0.05, scale * 0.05, scale * 0.05);
                scene.rotation.x = -Math.PI/3;
                scene.rotation.z = Math.PI/6;
                return scene;
            }
        }
        const imgTexture = new THREE.TextureLoader().load(`./assets/${node['img']}`);
        imgTexture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({ map: imgTexture });
        const sprite = new THREE.Sprite(material);
        const aspectRatio = node.size_x / node.size_y;
        sprite.scale.set(node.size_x, node.size_x / aspectRatio, 1);
        return sprite;
    }, [horseModel,watchModel,catModel,birdModel,bird2Model,airplaneModel]);

    const [interimLink, setInterimLinkState] = useState<any>(null);

    const distance = (node1: any, node2: any) => {
        const { x: x1, y: y1 } = fgRef.current.graph2ScreenCoords(node1.x, node1.y, node1.z);
        const { x: x2, y: y2 } = fgRef.current.graph2ScreenCoords(node2.x, node2.y, node2.z);
        return Math.sqrt(
            Math.pow(x1 - x2, 2) +
            Math.pow(y1 - y2, 2)
        );
    };

    const snapInDistance = 120; // Define snapInDistance with an appropriate value
    const snapOutDistance = 250; // Define snapOutDistance with an appropriate value

    const setInterimLink = (linkId: number, source: any, target: any) => {
        // 既存のリンクと同じsourceとtargetの組み合わせがあるかチェック
        const existingLink = graphData.links.find(link => 
            (link.source.id === source.id && link.target.id === target.id) ||
            (link.source.id === target.id && link.target.id === source.id)
        );

        // 既存のリンクがある場合は追加しない
        if (existingLink) {
            return;
        }

        if (linkId < 0){
            linkId = graphData.links.length > 0 ? Math.max(...graphData.links.map((link: any) => link.index)) + 1 : 1;
        }
        const newLink = { index: linkId, source: source, target: target, isNew: true };
        graphData.links.push(newLink);
        refreshLink(newLink)
        setInterimLinkState(newLink);
    };


    const removeLink = (link: any): number => {
        const removedIndex = link.index;
        setGraphData(prevData => ({
            ...prevData,
            links: prevData.links.filter(l => l.index !== removedIndex)
        }));
        return removedIndex;
    };


    // const distancea = 5600;
    // useEffect(() => {
    //     fgRef.current.cameraPosition({ z: distance });

    //     // camera orbit
    //     let angle = 0;
    //     setInterval(() => {
    //       fgRef.current.cameraPosition({
    //         x: distancea * Math.sin(angle),
    //         z: distancea * Math.cos(angle)
    //       });
    //       angle += Math.PI / 300;
    //     }, 100);
    //   }, []);

    useEffect(() => {
        if (fgRef.current) {
            // ノード間の反発力を設定
            //fgRef.current.d3Force('charge').strength(-50);
        
            // リンクの距離を設定
            fgRef.current.d3Force('link').distance(2).strength(1);
            
            //const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.2, 0.9);
            //fgRef.current.postProcessingComposer().addPass(bloomPass);
            
            fgRef.current.d3Force('collision', d3force.forceCollide(150));
            //fgRef.current.d3Force('center', d3force.forceCenter(0, 0));


            //fgRef.current.d3Force("link", d3force.forceLink(graphData.links).distance(function(){ return 10;}).strength(function(){ return 2; }))
            //fgRef.current.d3Force("center", d3force.forceY(height/2))
            fgRef.current.d3Force('charge', d3force.forceManyBody().strength(-10))
        }
    }, [fgRef]);

    return (
        <div style={{position: "relative", width: "100%", height: "100%" }}>
            {/* ケバブメニュー */}
            {kebabMenuPosition && isHovering && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${kebabMenuPosition.x}px`,
                        top: `${kebabMenuPosition.y}px`,
                        background: 'rgba(255, 255, 255, 0.9)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        zIndex: 1000
                    }}
                    onClick={handleKebabMenuClick}
                >
                    ⋮
                </div>
            )}
            {/* Force Graphのレイヤー */}
            <div style={{
                position: "absolute", 
                top: 0, 
                left: 0, 
                width: "100%", 
                height: "100%", 
                zIndex: 1 
            }}>
                <ForceGraph3D
                ref={fgRef}
                graphData={{'nodes' : graphData.nodes, 'links' : graphData.links}}
                nodeThreeObject={(node) => {
                    const sprite = nodeThreeObjectImageTexture(node);
                    if (sprite instanceof THREE.Sprite) {
                        const material = sprite.material as THREE.SpriteMaterial;
                        if (selectedNode && node.id === selectedNode.id) {
                            material.color = new THREE.Color(0xffffff);
                            material.opacity = (node.disabled) ? 0.1 : 1;
                        } else if (selectedNodeList.some(n => n.id === node.id)) {
                            console.log('selectedNodeList:', selectedNodeList);
                            material.color = new THREE.Color(0x4169e1);
                            material.opacity = (node.disabled) ? 0.1 : 1;
                        } else {
                            material.color = new THREE.Color(0xe0e0e0);
                            material.opacity = (node.disabled) ? 0.1: (node.isNew) ? 0.3 : 1;
                        }
                    }
                    return sprite;
                }}
                enableNavigationControls={true}
                showNavInfo={false}
                backgroundColor={backgroundColor}
                linkColor={(link) => {
                    let opacity = 1;
                    if (link.source.disabled || link.target.disabled) {
                        opacity = 0.1;
                    } 
                    let color = `rgba(255,255,255,${opacity})`;
                    if (link === interimLink) {
                        color = `rgb(246, 147, 177,${opacity})`;
                    }
                    return color
                }}
                linkWidth={(link) => link === interimLink ? 4 : 2}
                nodeId="id"
                //linkDirectionalArrowLength={6}
                //linkDirectionalArrowRelPos={1}
                nodeLabel={label_key}
                //nodeAutoColorBy="group"
                
                linkThreeObjectExtend={true}
                linkThreeObject={link => {
                    // extend link with text sprite
                    let link_name = link.name;
                    if (link_name === "") {
                        link_name = `${link.source.name || ''} to ${link.target.name || ''}`;
                    }
                    const sprite = new SpriteText(`${link_name}`);
                    sprite.color = 'lightgrey';
                    sprite.textHeight = 10.5;

                    if (link.source.disabled || link.target.disabled) {
                        sprite.material.opacity = 0.1;
                        sprite.material.transparent = true;
                    } 
                    return sprite;
                }}
                linkPositionUpdate={(sprite, { start, end }) => {
                    const middlePos = { x: 0, y: 0, z: 0 };
                    (['x', 'y', 'z'] as Array<'x' | 'y' | 'z'>).forEach((c: 'x' | 'y' | 'z') => {
                      middlePos[c] = start[c] + (end[c] - start[c]) / 2; // calc middle point
                    });
                    // Position sprite
                    Object.assign(sprite.position, middlePos);
                }}
                linkDirectionalParticleWidth={1}
                //linkLineDash={(link:any) => link === interimLink ? [2, 2] : []}
                d3VelocityDecay={0.4}
                onNodeClick={handleClick}

                onNodeRightClick={handleRightClick}
                onLinkRightClick={handleLinkRightClick}
                onLinkClick={handleLinkClick}
                onNodeDrag={handleNodeDrag}
                onNodeHover={handleHover}
                d3AlphaDecay={0.2}
                //dagMode={"radialin"}
                //nodeThreeObjectExtend={true}
                onBackgroundClick={handleBackgroundClick}
                onNodeDragEnd={(node:any) => {

                    // // ノードにfx,fy,fzのキーがあれば、そのキーを消す
                    // if (node.fx || node.fy || node.fz) {
                    //     delete node.fx;
                    //     delete node.fy;
                    //     delete node.fz;
                    // ドラッグ中のノードの位置を更新
                    node.fx = node.x;
                    node.fy = node.y;
                    node.fz = node.z;

                    // px, py, pzを削除 
                    delete node.px;
                    delete node.py;
                    delete node.pz;

                    // dx, dy, dzを削除
                    delete node.dx;
                    delete node.dy;
                    delete node.dz;


                    // ドラッグしたノードが複数選択の一部でない場合のみ、通常の選択処理を行う
                    if (!selectedNodeList.some(n => n.id === node.id)) {
                        setSelectedNode(node);
                        if (selectedNodeList.length > 0) {
                            console.log('clearSelectedNodeList');
                            setSelectedNodeList([]);
                        }
                    }

                }}
                />
            </div>
            
            {/* R3Fのレイヤー */}
            <div style={{ 
                position: "absolute", 
                top: 0, 
                left: 0, 
                width: "100%", 
                height: "100%", 
                zIndex: 0,
                pointerEvents: "none" 
            }}>
                <Canvas
                    style={{ background: "black" }}
                    camera={{ position: [0, 0, 40], near: 0.1, far: 1000 }}
                >
                    <SpaceScene />
                    {/* <OrbitControls enableZoom={true} enablePan={false} enableDamping dampingFactor={0.2} autoRotate={true} rotateSpeed={-0.001} />
                    <Portals />
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} /> */}
                </Canvas>
            </div>
        </div>
    );
});

// const store: { name: string; color: string; position: [number, number, number]; url: string; link: number }[] = [
//     { name: 'outside', color: 'lightpink', position: [10, 0, -15], url: 'assets/20201102113639.png', link: 1 },
//     // ...
//   ]
  
//   function Dome({ name, position, texture, onClick }: { name: string; position: [number, number, number]; texture: THREE.Texture; onClick: () => void }) {
//     return (
//       <group>
//         <mesh>
//           <sphereGeometry args={[500, 60, 40]} />
//           <meshBasicMaterial map={texture} side={THREE.BackSide} />
//         </mesh>
//         {/* <mesh position={position}>
//           <sphereGeometry args={[1.25, 32, 32]} />
//           <meshBasicMaterial color="white" />
//           <Html center>
//             <Popconfirm title="Are you sure you want to leave?" onConfirm={onClick} okText="Yes" cancelText="No">
//               <a href="#">{name}</a>
//             </Popconfirm>
//           </Html>
//         </mesh> */}
//       </group>
//     )
//   }
  
//   function Portals() {
//     const [which, set] = useState(0)
//     const { link, ...props } = store[which]
//     const maps = useLoader(THREE.TextureLoader, store.map((entry) => entry.url)) // prettier-ignore
//     return <Dome onClick={() => set(link)} {...props} texture={maps[which]} />
//   }

export default MindMapGraph;
