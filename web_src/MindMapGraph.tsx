import React from 'react'
import ReactDOM from 'react-dom/client'
import _, { cloneDeep, has } from 'lodash';
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as d3force from 'd3-force'
import * as forceCollide from 'd3-force'
import * as THREE from 'three'

import {CSS2DObject, CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer'
import {CSS3DRenderer, CSS3DSprite} from 'three/examples/jsm/renderers/CSS3DRenderer'


import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';

import { useState, forwardRef, useImperativeHandle, useMemo, useCallback, useRef, useEffect} from 'react'


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
import { NODE_CONSTANTS } from './constants';
import { NodeData, GroupData, GraphData } from './types/graph';
import { useGroupVisuals } from './hooks/useGroupVisuals';
import { useForceGraphSettings } from './hooks/useForceGraphSettings';


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
import { SkyScene } from './components/SkyScene';
import { SnowScene } from './components/SnowScene';
import { SunsetScene } from './components/SunsetScene';
import HtmlNodeComponent from './components/HtmlNodeComponent';

const scratchColor1 = new THREE.Color();
const scratchColor2 = new THREE.Color();

const MindMapGraph = forwardRef((props: any, ref:any) => {
    const fgRef = useRef<any>();
    
    const css3DRenderer = useMemo(() => {
        const renderer = new CSS3DRenderer();
        renderer.domElement.className = 'css3d-renderer-container';
        renderer.domElement.style.pointerEvents = 'none';
        return renderer;
    }, []);
    const extraRenderers = useMemo(() => [css3DRenderer as any], [css3DRenderer]);

    const htmlNodeCache = useRef(new Map<number, { 
        div: HTMLDivElement, 
        root: any, 
        hitBox: THREE.Sprite,
        sprite: CSS3DSprite,
        group: THREE.Group,
        lastData?: string
    }>());
    const { addToHistory, undo, redo, canUndo, canRedo } = useHistory();

    // 選択されたノードを追跡するstate
    const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
    // 選択されたリンクを追跡するstate
    const [selectedLink, setSelectedLink] = useState<any>(null);
    // 複数選択されたノードを追跡するstate
    const [selectedNodeList, setSelectedNodeList] = useState<NodeData[]>([]);
    // 機能モードを管理するstate
    const [funcMode, setFuncMode] = useState<boolean>(false);
    // レイアウトモードを管理するstate ('static' | 'force')
    const [layoutMode, setLayoutMode] = useState<string>('static');
    // 矩形選択用のRef (パフォーマンス最適化のためReactステートではなく生DOMとRefで処理)
    const selectionBoxRef = useRef<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
    const copiedNodeRef = useRef<any>(null);
    const mountTime = useRef<number>(Date.now());
    // ダブルクリック検出用の変数
    const lastClickTime = useRef<number>(0);
    const clickTimeout = useRef<any>(null);
    const lastClickedNode = useRef<any>(null);

    const { scheduleBatchedUpdate, isPending } = useBatchUpdate();



    const isShiftDown = useRef<boolean>(false);
    const isCtrlDown = useRef<boolean>(false);

    const enableParticlesRef = useRef<boolean>(true);
    const selectedNodeRef = useRef<NodeData | null>(null);

    useEffect(() => {
        enableParticlesRef.current = !!props.enableParticles;
    }, [props.enableParticles]);

    useEffect(() => {
        selectedNodeRef.current = selectedNode;
    }, [selectedNode]);

    // パーティクルのON/OFF設定変更時にForceGraphの再描画を促す
    useEffect(() => {
        if (fgRef.current) {
            fgRef.current.refresh();
        }
    }, [props.enableParticles]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') isShiftDown.current = true;
            if (e.key === 'Control') isCtrlDown.current = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') isShiftDown.current = false;
            if (e.key === 'Control') isCtrlDown.current = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        const handleBlur = () => {
            isShiftDown.current = false;
            isCtrlDown.current = false;
        };
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    const [graphData, setGraphData] = useState<GraphData>({nodes:[], links:[], groups: []});

    // 形状計算のパフォーマンス最適化のため、メッシュ用のジオメトリをメモ化して再利用
    const sphereGeom = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
    const cylinderGeom = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), []);

    // ギャラクシーと同じ高品質な雲（星雲）のテクスチャをロード
    const cloudTexture = useMemo(() => {
        const loader = new THREE.TextureLoader();
        const texture = loader.load('./assets/cloud.png');
        return texture;
    }, []);

    const groupVisualsRef = useGroupVisuals(fgRef, graphData, cloudTexture, htmlNodeCache);


    // 矩形選択用のマウスドラッグ追跡および生DOM描画処理（React再レンダリング回数ゼロによる高速化）
    useEffect(() => {
        const container = document.querySelector('.css3d-renderer-container')?.parentElement;
        if (!container) return;

        let selectionDiv: HTMLDivElement | null = null;

        const handlePointerMove = (e: PointerEvent) => {
            const currentBox = selectionBoxRef.current;
            if (!currentBox || !selectionDiv) return;

            const rect = container.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            currentBox.endX = currentX;
            currentBox.endY = currentY;

            const minX = Math.min(currentBox.startX, currentBox.endX);
            const maxX = Math.max(currentBox.startX, currentBox.endX);
            const minY = Math.min(currentBox.startY, currentBox.endY);
            const maxY = Math.max(currentBox.startY, currentBox.endY);

            selectionDiv.style.left = `${minX}px`;
            selectionDiv.style.top = `${minY}px`;
            selectionDiv.style.width = `${maxX - minX}px`;
            selectionDiv.style.height = `${maxY - minY}px`;
        };

        const handlePointerUp = (e: PointerEvent) => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);

            const currentBox = selectionBoxRef.current;
            const controls = fgRef.current?.controls();
            if (controls) {
                controls.enabled = true;
            }

            if (selectionDiv) {
                selectionDiv.style.display = 'none';
            }

            if (currentBox) {
                const rect = container.getBoundingClientRect();
                const minX = Math.min(currentBox.startX, currentBox.endX);
                const maxX = Math.max(currentBox.startX, currentBox.endX);
                const minY = Math.min(currentBox.startY, currentBox.endY);
                const maxY = Math.max(currentBox.startY, currentBox.endY);

                const dist = Math.sqrt(Math.pow(currentBox.endX - currentBox.startX, 2) + Math.pow(currentBox.endY - currentBox.startY, 2));
                
                if (dist > 5) {
                    const camera = fgRef.current?.camera();
                    const rectWidth = rect.width;
                    const rectHeight = rect.height;
                    const selectedNodes: NodeData[] = [];

                    if (camera && graphData.nodes) {
                        graphData.nodes.forEach((node: NodeData) => {
                            const x = node.x ?? 0;
                            const y = node.y ?? 0;
                            const z = node.z ?? 0;

                            const vector = new THREE.Vector3(x, y, z);
                            vector.project(camera);

                            const screenX = (vector.x * 0.5 + 0.5) * rectWidth;
                            const screenY = (-(vector.y * 0.5) + 0.5) * rectHeight;

                            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
                                selectedNodes.push(node);
                            }
                        });
                    }

                    if (selectedNodes.length > 0) {
                        setSelectedNodeList(selectedNodes);
                        setSelectedNode(selectedNodes[selectedNodes.length - 1]);
                    } else {
                        setSelectedNodeList([]);
                        setSelectedNode(null);
                    }
                }
            }

            selectionBoxRef.current = null;
        };

        const handlePointerDownCapture = (e: PointerEvent) => {
            // funcMode（Ctrlキー押下中）かつ左クリック（button === 0）の場合に矩形選択を開始
            if (funcMode && e.button === 0) {
                const rect = container.getBoundingClientRect();
                const startX = e.clientX - rect.left;
                const startY = e.clientY - rect.top;
                
                // OrbitControlsを一時無効化してカメラ回転を防ぐ
                const controls = fgRef.current?.controls();
                if (controls) {
                    controls.enabled = false;
                }

                selectionBoxRef.current = { startX, startY, endX: startX, endY: startY };

                // セレクションボックスの DOM 要素の取得または作成
                if (!selectionDiv) {
                    selectionDiv = document.getElementById('selection-box-overlay') as HTMLDivElement;
                    if (!selectionDiv) {
                       selectionDiv = document.createElement('div');
                       selectionDiv.id = 'selection-box-overlay';
                       selectionDiv.style.position = 'absolute';
                       selectionDiv.style.border = '1px solid #1890ff';
                       selectionDiv.style.backgroundColor = 'rgba(24, 144, 255, 0.15)';
                       selectionDiv.style.pointerEvents = 'none';
                       selectionDiv.style.zIndex = '9999';
                       selectionDiv.style.borderRadius = '2px';
                       container.appendChild(selectionDiv);
                    }
                }

                selectionDiv.style.display = 'block';
                selectionDiv.style.left = `${startX}px`;
                selectionDiv.style.top = `${startY}px`;
                selectionDiv.style.width = '0px';
                selectionDiv.style.height = '0px';

                document.addEventListener('pointermove', handlePointerMove);
                document.addEventListener('pointerup', handlePointerUp);

                // キャプチャフェーズでイベントを停止し、OrbitControlsへの伝播を完全に阻止
                e.stopPropagation();
            }
        };

        container.addEventListener('pointerdown', handlePointerDownCapture, true);

        return () => {
            container.removeEventListener('pointerdown', handlePointerDownCapture, true);
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            if (selectionDiv && selectionDiv.parentNode) {
                selectionDiv.parentNode.removeChild(selectionDiv);
            }
        };
    }, [funcMode, graphData]);

    const textureCache = useRef(new Map<string, {
        texture: THREE.Texture,
        material: THREE.SpriteMaterial
    }>());

    useEffect(() => {
        if (!graphData || !graphData.nodes) return;
        const activeNodeIds = new Set(graphData.nodes.map((n: any) => n.id));
        htmlNodeCache.current.forEach((cache, nodeId) => {
            if (!activeNodeIds.has(nodeId)) {
                try {
                    if (cache.root) {
                        cache.root.unmount();
                    }
                    if (cache.div) {
                        cache.div.remove();
                    }
                    if (cache.group) {
                        cache.group.clear();
                    }
                    if (cache.hitBox) {
                        if (cache.hitBox.material) cache.hitBox.material.dispose();
                        if (cache.hitBox.geometry) cache.hitBox.geometry.dispose();
                    }
                } catch (e) {
                    console.error("Failed to unmount cached HTML node:", e);
                }
                htmlNodeCache.current.delete(nodeId);
            }
        });
    }, [graphData]);

    useEffect(() => {
        return () => {
            // アンマウント時にすべてのキャッシュをクリーンアップ
            htmlNodeCache.current.forEach((cache) => {
                try {
                    if (cache.root) cache.root.unmount();
                    if (cache.div) cache.div.remove();
                    if (cache.group) cache.group.clear();
                    if (cache.hitBox) {
                        if (cache.hitBox.material) cache.hitBox.material.dispose();
                        if (cache.hitBox.geometry) cache.hitBox.geometry.dispose();
                    }
                } catch (e) {
                    // ignore
                }
            });
            htmlNodeCache.current.clear();

            // テクスチャキャッシュのクリア
            textureCache.current.forEach((cached) => {
                try {
                    if (cached.material) cached.material.dispose();
                    if (cached.texture) cached.texture.dispose();
                } catch (e) {
                    // ignore
                }
            });
            textureCache.current.clear();

            // 3Dモデルリソースのクリア
            [catModel, birdModel, bird2Model, airplaneModel].forEach(modelRef => {
                if (modelRef && modelRef.current) {
                    modelRef.current.traverse((child: any) => {
                        if (child.isMesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                const materials = Array.isArray(child.material) ? child.material : [child.material];
                                materials.forEach((m: any) => m.dispose());
                            }
                        }
                    });
                    modelRef.current = null;
                }
            });
        };
    }, []);

    const [windowDimensions, setWindowDimensions] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    useEffect(() => {
        const handleResize = () => {
            setWindowDimensions({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [backgroundColor, setBackgroundColor] = useState<string>("rgba(0,0,0,0)");
    const setRotateVecFunc = () => {
        return new THREE.Vector3(0,0,3000);
    };   

    const isDraggingNode = useRef<boolean>(false);
    const lastDragEndTime = useRef<number>(0);
    const dragCounter = useRef<number>(0);
    const isHovering = useRef<boolean>(false);
    const label_key = "name";
    const z_layer = -700
    const [rotateVec, setRotateVec] = useState<THREE.Vector3>(setRotateVecFunc);
    const [lookAtTarget, setLookAtTarget] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, z_layer));
    useImperativeHandle(ref, () => ({
        getNodeScreenCoords: (node: any) => {
            if (fgRef.current && node) {
                const px = node.fx !== undefined ? node.fx : (node.x !== undefined ? node.x : 0);
                const py = node.fy !== undefined ? node.fy : (node.y !== undefined ? node.y : 0);
                const pz = node.fz !== undefined ? node.fz : (node.z !== undefined ? node.z : 0);
                return fgRef.current.graph2ScreenCoords(px, py, pz);
            }
            return null;
        },
        getGraphData: () => {
            return {
                ...graphData,
                layoutMode: layoutMode
            };
        },
        setForceMode: (enabled: boolean) => {
            if (enabled) {
                setLayoutMode('force');
                // Force ONにする時は全ノードの固定を解除（アンピン）して、物理演算に従って滑らかに漂うようにする
                graphData.nodes.forEach(node => {
                    delete node.fx;
                    delete node.fy;
                    delete node.fz;
                });
                if (fgRef.current) {
                    fgRef.current.d3ReheatSimulation();
                    fgRef.current.refresh();
                }
            } else {
                setLayoutMode('static');
                graphData.nodes.forEach(node => {
                    node.fx = node.x !== undefined ? node.x : 0;
                    node.fy = node.y !== undefined ? node.y : 0;
                    node.fz = node.z !== undefined ? node.z : z_layer;
                });
                if (fgRef.current) {
                    fgRef.current.refresh();
                }
            }
        },
        setGlobalBackground: (bg: string) => {
            setGraphData(prev => ({ ...prev, globalBackground: bg }));
        },
        setFuncMode: (mode: boolean) => {
            console.log('setFuncMode', mode);
            setFuncMode(mode);
        },
        setGraphData: (graphData:any) => {
            // 背景の誤クリックによる選択解除を防ぐため、 mountTime をリセットする
            mountTime.current = Date.now();

            // layoutModeをロード
            const loadedLayoutMode = graphData.layoutMode === 'force' ? 'force' : 'static';
            setLayoutMode(loadedLayoutMode);

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
                        type: "issue", 
                        group: 1,
                        style_id: 1,
                        fx: 0, 
                        fy: 0, 
                        fz: z_layer,
                        size_x: 300,
                        size_y: 200,
                        name: "",

                    createdAt: now,
                    updatedAt: now
                };
                
                setGraphData((prev: any) => ({
                    ...prev,
                    nodes: [new_node],
                    links: []
                }));
                setSelectedNode(new_node);
                
                // 編集モーダルを表示
                //props.onNodeEdit(new_node);
            } else {
                // cameraプロパティがあれば分離（stateには含めない）
                const { camera: cameraData, layoutMode: loadedLayout, ...restGraphData } = graphData;
                
                if (loadedLayoutMode === 'static') {
                    if (restGraphData.nodes) {
                        restGraphData.nodes.forEach((node: any) => {
                            // Staticモードなら全ノードを確実に固定する
                            node.fx = node.fx !== undefined ? node.fx : (node.x !== undefined ? node.x : 0);
                            node.fy = node.fy !== undefined ? node.fy : (node.y !== undefined ? node.y : 0);
                            node.fz = node.fz !== undefined ? node.fz : (node.z !== undefined ? node.z : z_layer);
                        });
                    }
                }
                setGraphData(restGraphData);
                
                if (loadedLayoutMode === 'force') {
                    if (restGraphData.nodes) {
                        restGraphData.nodes.forEach((node: any) => {
                            // Forceモードなら全ノードの固定を解除（アンピン）して物理シミュレーションを有効にする
                            delete node.fx;
                            delete node.fy;
                            delete node.fz;
                        });
                    }
                    setTimeout(() => {
                        if (fgRef.current) {
                            fgRef.current.d3ReheatSimulation();
                            fgRef.current.refresh();
                        }
                    }, 200);
                }
                
                if (restGraphData.nodes && restGraphData.nodes.length > 0) {
                    // idが1のルートノードがあればそれを優先し、なければ配列の先頭ノードを初期選択とする
                    const initialNode = restGraphData.nodes.find((n: any) => String(n.id) === '1') || restGraphData.nodes[0];
                    setSelectedNode(initialNode);
                }
                
                // カメラ情報があれば復元（グラフの初期化完了後に実行）
                if (cameraData && fgRef.current) {
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            if (!fgRef.current) return;
                            const cam = cameraData;
                            fgRef.current.cameraPosition(
                                cam.position,
                                cam.lookAt,
                                0 // 即座に移動
                            );
                            setLookAtTarget(new THREE.Vector3(cam.lookAt.x, cam.lookAt.y, cam.lookAt.z));
                            const controls = fgRef.current.controls();
                            if (controls && cam.lookAt) {
                                controls.target.set(cam.lookAt.x, cam.lookAt.y, cam.lookAt.z);
                                controls.update();
                            }
                            setCameraOrientation();
                        }, 100); // グラフの初期化を待ってからカメラを復元
                    });
                }
            }
        },
        refreshNode: (node:any, options?: { skipHistory?: boolean, initialNode?: any }) => {
            console.log('refreshNode', node);
            
            // 更新前のノードの状態を取得（オプションで渡されたinitialNodeを最優先し、なければ現在のコピーを作成）
            const originalNode = graphData.nodes.find(n => String(n.id) === String(node.id));
            const originalNodeCopy = options?.initialNode 
                ? cloneDeep(options.initialNode) 
                : (originalNode ? cloneDeep(originalNode) : null);
            const isNew = node && has(node, 'isNew');
            
            // nodeがコピーでないことを確認し、コピーを作成
            const nodeToUpdate = cloneDeep(node);
            
            //nodeにisNewがある場合、キーを削除する
            if (isNew) {
                delete node.isNew;
                if (originalNode) {
                    delete originalNode.isNew;
                }

                const links = graphData.links.filter(l => l.source.id === node.id || l.target.id === node.id);
                
                links.forEach(link => {
                    refreshLink(link);
                });         
                if (!options?.skipHistory) {
                    addToHistory('add_node', {"node":node, "links":links});
                }
            }
            // 更新日時を設定
            node.updatedAt = new Date().toISOString();
            
            // ノードが新規でない場合、履歴に追加
            if (!isNew && originalNodeCopy && !options?.skipHistory) {
                addToHistory('edit_node', {
                    before: originalNodeCopy,
                    after: node
                });
            }

            // graphData内のノードを新しいノードで置き換え（参照を保ちつつプロパティを上書き）
            // react-force-graph-3d は内部でノードオブジェクトの参照をキャッシュするため、
            // 配列要素を差し替えるのではなく、同じ参照にプロパティをマージして更新する
            if (originalNode) {
                // プレビュー等の cloneDeep で複製され壊れた __threeObj で上書きされるのを防ぐため、
                // __threeObj を除外してプロパティをマージします。
                const { __threeObj, ...cleanNode } = node;
                Object.assign(originalNode, cleanNode);

                // リンクのsource/targetが更新された場合、リンクも更新
                graphData.links.forEach(link => {
                    if (String(link.source.id) === String(node.id)) {
                        refreshLink(link);
                    }
                    if (String(link.target.id) === String(node.id)) {
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
            setSelectedLink(null);
            
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
        focusOnNode: (node: any) => {
            if (node && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
                const distance = 700;
                if (fgRef.current) {
                    fgRef.current.cameraPosition(
                        { x: node.x, y: node.y, z: node.z + distance }, // new position
                        { x: node.x, y: node.y, z: node.z }, // lookAt ({ x, y, z })
                        600  // ms transition duration
                    );
                }
            }
        },
        // 選択中のノードを取得する関数を追加
        getSelectedNode: () => {
            return selectedNode;
        },
        getSelectedLink: () => {
            return selectedLink;
        },
        copyNode: () => {
            if (!selectedNode) return;
            copiedNodeRef.current = selectedNode;
        },
        getCopiedNode: () => {
            if (!copiedNodeRef.current) return null;
            const copied = cloneDeep(copiedNodeRef.current);
            const keys = [
                'name', 
                'group', 
                'style_id', 
                'deadline', 
                'priority', 
                'urgency', 
                'disabled', 
                'icon_img', 
                'size_x', 
                'size_y', 
                'img', 
                'type', 
                'url', 
                'file_path', 
                'folder_path',
                'node_bg_color',
                'node_pattern_color',
                'node_custom_bg_color'
            ];
            // 不要なオブジェクトプロパティ（__threeObjなど）やレイアウト座標をクリーンアップ
            Object.keys(copied).forEach(key => {
                if (!keys.includes(key)) {
                    delete copied[key];
                }
            });
            return copied;
        },
        // 複数選択中のノードリストを取得する関数を追加
        getSelectedNodeList: () => {
            return selectedNodeList;
        },
        // グループ情報を取得する関数
        getGroups: () => {
            return graphData.groups || [];
        },
        // グループ情報を更新する関数
        updateGroup: (group: any, nodeIds: number[]) => {
            setGraphData((prev: any) => {
                const groups = prev.groups ? [...prev.groups] : [];
                const idx = groups.findIndex((g: any) => g.id === group.id);
                if (idx !== -1) {
                    groups[idx] = group;
                } else {
                    groups.push(group);
                }

                // 参照を維持したまま、所属グループ情報を更新
                prev.nodes.forEach((node: any) => {
                    const shouldBeInGroup = nodeIds.includes(node.id);
                    if (!node.groupIds) {
                        node.groupIds = [];
                        if (node.groupId !== undefined) {
                            node.groupIds.push(node.groupId);
                        }
                    }
                    
                    const isCurrentlyInGroup = node.groupIds.includes(group.id);
                    if (shouldBeInGroup) {
                        if (!isCurrentlyInGroup) {
                            node.groupIds.push(group.id);
                        }
                        // For legacy/fallback, set groupId to the last/main group
                        node.groupId = group.id;
                    } else {
                        if (isCurrentlyInGroup) {
                            node.groupIds = node.groupIds.filter((id: number) => id !== group.id);
                        }
                        if (node.groupId === group.id) {
                            node.groupId = node.groupIds.length > 0 ? node.groupIds[node.groupIds.length - 1] : undefined;
                        }
                    }
                    
                    // Clean up if array is empty
                    if (node.groupIds.length === 0) {
                        delete node.groupIds;
                        delete node.groupId;
                    }
                });

                return { ...prev, groups };
            });

            setTimeout(() => {
                if (fgRef.current) fgRef.current.refresh();
            }, 50);
        },
        // グループを削除する関数
        deleteGroup: (groupId: number) => {
            setGraphData((prev: any) => {
                const groups = prev.groups ? prev.groups.filter((g: any) => g.id !== groupId) : [];
                
                // 参照を維持したまま、所属グループ情報を削除
                prev.nodes.forEach((node: any) => {
                    if (node.groupIds && Array.isArray(node.groupIds)) {
                        node.groupIds = node.groupIds.filter((id: number) => id !== groupId);
                        if (node.groupIds.length === 0) {
                            delete node.groupIds;
                        }
                    }
                    if (node.groupId === groupId) {
                        node.groupId = (node.groupIds && node.groupIds.length > 0) ? node.groupIds[node.groupIds.length - 1] : undefined;
                        if (node.groupId === undefined) {
                            delete node.groupId;
                        }
                    }
                });
                
                return { ...prev, groups };
            });

            setTimeout(() => {
                if (fgRef.current) fgRef.current.refresh();
            }, 50);
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
                // 循環親子関係のチェック：targetからsourceへの親子パスがあれば、循環を避けるために友達リンクにする
                const isCyclic = hasParentChildPath(target.id, source.id, graphData.links);
                // 親ノードは1つのみのルール：target(子)が既に別の親ノードを持つかチェック
                const alreadyHasParent = graphData.links.some(link => {
                    if (link.type === 'friend') return false;
                    const tId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;
                    return String(tId) === String(target.id);
                });

                let linkType: string;
                if (target.type === 'issue') {
                    linkType = 'friend';
                } else if (isCyclic) {
                    linkType = 'friend';
                } else if (alreadyHasParent) {
                    // すでに親を持つ場合、共通の祖先をチェックする
                    const targetAncestors = getAncestors(target.id, graphData.links);
                    const sourceAncestors = getAncestors(source.id, graphData.links);
                    const sIdStr = String(source.id);

                    let hasCommon = false;
                    if (targetAncestors.has(sIdStr)) {
                        hasCommon = true;
                    } else {
                        for (const ancestor of sourceAncestors) {
                            if (targetAncestors.has(ancestor)) {
                                hasCommon = true;
                                break;
                            }
                        }
                    }
                    // 共通の祖先を持つ場合は friend、持たない（異なる木である）場合は parent-child
                    linkType = hasCommon ? 'friend' : 'parent-child';
                } else {
                    linkType = 'parent-child';
                }

                const newLink = { 
                    index: newIndex, 
                    source: source, 
                    target: target, 
                    isNew: true,
                    type: linkType 
                };
                graphData.links.push(newLink);
                refreshLink(newLink)
                fgRef.current.refresh();

                addToHistory('add_link', newLink);
            }
        },
        // 新規ノード追加用のインターフェース
        addNode: (newNode:any, parentNode?: any) => {
            const actualParent = parentNode !== undefined ? parentNode : selectedNode;
            if (actualParent){
                const px = actualParent.fx !== undefined ? actualParent.fx : (actualParent.x || 0);
                const py = actualParent.fy !== undefined ? actualParent.fy : (actualParent.y || 0);
                const pz = actualParent.fz !== undefined ? actualParent.fz : (actualParent.z || 0);

                let cx = 0, cy = 0, cz = 500;
                if (fgRef.current) {
                    const camera = fgRef.current.camera();
                    if (camera && camera.position) {
                        cx = camera.position.x;
                        cy = camera.position.y;
                        cz = camera.position.z;
                    }
                }

                const dx = cx - px;
                const dy = cy - py;
                const dz = cz - pz;
                const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

                const ux = len > 0 ? dx / len : 0;
                const uy = len > 0 ? dy / len : 0;
                const uz = len > 0 ? dz / len : 1;

                const distanceToCamera = 150;
                const randomOffsetRange = 60;
                const rx = (Math.random() - 0.5) * randomOffsetRange;
                const ry = (Math.random() - 0.5) * randomOffsetRange;

                const targetX = px + ux * distanceToCamera + rx;
                const targetY = py + uy * distanceToCamera + ry;
                const targetZ = pz + uz * distanceToCamera;

                if (layoutMode === 'force') {
                    newNode.x = targetX;
                    newNode.y = targetY;
                    newNode.z = targetZ;
                } else {
                    newNode.fx = targetX;
                    newNode.fy = targetY;
                    newNode.fz = targetZ;
                }
            } else {
                const targetX = (newNode.x || 0) + (10 + Math.floor(Math.random() * 21));
                const targetY = (newNode.y || 0) + (10 + Math.floor(Math.random() * 21));
                const targetZ = (newNode.z || 0) + (10 + Math.floor(Math.random() * 21));

                if (layoutMode === 'force') {
                    newNode.x = targetX;
                    newNode.y = targetY;
                    newNode.z = targetZ;
                } else {
                    newNode.fx = targetX;
                    newNode.fy = targetY;
                    newNode.fz = targetZ;
                }
            }
            
            const nodeId = Math.max(...graphData.nodes.map((item:any) => item.id)) + 1;
            newNode.id = nodeId;
            newNode.isNew = true;
            
            const now = new Date().toISOString();
            newNode.createdAt = now;
            newNode.updatedAt = now;

            if (actualParent && newNode.group === undefined) {
                newNode.group = actualParent.group || 1;
            }

            let newLink: any = null;
            if (actualParent) {
                newLink = {
                    index: graphData.links.length > 0 ? Math.max(...graphData.links.map((link: any) => link.index)) + 1 : 1,
                    source: actualParent,
                    target: newNode,
                    isNew: true,
                };
            }

            // 履歴に手動で追加（ノードとリンクを一括）
            addToHistory('add_node', {
                node: cloneDeep(newNode),
                links: newLink ? [cloneDeep(newLink)] : []
            });

            // 新規ノードを追加（履歴追加をスキップ）
            props.onRefreshNode(newNode, { skipHistory: true });

            if (newLink) {
                delete newLink.isNew;
                newLink.name = "";
            }
            delete newNode.isNew;

            setGraphData(prev => {
                const nextNodes = [...prev.nodes, newNode];
                const nextLinks = newLink ? [...prev.links, newLink] : prev.links;
                return {
                    ...prev,
                    nodes: nextNodes,
                    links: nextLinks
                };
            });
            
            setTimeout(() => {
                if (fgRef.current) {
                    fgRef.current.refresh();
                }
            }, 50);
            
            return newNode;
        },
        // 新規ノード追加用のインターフェース
        addNewNode: () => {
            if (!selectedNode) return;
            
            const nodeId = Math.max(...graphData.nodes.map((item:any) => item.id)) + 1;
            const groupId = selectedNode.group || 1;
            const now = new Date().toISOString();

            // 親ノードの位置
            const px = selectedNode.fx !== undefined ? selectedNode.fx : (selectedNode.x || 0);
            const py = selectedNode.fy !== undefined ? selectedNode.fy : (selectedNode.y || 0);
            const pz = selectedNode.fz !== undefined ? selectedNode.fz : (selectedNode.z || 0);

            // カメラの位置を取得
            let cx = 0, cy = 0, cz = 500;
            if (fgRef.current) {
                const camera = fgRef.current.camera();
                if (camera && camera.position) {
                    cx = camera.position.x;
                    cy = camera.position.y;
                    cz = camera.position.z;
                }
            }

            // 親ノードからカメラへの方向ベクトル
            const dx = cx - px;
            const dy = cy - py;
            const dz = cz - pz;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // カメラに向かう手前への方向（単位ベクトル）
            const ux = len > 0 ? dx / len : 0;
            const uy = len > 0 ? dy / len : 0;
            const uz = len > 0 ? dz / len : 1;

            // カメラ方向に一定距離（例えば 150px）進め、少しランダムにずらす
            const distanceToCamera = 150;
            const randomOffsetRange = 60;
            const rx = (Math.random() - 0.5) * randomOffsetRange;
            const ry = (Math.random() - 0.5) * randomOffsetRange;

            const targetFx = px + ux * distanceToCamera + rx;
            const targetFy = py + uy * distanceToCamera + ry;
            const targetFz = pz + uz * distanceToCamera;

            const newNode = { 
                id: nodeId, 
                img: "new_node.png", 
                type: "normal",
                group: groupId, 
                style_id: 1, 
                fx: targetFx, 
                fy: targetFy, 
                fz: targetFz,
                size_x: 200,
                size_y: 120,
                name: "",
                isNew: true,
                createdAt: now,
                updatedAt: now
            };

            const newLink = {
                index: graphData.links.length > 0 ? Math.max(...graphData.links.map((link: any) => link.index)) + 1 : 1,
                source: selectedNode,
                target: newNode,
                isNew: true,
            };

            // 新規ノードを追加
            setGraphData(prev => ({
                ...prev,
                nodes: [...prev.nodes, newNode],
                links: [...prev.links, newLink]
            }));

            setTimeout(() => {
                if (fgRef.current) {
                    fgRef.current.refresh();
                }
            }, 50);

            // 編集モーダルを表示
            props.onNodeEdit(newNode);
        },
        canUndo,
        canRedo,
        undo: (): boolean => {
            const result = undo(graphData, {
                deleteNode,
                deleteLink,
                setGraphData,
                refreshLink
            });
            if (result) {
                fgRef.current.refresh();
            }
            return result;
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
                
                // 1秒後に固定位置を復元 (ForceONのときはアンピン状態を維持するため固定しない)
                setTimeout(() => {
                    graphData.nodes.forEach(node => {
                        if (layoutMode !== 'force') {
                            // 現在の位置をfx, fy, fzに設定
                            node.fx = node.x;
                            node.fy = node.y;
                            node.fz = node.z;
                        }
                        
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
                    const baseRadius = 80; // 中心円の基本半径
                    const radiusIncrement = 100; // レベルごとの半径の増分
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
        redo: (): boolean => {
            const result = redo(graphData, {
                deleteNode,
                deleteLink,
                setGraphData,
                refreshLink
            });
            if (result) {
                fgRef.current.refresh();
            }
            return result;
        },
        getCameraState: () => {
            if (!fgRef.current) return null;
            const pos = fgRef.current.cameraPosition();
            const controls = fgRef.current.controls();
            const target = controls ? controls.target : lookAtTarget;
            return {
                position: { x: pos.x, y: pos.y, z: pos.z },
                lookAt: { x: target.x, y: target.y, z: target.z }
            };
        }
    }));

    // node.idと一致するnodeをgraphDataから削除する関数
    const deleteNode = (nodeId: number) => {
        setGraphData(prevData => ({
            ...prevData,
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
        setSelectedLink(null);
        
        if (!node) {
            setSelectedNode(null);
            setSelectedNodeList([]);
            return;
        }

        // ドラッグ直後のクリックイベントを無視する
        if (Date.now() - lastDragEndTime.current < 100) {
            return;
        }

        // シングルクリック時にそのノードの位置をピン留め（固定）する (ForceONのときはアンピン状態を維持するためスキップ)
        if (layoutMode === 'force') {
            // クリック時の固定は行いません
            console.log('Force mode active: skipped pinning node on click:', node.id);
        }

        // Ctrlキーが押されている場合は複数選択モード
        if ( funcMode  && node) {
            let currentList = [...selectedNodeList];
            // もし通常選択のみされていて、リストに入っていなければ追加
            if (selectedNode && currentList.length === 0) {
                currentList = [selectedNode];
            }

            if (currentList.some(n => String(n.id) === String(node.id))) {
                // 既に選択されている場合は解除
                currentList = currentList.filter(n => String(n.id) !== String(node.id));
                setSelectedNodeList(currentList);
                if (String(selectedNode?.id) === String(node.id)) {
                    setSelectedNode(currentList.length > 0 ? currentList[currentList.length - 1] : null);
                }
            } else {
                // 新しいノードを選択リストに追加
                currentList.push(node);
                setSelectedNodeList(currentList);
                setSelectedNode(node);
            }
            return;
        } 

        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime.current;
        
        // ダブルクリック検出（指定ms以内に同じノードをクリック）
        const timeSinceLastClickInterval = 300; // 600msから300msに短縮し、誤動作を防止
        const isSameNode = lastClickedNode.current && String(node.id) === String(lastClickedNode.current.id);
        
        if (timeSinceLastClick < timeSinceLastClickInterval && isSameNode) {
            // ダブルクリック処理
            if (clickTimeout.current) {
                clearTimeout(clickTimeout.current);
                clickTimeout.current = null;
            }
            handleDoubleClick(node);
            lastClickTime.current = 0; // ダブルクリック後にリセット
            lastClickedNode.current = null;
            return;
        }
        
        // シングルクリックの時刻とノードを記録
        lastClickTime.current = now;
        lastClickedNode.current = node;

        // 複数選択をクリア
        if (selectedNodeList.length > 0) {
            setSelectedNodeList([]);
        }

        // 選択されたノードを更新（変更がある場合のみ）
        if (String(selectedNode?.id) !== String(node.id)) {
            setSelectedNode(node);
        }

        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
        }

        // シングルクリックの場合は、ダブルクリックでないことが確定してからカメラの視点（ターゲット）のみを対象ノードに向ける
        clickTimeout.current = setTimeout(() => {
            /* コメントアウト：ノードの左クリック時の視点移動
            if (fgRef.current && node && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
                // controls.target.set() を直接呼ぶと一瞬で視点が切り替わってしまいアニメーションが効かなくなるため削除します。
                // 代わりに cameraPosition() に現在のカメラ位置と新しい lookAt を渡すことでスムーズに視点を移動させます。
                const currentPos = fgRef.current.cameraPosition();
                fgRef.current.cameraPosition(
                    currentPos, // カメラの位置は現在の位置を維持
                    { x: node.x, y: node.y, z: node.z }, // lookAt を対象ノードに更新
                    1000 
                );
                // 視点座標を保存
                setLookAtTarget(new THREE.Vector3(node.x, node.y, node.z));
                // カメラの向きを設定
                setCameraOrientation();
            }
            */
            clickTimeout.current = null;
        }, timeSinceLastClickInterval); // ダブルクリック判定時間と同じms待つ
    }, [fgRef,selectedNodeList, selectedNode, graphData,funcMode,layoutMode]);
    
    // ノードのダブルクリックを処理する関数
    const handleDoubleClick = (node: any) => {
        console.log('Node double clicked:', node);
        const nodeType = node.type || "";
        
        // リンクタイプのノードの場合、URLを開く
        if ((nodeType === "link") && node.url) {
            console.log('Opening URL:', node.url);
            let url = node.url;
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }
            window.open(url, '_blank');
        }
        // ファイルタイプのノードの場合
        else if (nodeType === "file" && node.file_path) {
            console.log('Opening file:', node.file_path);
            props.onOpenFile && props.onOpenFile(node);
        }
        // フォルダタイプのノードの場合
        else if ((nodeType === "folder") && node.folder_path) {
            console.log('Opening folder:', node.folder_path);
            props.onOpenFolder && props.onOpenFolder(node);
        }
        else {
            // 通常の選択モード（カメラ移動）
            if (node && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
                // ダブルクリック時にそのノードの位置をピン留め（固定）する (ForceONのときはアンピン状態を維持するためスキップ)
                if (layoutMode === 'force') {
                    // ダブルクリック時の固定は行いません
                    console.log('Force mode active: skipped pinning node on double click:', node.id);
                }

                if (selectedNodeList.length > 0) {
                    setSelectedNodeList([]);
                }
                setSelectedNode(node); // ダブルクリック時にも選択状態に設定する！
                
                const defaultDistance = 1000;
                let targetZ = node.z + defaultDistance;

                if (fgRef.current) {
                    const currentCamPos = fgRef.current.cameraPosition();
                    // Z軸方向の距離を計算
                    const currentDistZ = Math.abs(currentCamPos.z - node.z);
                    // 現在の距離がデフォルト値より近い場合、現在のZ座標を維持する
                    if (currentDistZ < defaultDistance) {
                        targetZ = currentCamPos.z;
                    }
                }

                setLookAtTarget(new THREE.Vector3(node.x, node.y, node.z));

                if (fgRef.current) {
                    fgRef.current.cameraPosition(
                        { x: node.x, y: node.y, z: targetZ },
                        { x: node.x, y: node.y, z: node.z },
                        1000
                    );
                }
                setCameraOrientation();
            }
        }
    };

    const setCameraOrientation = () => {
        // カメラ位置の更新
        if (fgRef.current) {
            let camera = fgRef.current.camera();
            camera.up.set(0, 1, 0); // Y軸を上向きに設定
        }
    };

    const handleRightClick = (node: NodeData | null, event: MouseEvent) => {
        if (!node || !event) return;
        
        // 右クリックされたノードが現在複数選択リストに入っていない場合のみ、選択リストをクリアしてアクティブノードとする
        const isAlreadySelected = selectedNodeList.some(n => String(n.id) === String(node.id));
        if (!isAlreadySelected) {
            setSelectedNodeList([]);
            setSelectedNode(node);
        } else {
            // すでに選択されているノード郡の中のノードを右クリックした場合は、リストを維持しつつそれをアクティブノードとする
            setSelectedNode(node);
        }

        console.log(event.clientX, event.clientY);
        
        // 画面上のクリック座標を親コンポーネントに通知
        props.onNodeRightClick && props.onNodeRightClick(node, event.clientX, event.clientY);
    };

    const handleLinkRightClick = (link: any) => {
        setSelectedLink(link);
        setSelectedNode(null);
        setSelectedNodeList([]);
        props.onLinkEdit(link);
    };
    const handleLinkClick = (link: any) => {
        console.log('handleLinkClick', link);
        setSelectedLink(link);
        setSelectedNode(null);
        setSelectedNodeList([]);
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
            
            // ドラッグ開始時に、自身に繋がっている子孫ノードのピン留めを解除（アンピン）して追従させる
            if (layoutMode === 'force') {
                const descendantIds = new Set<string>();
                const getDescendants = (parentNodeId: any) => {
                    graphData.links.forEach((link: any) => {
                        if (link.type === 'friend') {
                            return; // 友達リンクは下流ノード（子孫）の探索から省く！
                        }
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        
                        if (String(sourceId) === String(parentNodeId)) {
                            const childNode = graphData.nodes.find((n: any) => String(n.id) === String(targetId)) as any;
                            if (childNode && !descendantIds.has(String(childNode.id))) {
                                descendantIds.add(String(childNode.id));
                                getDescendants(childNode.id);
                            }
                        }
                    });
                };
                getDescendants(dragNode.id);

                // ドラッグ対象となる直接のノード（および複数選択されているノード）を特定
                const activeDragIds = new Set<string>();
                activeDragIds.add(String(dragNode.id));
                const isDragNodeInSelection = selectedNodeList.some(sn => String(sn.id) === String(dragNode.id));
                if (isDragNodeInSelection) {
                    selectedNodeList.forEach(sn => {
                        activeDragIds.add(String(sn.id));
                    });
                }

                // 全ノードに対して一時固定・固定解除の処理を行う
                graphData.nodes.forEach((node: any) => {
                    // ドラッグ前の元の固定状態を保存する
                    node._originalFx = node.fx;
                    node._originalFy = node.fy;
                    node._originalFz = node.fz;
                    node._wasPinnedBeforeDrag = (node.fx !== undefined || node.fy !== undefined);

                    // nodeがドラッグ対象（直接ドラッグしているノード、または共に動かす選択ノード）かどうかを判定
                    const isActiveDrag = activeDragIds.has(String(node.id));
                    node._isActiveDrag = isActiveDrag;

                    if (isActiveDrag) {
                        // ドラッグ対象のノードのみ、自由に動けるようにピン留めを一時解除する
                        delete node.fx;
                        delete node.fy;
                        delete node.fz;
                    }
                });
                
                // シミュレーションを再活性化して追従を滑らかにする
                if (fgRef.current) {
                    fgRef.current.d3ReheatSimulation();
                }
            }
        }
        isDraggingNode.current = true;


    
        // Shiftキーが押されている場合は、3Dオブジェクトの回転モード
        if (isShiftDown.current && dragNode.type === "3dobject") {
            if (dragNode.px !== undefined) {
                let dx = dragNode.x - dragNode.px;
                let dy = dragNode.y - dragNode.py;
                let dz = dragNode.pz !== undefined ? dragNode.z - dragNode.pz : 0;
                
                let rotDx = dx;
                let rotDy = dy;

                if (fgRef.current) {
                    const camera = fgRef.current.camera();
                    if (camera) {
                        // カメラの向きに基づいて、3D空間の移動ベクトルを画面上の左右・上下の移動量に変換
                        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
                        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
                        
                        const dragVector = new THREE.Vector3(dx, dy, dz);
                        rotDx = dragVector.dot(cameraRight);
                        rotDy = dragVector.dot(cameraUp);
                    }
                }

                dragNode.rot_y = (dragNode.rot_y || 0) + rotDx * 0.005;
                dragNode.rot_x = (dragNode.rot_x || 0) + rotDy * 0.005;

                if (dragNode.__threeObj) {
                    const innerGroup = dragNode.__threeObj.children.find((c:any) => c.name === "rotation_group");
                    if (innerGroup) {
                        innerGroup.rotation.y = dragNode.rot_y;
                        innerGroup.rotation.x = dragNode.rot_x;
                    }
                }

                // 座標を元に戻す (移動させない)
                dragNode.x = dragNode.px;
                dragNode.y = dragNode.py;
                dragNode.z = dragNode.pz !== undefined ? dragNode.pz : dragNode.z;
                dragNode.fx = dragNode.px;
                dragNode.fy = dragNode.py;
                dragNode.fz = dragNode.pz !== undefined ? dragNode.pz : dragNode.z;
            }
            dragNode.px = dragNode.x;
            dragNode.py = dragNode.y;
            dragNode.pz = dragNode.z;
            return;
        }

        // ドラッグ中のノードが複数選択リストに含まれている場合、他の選択ノードも同じ移動量で移動させる
        if (selectedNodeList.some(node => String(node.id) === String(dragNode.id))) {
            if (dragNode.px !== undefined) {
                dragNode.dx = dragNode.x - dragNode.px;
                dragNode.dy = dragNode.y - dragNode.py;
                dragNode.dz = dragNode.z - dragNode.pz;
                selectedNodeList.forEach(node => {
                    if (String(node.id) !== String(dragNode.id)) {
                        node.x = node.x + dragNode.dx;
                        node.y = node.y + dragNode.dy;
                        node.z = node.z + dragNode.dz;
                        
                        if (layoutMode !== 'force') {
                            const baseFx = node.fx !== undefined ? node.fx : node.x;
                            const baseFy = node.fy !== undefined ? node.fy : node.y;
                            const baseFz = node.fz !== undefined ? node.fz : node.z;

                            node.fx = baseFx + dragNode.dx;
                            node.fy = baseFy + dragNode.dy;
                            node.fz = baseFz + dragNode.dz;
                        } else {
                            delete node.fx;
                            delete node.fy;
                            delete node.fz;
                        }
                    }
                });
            }
            dragNode.px = dragNode.x;
            dragNode.py = dragNode.y;
            dragNode.pz = dragNode.z;

            console.log('dragNode:', dragNode.dx, dragNode.dy, dragNode.dz);
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
            setInterimLink(-1, node, dragNode);
            break;
          }
          // 十分に他のノードに近い場合: 推奨リンクのターゲットとして他のノードにスナップ
          if (interimLink && node.id !== interimLink.target.id && distance(dragNode, node) < snapInDistance) {
            let removed_index = removeLink(interimLink);
            setInterimLink(removed_index, node, dragNode);
            break;
          }
        }

        // 十分に離れている場合：現在のターゲットノードからスナップアウト
        if (interimLink && distance(dragNode, interimLink.target) > snapOutDistance) {
            removeLink(interimLink);
            setInterimLinkState(null);
        }

        // 次のドラッグフレーム用に前回の座標を保持する
        dragNode.px = dragNode.x;
        dragNode.py = dragNode.y;
        dragNode.pz = dragNode.z;
    };

    const handleBackgroundClick = (event:any) => {
        // --- 1. グループ名ラベルへの右クリック判定 (Raycasting) ---
        const scene = fgRef.current?.scene();
        const camera = fgRef.current?.camera();
        const renderer = fgRef.current?.renderer();
        
        if (scene && camera && renderer) {
            // マウス位置をWebGL座標系（-1 から 1）に正規化
            const rect = renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // 全てのグループ名ラベル（SpriteText）を収集してレイキャスト
            const labelSprites: THREE.Sprite[] = [];
            const spriteToGroupMap = new Map<THREE.Sprite, number>(); // sprite -> groupId
            
            groupVisualsRef.current.forEach((visualObj, groupId) => {
                if (visualObj.sprite) {
                    labelSprites.push(visualObj.sprite);
                    spriteToGroupMap.set(visualObj.sprite, groupId);
                }
            });
            
            const intersects = raycaster.intersectObjects(labelSprites);
            if (intersects.length > 0) {
                // 最も手前にあるラベルを取得
                const clickedSprite = intersects[0].object as THREE.Sprite;
                const clickedGroupId = spriteToGroupMap.get(clickedSprite);
                if (clickedGroupId !== undefined) {
                    // 親コンポーネントのグループ編集ポップアップを呼び出す
                    props.onGroupRightClick && props.onGroupRightClick(clickedGroupId, event.clientX, event.clientY);
                    return; // 新規ノード作成処理を実行せずに終了！
                }
            }
        }

        let cameraObj = fgRef.current.camera();
        let distance = 800;
        if (selectedNode) {
            distance = Math.abs((selectedNode.fz ?? 0) - cameraObj.position.z);
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
    const catModel = useRef<THREE.Group | null>(null);
    const birdModel = useRef<THREE.Group | null>(null);
    const bird2Model = useRef<THREE.Group | null>(null);
    const airplaneModel = useRef<THREE.Group | null>(null);
    const loadingModels = useRef<Set<number>>(new Set());

    const loadModelOnDemand = useCallback((styleId: number) => {
        if (loadingModels.current.has(styleId)) return;

        if (styleId === 3 && !catModel.current) {
            loadingModels.current.add(styleId);
            const mtlLoader = new MTLLoader();
            mtlLoader.setPath('./assets/cat/');
            mtlLoader.load('12221_Cat_v1_l3.mtl', (materials) => {
                materials.preload();
                const objLoader = new OBJLoader();
                objLoader.setMaterials(materials);
                objLoader.setPath('./assets/cat/');
                objLoader.load('12221_Cat_v1_l3.obj', (object) => {
                    catModel.current = object;
                    loadingModels.current.delete(styleId);
                    if (fgRef.current) fgRef.current.refresh();
                }, undefined, () => { loadingModels.current.delete(styleId); });
            }, undefined, () => { loadingModels.current.delete(styleId); });
        } else if (styleId === 4 && !birdModel.current) {
            loadingModels.current.add(styleId);
            const birdMtlLoader = new MTLLoader();
            birdMtlLoader.setPath('./assets/bird1/');
            birdMtlLoader.load('12213_Bird_v1_l3.mtl', (materials) => {
                materials.preload();
                const objLoader = new OBJLoader();
                objLoader.setMaterials(materials);
                objLoader.setPath('./assets/bird1/');
                objLoader.load('12213_Bird_v1_l3.obj', (object) => {
                    birdModel.current = object;
                    loadingModels.current.delete(styleId);
                    if (fgRef.current) fgRef.current.refresh();
                }, undefined, () => { loadingModels.current.delete(styleId); });
            }, undefined, () => { loadingModels.current.delete(styleId); });
        } else if (styleId === 5 && !bird2Model.current) {
            loadingModels.current.add(styleId);
            const bird2MtlLoader = new MTLLoader();
            bird2MtlLoader.setPath('./assets/bird2/');
            bird2MtlLoader.load('12249_Bird_v1_L2.mtl', (materials) => {
                materials.preload();
                const objLoader = new OBJLoader();
                objLoader.setMaterials(materials);
                objLoader.setPath('./assets/bird2/');
                objLoader.load('12249_Bird_v1_L2.obj', (object) => {
                    bird2Model.current = object;
                    loadingModels.current.delete(styleId);
                    if (fgRef.current) fgRef.current.refresh();
                }, undefined, () => { loadingModels.current.delete(styleId); });
            }, undefined, () => { loadingModels.current.delete(styleId); });
        } else if (styleId === 6 && !airplaneModel.current) {
            loadingModels.current.add(styleId);
            const airplaneMtlLoader = new MTLLoader();
            airplaneMtlLoader.setPath('./assets/airplane/');
            airplaneMtlLoader.load('11803_Airplane_v1_l1.mtl', (materials) => {
                materials.preload();
                const objLoader = new OBJLoader();
                objLoader.setMaterials(materials);
                objLoader.setPath('./assets/airplane/');
                objLoader.load('11803_Airplane_v1_l1.obj', (object) => {
                    airplaneModel.current = object;
                    loadingModels.current.delete(styleId);
                    if (fgRef.current) fgRef.current.refresh();
                }, undefined, () => { loadingModels.current.delete(styleId); });
            }, undefined, () => { loadingModels.current.delete(styleId); });
        }
    }, [fgRef]);

    const nodeThreeObjectImageTexture = useCallback((node: any): THREE.Object3D | SpriteText => {
        if (node.id < 0) {
            return nodeThreeObjectCustomMesh(node);
        }

        if (node.type && typeof node.type === 'string' && node.type !== '3dobject' && node.type !== 'image') {
            let cache = htmlNodeCache.current.get(node.id);
            const SCALE = 4; // 高解像度化の倍率

            // 描画が必要なデータを文字列化して比較（キャッシュの無駄な更新を防ぐ）
            const currentData = JSON.stringify({
                name: node.name,
                contents: node.contents, // テキスト内容の変更を検知（プレビュー用）
                deadline: node.deadline,
                priority: node.priority,
                urgency: node.urgency,
                assignee: node.assignee,
                style_id: node.style_id,
                node_bg_color: node.node_bg_color, // 背景色の変更を検知
                node_pattern_color: node.node_pattern_color, // 模様色の変更を検知
                node_custom_bg_color: node.node_custom_bg_color, // カスタム背景色の変更を検知
                type: node.type,
                url: node.url, // URLの変更を検知
                scale: node.scale, // スケールの変更を検知
                icon_size: node.icon_size, // アイコンサイズの変更を検知
                icon_img: !!node.icon_img, // アイコンの有無
                img: node.img, // imgの変更を検知
                disabled: !!node.disabled // 無効化状態の変更を検知
            });

            if (!cache) {
                let defaultWidth = 200;
                let defaultHeight = 120;
                if (node.type === "issue") {
                    defaultWidth = 300;
                    defaultHeight = 200;
                } else if (node.type === "task") {
                    defaultWidth = 250;
                    defaultHeight = 150;
                } else if (node.type !== "normal") {
                    defaultWidth = 250;
                    defaultHeight = 100;
                }

                const drawSizeX = node.size_x || defaultWidth;
                const drawSizeY = node.size_y || defaultHeight;

                // ノードのクリック・ドラッグ判定用ヒットボックス。
                // CSS3Dレイヤーはz-index:1でWebGLキャンバスの上に配置されるため、
                // ノードHTMLは常に雲・オーラの手前に表示される。
                // このhitBoxはカラーを描画せず（colorWrite:false）深度のみ書き込むことで、
                // 角丸外側の黒/白アーティファクトを防ぎつつ、WebGL内のリンク等のオクルージョンを維持する。
                const spriteMaterial = new THREE.SpriteMaterial({ 
                    colorWrite: false, // カラーバッファへの書き込みを無効化（角丸外側を完全透明にする）
                    depthWrite: true,  // 深度バッファに書き込んでリンク線等のWebGLオクルージョンを正常に機能させる
                    depthTest: true,
                });
                const hitBox = new THREE.Sprite(spriteMaterial);
                hitBox.renderOrder = 1; // 雲やリンク（renderOrder: 0）の描画後に深度を書き込み、正しいオクルージョンを確保
                hitBox.scale.set(drawSizeX, drawSizeY, 1);

                const div = document.createElement('div');
                div.style.pointerEvents = 'none'; 
                const root = ReactDOM.createRoot(div);
                
                const sprite = new CSS3DSprite(div);
                sprite.scale.set(1/SCALE, 1/SCALE, 1/SCALE);
                sprite.frustumCulled = false; // 画面外で消えないように

                // ResizeObserverを使って、Reactコンポーネントが描画された後の実際のDOMサイズに合わせてhitBoxを更新する
                const resizeObserver = new ResizeObserver(entries => {
                    for (let entry of entries) {
                        const { width, height } = entry.contentRect;
                        if (width > 0 && height > 0) {
                            const realWidth = width / SCALE;
                            const realHeight = height / SCALE;
                            // DOMのサイズはSCALE倍で描画されているため、元のサイズに戻してhitBoxに適用
                            hitBox.scale.set(realWidth, realHeight, 1);
                            
                            // ノードのデータオブジェクトにも実測サイズを動的にフィードバック！
                            // これにより、次回自動レイアウト実行時に「テキストが入った後の実際のサイズ」が正確に考慮されます
                            node.size_x = realWidth;
                            node.size_y = realHeight;
                        }
                    }
                });
                // コンポーネントがマウントされる最初の子要素（.node-html-content）を監視できるよう、
                // div自体のサイズ変更を監視する（.node-html-contentがdivを押し広げるようにするため、divをinline-block等にする必要があるかもしれないが、
                // React18のcreateRootはdivの中に要素を作る。div自体の幅や高さが変わるようにするには、div自体をinline-block等にするか、中の要素を監視する）
                
                // divはコンテナとして働くため、中身にフィットさせるためにinline-blockにする
                div.style.display = 'inline-block';
                resizeObserver.observe(div);

                const group = new THREE.Group();

                cache = { div, root, hitBox, sprite, group, lastData: "" };
                htmlNodeCache.current.set(node.id, cache);
            }
            
            // データが更新されている場合のみReactコンポーネントを再レンダリング
            if (cache.lastData !== currentData) {
                cache.root.render(<HtmlNodeComponent node={node} />);
                cache.lastData = currentData;
            }

            // ノードIDに基づいて微小なZ座標のオフセットを加算し、新しく作られたノードほど手前に判定されるようにする
            const zOffset = (node.id || 0) * 0.01;
            cache.hitBox.position.z = zOffset;
            cache.sprite.position.z = zOffset;

            // groupを作り直さず、中身を更新して返す（要素の追加は重複しない）
            cache.group.add(cache.hitBox);
            cache.group.add(cache.sprite);

            return cache.group;
        }

        if (node.type === "3dobject") {
            const group = new THREE.Group();
            const innerGroup = new THREE.Group();
            innerGroup.name = "rotation_group";
            if (node.rot_x) innerGroup.rotation.x = node.rot_x;
            if (node.rot_y) innerGroup.rotation.y = node.rot_y;
            group.add(innerGroup);

            let added = false;

            if (node.style_id === 1) {  // Horse.glbモデル
                const scene = horseModel.scene.clone();
                scene.traverse((child: any) => { 
                    child.raycast = () => {}; 
                    if (child.isMesh && child.material) {
                        child.material = Array.isArray(child.material)
                            ? child.material.map((m: any) => m.clone())
                            : child.material.clone();
                    }
                });
                const scale = node.scale || 1;  
                scene.scale.set(scale * 0.7, scale * 0.7, scale * 0.7);
                scene.rotation.y = Math.PI/2;
                innerGroup.add(scene);
                added = true;
            } else if (node.style_id === 2 && watchModel) {  // watchモデル
                const scene = watchModel.scene.clone();
                scene.traverse((child: any) => { 
                    child.raycast = () => {}; 
                    if (child.isMesh && child.material) {
                        child.material = Array.isArray(child.material)
                            ? child.material.map((m: any) => m.clone())
                            : child.material.clone();
                    }
                });
                const scale = node.scale || 1; 
                scene.scale.set(scale* 0.1, scale * 0.1, scale* 0.1);
                scene.rotation.y = Math.PI/12;
                innerGroup.add(scene);
                added = true;
            } else if (node.style_id === 3) {  // Cat.objモデル
                if (catModel.current) {
                    const scene = catModel.current.clone();
                    scene.traverse((child: any) => { 
                        child.raycast = () => {}; 
                        if (child.isMesh && child.material) {
                            child.material = Array.isArray(child.material)
                                ? child.material.map((m: any) => m.clone())
                                : child.material.clone();
                        }
                    });
                    const scale = node.scale || 1; 
                    scene.scale.set(scale * 2, scale * 2, scale * 2);
                    scene.rotation.x = -Math.PI/2;
                    scene.rotation.z = -Math.PI/6;
                    innerGroup.add(scene);
                    added = true;
                } else {
                    loadModelOnDemand(3);
                }
            } else if (node.style_id === 4) {  // Bird.objモデル
                if (birdModel.current) {
                    const scene = birdModel.current.clone();
                    scene.traverse((child: any) => { 
                        child.raycast = () => {}; 
                        if (child.isMesh && child.material) {
                            child.material = Array.isArray(child.material)
                                ? child.material.map((m: any) => m.clone())
                                : child.material.clone();
                        }
                    });
                    const scale = node.scale || 1;  
                    scene.scale.set(scale * 5, scale * 5, scale * 5);
                    scene.rotation.x = -Math.PI/2;
                    scene.rotation.z = Math.PI/6;
                    innerGroup.add(scene);
                    added = true;
                } else {
                    loadModelOnDemand(4);
                }
            } else if (node.style_id === 5) {  // Bird2.objモデル
                if (bird2Model.current) {
                    const scene = bird2Model.current.clone();
                    scene.traverse((child: any) => { 
                        child.raycast = () => {}; 
                        if (child.isMesh && child.material) {
                            child.material = Array.isArray(child.material)
                                ? child.material.map((m: any) => m.clone())
                                : child.material.clone();
                        }
                    });
                    const scale = node.scale || 1;  
                    scene.scale.set(scale, scale, scale);
                    scene.rotation.x = -Math.PI/2;
                    scene.rotation.z = Math.PI/6;
                    innerGroup.add(scene);
                    added = true;
                } else {
                    loadModelOnDemand(5);
                }
            } else if (node.style_id === 6) {  // Airplane.objモデル
                if (airplaneModel.current) {
                    const scene = airplaneModel.current.clone();
                    scene.traverse((child: any) => { 
                        child.raycast = () => {}; 
                        if (child.isMesh && child.material) {
                            child.material = Array.isArray(child.material)
                                ? child.material.map((m: any) => m.clone())
                                : child.material.clone();
                        }
                    });
                    const scale = node.scale || 1;  // デフォルトスケール0.05
                    scene.scale.set(scale * 0.05, scale * 0.05, scale * 0.05);
                    scene.rotation.x = -Math.PI/3;
                    scene.rotation.z = Math.PI/6;
                    innerGroup.add(scene);
                    added = true;
                } else {
                    loadModelOnDemand(6);
                }
            }

            if (added) {
                // モデルのバウンディングボックスから適切なサイズのヒットボックスを作成
                const box = new THREE.Box3().setFromObject(group);
                const sphere = new THREE.Sphere();
                box.getBoundingSphere(sphere);
                
                // Horseモデル等、内部のアニメーション用ボーンなどでバウンディングボックスが極端に大きくなる場合があるため上限を設ける
                const maxRadius = 40 * (node.scale || 1);
                const radius = Math.min(Math.max(sphere.radius, 15), maxRadius);
                
                // ドラッグやクリックの判定を正しく中心で受けるための透明なヒットボックス
                const hitBox = new THREE.Mesh(
                    new THREE.SphereGeometry(radius), 
                    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
                );
                // モデルの見た目上の中心にヒットボックスを合わせる
                hitBox.position.copy(sphere.center);
                group.add(hitBox);
            } else {
                // ロード完了前のプレースホルダー (ワイヤーフレームの立方体)
                const placeholderGeometry = new THREE.BoxGeometry(15, 15, 15);
                const placeholderMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true, transparent: true, opacity: 0.5 });
                const placeholderMesh = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
                innerGroup.add(placeholderMesh);
                
                // ヒットボックスも同サイズで作成
                const hitBox = new THREE.Mesh(
                    new THREE.SphereGeometry(12),
                    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
                );
                group.add(hitBox);
            }
            return group;
        }
        const imgPath = `./assets/${node['img']}`;
        let cachedTexture = textureCache.current.get(imgPath);
        
        let sprite: THREE.Sprite;
        if (cachedTexture) {
            sprite = new THREE.Sprite(cachedTexture.material);
            const texture = cachedTexture.texture;
            if (texture.image && texture.image.width && texture.image.height) {
                const imageAspect = texture.image.width / texture.image.height;
                let displaySizeX = node.size_x;
                let displaySizeY = node.size_x / imageAspect;
                
                if (node.type === "issue") {
                    const maxSide = Math.max(displaySizeX, displaySizeY);
                    if (maxSide > 0) {
                        const ratio = NODE_CONSTANTS.ISSUE_MAX_LONG_SIDE / maxSide;
                        displaySizeX *= ratio;
                        displaySizeY *= ratio;
                    }
                }
                sprite.scale.set(displaySizeX, displaySizeY, 1);
            }
        } else {
            const imgTexture = new THREE.TextureLoader().load(imgPath, (texture) => {
                if (texture.image && texture.image.width && texture.image.height) {
                    const imageAspect = texture.image.width / texture.image.height;
                    let displaySizeX = node.size_x;
                    let displaySizeY = node.size_x / imageAspect;
                    
                    if (node.type === "issue") {
                        const maxSide = Math.max(displaySizeX, displaySizeY);
                        if (maxSide > 0) {
                            const ratio = NODE_CONSTANTS.ISSUE_MAX_LONG_SIDE / maxSide;
                            displaySizeX *= ratio;
                            displaySizeY *= ratio;
                        }
                    }
                    sprite.scale.set(displaySizeX, displaySizeY, 1);
                }
            });
            imgTexture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.SpriteMaterial({ map: imgTexture });
            sprite = new THREE.Sprite(material);
            
            textureCache.current.set(imgPath, { texture: imgTexture, material });
        }
        const aspectRatio = node.size_x / node.size_y;
        
        let initSizeX = node.size_x;
        let initSizeY = node.size_x / aspectRatio;
        
        if (node.type === "issue") {
            const maxSide = Math.max(initSizeX, initSizeY);
            if (maxSide > 0) {
                const ratio = NODE_CONSTANTS.ISSUE_MAX_LONG_SIDE / maxSide;
                initSizeX *= ratio;
                initSizeY *= ratio;
            }
        }
        
        sprite.scale.set(initSizeX, initSizeY, 1);
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

    const snapInDistance = 45; // Define snapInDistance with an appropriate value
    const snapOutDistance = 80; // Define snapOutDistance with an appropriate value

    const hasParentChildPath = (startNodeId: any, targetNodeId: any, links: any[]): boolean => {
        const visited = new Set<string>();
        const queue = [String(startNodeId)];
        visited.add(String(startNodeId));

        while (queue.length > 0) {
            const curr = queue.shift()!;
            if (curr === String(targetNodeId)) {
                return true;
            }

            for (const link of links) {
                if (link.type === 'friend') {
                    continue;
                }

                const sId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
                const tId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;

                if (String(sId) === curr) {
                    const nextId = String(tId);
                    if (!visited.has(nextId)) {
                        visited.add(nextId);
                        queue.push(nextId);
                    }
                }
            }
        }
        return false;
    };

    const getAncestors = (nodeId: any, links: any[]): Set<string> => {
        const ancestors = new Set<string>();
        const queue = [String(nodeId)];
        const visited = new Set<string>();
        visited.add(String(nodeId));

        while (queue.length > 0) {
            const curr = queue.shift()!;
            for (const link of links) {
                if (link.type === 'friend') {
                    continue;
                }
                const sId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
                const tId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;

                if (String(tId) === curr) {
                    const parentId = String(sId);
                    if (!visited.has(parentId)) {
                        visited.add(parentId);
                        ancestors.add(parentId);
                        queue.push(parentId);
                    }
                }
            }
        }
        return ancestors;
    };

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

        // 循環親子関係のチェック：targetからsourceへの親子パスがあれば、循環を避けるために友達リンクにする
        const isCyclic = hasParentChildPath(target.id, source.id, graphData.links);
        // 親ノードは1つのみのルール：target(子)が既に別の親ノードを持つかチェック
        const alreadyHasParent = graphData.links.some(link => {
            if (link.type === 'friend') return false;
            const tId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;
            return String(tId) === String(target.id);
        });

        let linkType: string;
        if (target.type === 'issue') {
            linkType = 'friend';
        } else if (isCyclic) {
            linkType = 'friend';
        } else if (alreadyHasParent) {
            // すでに親を持つ場合、共通の祖先をチェックする
            const targetAncestors = getAncestors(target.id, graphData.links);
            const sourceAncestors = getAncestors(source.id, graphData.links);
            const sIdStr = String(source.id);

            let hasCommon = false;
            if (targetAncestors.has(sIdStr)) {
                hasCommon = true;
            } else {
                for (const ancestor of sourceAncestors) {
                    if (targetAncestors.has(ancestor)) {
                        hasCommon = true;
                        break;
                    }
                }
            }
            // 共通の祖先を持つ場合は friend、持たない（異なる木である）場合は parent-child
            linkType = hasCommon ? 'friend' : 'parent-child';
        } else {
            linkType = 'parent-child';
        }

        const newLink = { 
            index: linkId, 
            source: source, 
            target: target, 
            isNew: true,
            type: linkType 
        };
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

    // 削除：副作用でのターゲット直接変更を廃止

    useForceGraphSettings(fgRef);

    // 選択状態が変わった際にHTMLノード（CSS3D）の発光エフェクトを動的に更新する
    useEffect(() => {
        const updateFilters = () => {
            htmlNodeCache.current.forEach((cache, nodeId) => {
                if (cache && cache.div) {
                    if (selectedNode && String(nodeId) === String(selectedNode.id)) {
                        // 単一選択: 白色の強い光彩
                        cache.div.style.filter = 'drop-shadow(0 0 20px rgba(255, 255, 255, 1)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.8))';
                    } else if (selectedNodeList.some(n => String(n.id) === String(nodeId))) {
                        // 複数選択: 白色の強い光彩 (単一と同じく白にする)
                        cache.div.style.filter = 'drop-shadow(0 0 20px rgba(255, 255, 255, 1)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.8))';
                    } else {
                        // 非選択: 発光なし
                        cache.div.style.filter = 'none';
                    }
                }
            });
            
            // 3Dオブジェクト（WebGL）の見た目も更新させるため、ForceGraphの再描画を促す
            if (fgRef.current) {
                fgRef.current.refresh();
            }
        };

        updateFilters();

        // グラフ初期化時や新規ノード生成時、CSS3DRendererがDOMへノードを挿入するまでのわずかな遅延をカバーするため、遅れて再実行
        const timer = setTimeout(updateFilters, 150);
        return () => clearTimeout(timer);
    }, [selectedNode, selectedNodeList]);

    useEffect(() => {
        if (fgRef.current) {
            fgRef.current.refresh();
        }
    }, [selectedLink]);

    const getNodeColor = useCallback((nodeOrId: any): string => {
        let node = nodeOrId;
        if (typeof nodeOrId === 'string' || typeof nodeOrId === 'number') {
            node = graphData.nodes.find((n: any) => String(n.id) === String(nodeOrId));
        } else if (nodeOrId && nodeOrId.id !== undefined) {
            node = graphData.nodes.find((n: any) => String(n.id) === String(nodeOrId.id)) || nodeOrId;
        }
        if (!node) return '#ffffff';

        if (node.id < 0) return '#ffffff';

        const type = node.type || 'normal';
        if (type === 'file') return '#52c41a';
        if (type === 'folder') return '#faad14';
        if (type === 'issue') return '#4c9ac0';
        if (type === 'task') return '#4c9ac0';
        if (type === 'link') return '#4c9ac0';

        const style_id = node.style_id || 1;
        const bgIdx = typeof node.node_bg_color === 'number' ? Math.max(0, Math.min(7, node.node_bg_color)) : 0;
        
        if (bgIdx === 7) {
            return node.node_custom_bg_color || '#ddeeff';
        }

        const BG_COLORS = [
          '#ddeeff', // 青系（デフォルト）
          '#ddffee', // 緑系
          '#fffadd', // 黄系
          '#ffeedd', // 橙系
          '#ffddee', // ピンク系
          '#eeddff', // 紫系
          '#f0f0f0', // グレー系
        ];
        const EMPHASIS_BG_COLORS = [
          '#2255aa', // 青系（デフォルト）
          '#226644', // 緑系
          '#886600', // 黄系
          '#aa4400', // 橙系
          '#993366', // ピンク系
          '#553399', // 紫系
          '#444444', // グレー系
        ];

        if (style_id === 4) {
            return EMPHASIS_BG_COLORS[bgIdx] || EMPHASIS_BG_COLORS[0];
        } else {
            return BG_COLORS[bgIdx] || BG_COLORS[0];
        }
    }, [graphData.nodes]);

    const nodeColorMap = useMemo(() => {
        const map = new Map<string, string>();
        graphData.nodes.forEach((node: any) => {
            map.set(String(node.id), getNodeColor(node));
        });
        return map;
    }, [graphData.nodes, getNodeColor]);

    const handleNodeThreeObject = useCallback((node: any) => {
        const groupOrSprite = nodeThreeObjectImageTexture(node);
        
        // 3Dオブジェクト（古い形式のスプライトなど）
        if (groupOrSprite instanceof THREE.Sprite) {
            const material = groupOrSprite.material as THREE.SpriteMaterial;
            if (selectedNode && String(node.id) === String(selectedNode.id)) {
                material.color = new THREE.Color(0xffffff);
                material.opacity = (node.disabled) ? 0.1 : 1;
            } else if (selectedNodeList.some(n => String(n.id) === String(node.id))) {
                material.color = new THREE.Color(0x4169e1);
                material.opacity = (node.disabled) ? 0.1 : 1;
            } else {
                material.color = new THREE.Color(0xe0e0e0);
                material.opacity = (node.disabled) ? 0.1: (node.isNew) ? 0.3 : 1;
            }
        }
        
        // HTMLノードの光彩（drop-shadow）制御
        const cache = htmlNodeCache.current.get(node.id);
        if (cache && cache.div) {
            if ((selectedNode && String(node.id) === String(selectedNode.id)) || selectedNodeList.some(n => String(n.id) === String(node.id))) {
                // 選択時（単一・複数）: 白色の強い光彩で2倍の幅に
                cache.div.style.filter = 'drop-shadow(0 0 20px rgba(255, 255, 255, 1)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.8))';
            } else {
                // 非選択: 発光なし
                cache.div.style.filter = 'none';
            }
        }
        
        // 3Dモデル（glbファイル等）の選択発光制御
        if (groupOrSprite instanceof THREE.Group && node.type === "3dobject") {
            groupOrSprite.traverse((child: any) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((material: any, index: number) => {
                        if (material && 'emissive' in material) {
                            const originalKey = `originalEmissive_${index}`;
                            if (!child.userData[originalKey]) {
                                child.userData[originalKey] = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                            }
                            if ((selectedNode && String(node.id) === String(selectedNode.id)) || selectedNodeList.some(n => String(n.id) === String(node.id))) {
                                // 選択時（単一・複数）: 白っぽく光らせる
                                material.emissive = new THREE.Color(0x555555);
                            } else {
                                material.emissive = child.userData[originalKey];
                            }
                        }
                    });
                }
            });
        }

        return groupOrSprite;
    }, [nodeThreeObjectImageTexture, selectedNode, selectedNodeList]);

    return (
        <div style={{
            position: "relative", 
            width: "100%", 
            height: "100%",
            backgroundColor: 
                graphData.globalBackground === 'sky' ? '#87CEEB' : 
                graphData.globalBackground === 'snow' ? '#e0f7fa' : 
                graphData.globalBackground === 'sunset' ? '#ff9e5e' : 
                'black'
        }}>
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
            <div 
                style={{
                    position: "absolute", 
                    top: 0, 
                    left: 0, 
                    width: "100%", 
                    height: "100%", 
                    zIndex: 1 
                }}
            >
                <ForceGraph3D
                width={windowDimensions.width}
                height={windowDimensions.height}
                ref={fgRef}
                extraRenderers={extraRenderers}
                graphData={{'nodes' : graphData.nodes, 'links' : graphData.links}}
                nodeThreeObject={handleNodeThreeObject}
                enableNavigationControls={true}
                showNavInfo={false}
                backgroundColor={backgroundColor}
                nodeId="id"
                //linkDirectionalArrowLength={6}
                //linkDirectionalArrowRelPos={1}
                nodeLabel={label_key}
                //nodeAutoColorBy="group"
                
                linkThreeObjectExtend={false}
                linkThreeObject={link => {
                    let link_name = link.name;
                    if (link_name === "") {
                        link_name = ``;
                    }
                    const sprite = new SpriteText(`${link_name}`);
                    sprite.textHeight = 10.5;
                    sprite.backgroundColor = null as any;
                    sprite.strokeWidth = 1.5;
                    sprite.strokeColor = '#000000';

                    const group = new THREE.Group();

                    const isFriend = link.type === 'friend';
                    const material = isFriend
                        ? new THREE.LineDashedMaterial({
                            vertexColors: true,
                            transparent: true,
                            opacity: 0.8,
                            dashSize: 3,
                            gapSize: 3
                        })
                        : new THREE.LineBasicMaterial({
                            vertexColors: true,
                            transparent: true,
                            opacity: 0.8
                    });

                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
                    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));

                    const line = new THREE.Line(geometry, material);
                    
                    group.add(line);
                    group.add(sprite);

                    // 当たり判定を太くするための透明なシリンダー（半径4, 分割数6の六角柱）を追加
                    const hitGeometry = new THREE.CylinderGeometry(4, 4, 1, 6);
                    hitGeometry.rotateX(Math.PI / 2); // デフォルトのY軸方向からZ軸方向に倒す
                    const hitMaterial = new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0.0, // 完全に透明にして描画されないようにする
                        depthWrite: false
                    });
                    const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
                    hitMesh.name = "hitbox";
                    group.add(hitMesh);

                    return group;
                }}
                linkPositionUpdate={(group: any, { start, end }: any, link: any) => {
                    const line = group.children[0] as THREE.Line;
                    const sprite = group.children[1] as SpriteText;
                    const hitMesh = group.children[2] as THREE.Mesh;

                    const isSourceDisabled = (link.source && typeof link.source === 'object') ? !!link.source.disabled : false;
                    const isTargetDisabled = (link.target && typeof link.target === 'object') ? !!link.target.disabled : false;
                    const isAnyDisabled = isSourceDisabled || isTargetDisabled;

                    const isSelected = selectedLink && (
                        link === selectedLink || 
                        (selectedLink.index !== undefined && link.index !== undefined && selectedLink.index === link.index)
                    );

                    const bgType = graphData.globalBackground || 'default';

                    // 1. Resolve dynamic colors (Zero allocation & O(1) Lookup)
                    const c1 = scratchColor1;
                    const c2 = scratchColor2;
                    c1.set('#ffffff');
                    c2.set('#ffffff');
                    
                    if (isSelected) {
                        c1.set('#ffffff');
                        c2.set('#ffffff');
                    } else if (link === interimLink) {
                        c1.set('#f693b1');
                        c2.set('#f693b1');
                    } else if (link.type === 'friend') {
                        c1.set('#808080');
                        c2.set('#808080');
                    } else {
                        const sourceId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
                        const targetId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;
                        c1.set(nodeColorMap.get(String(sourceId)) || '#ffffff');
                        c2.set(nodeColorMap.get(String(targetId)) || '#ffffff');
                    }

                    // 2. Update geometry attributes and material dynamically
                    if (line && line.geometry) {
                        const pos = line.geometry.attributes.position;
                        if (pos) {
                            pos.array[0] = start.x; pos.array[1] = start.y; pos.array[2] = start.z;
                            pos.array[3] = end.x;   pos.array[4] = end.y;   pos.array[5] = end.z;
                            pos.needsUpdate = true;
                        }

                        // Swap material dynamically if type changes
                        const isFriend = link.type === 'friend';
                        if (isFriend && !(line.material instanceof THREE.LineDashedMaterial)) {
                            line.material = new THREE.LineDashedMaterial({
                                vertexColors: true,
                                transparent: true,
                                opacity: 0.8,
                                dashSize: 3,
                                gapSize: 3
                            });
                        } else if (!isFriend && (line.material instanceof THREE.LineDashedMaterial)) {
                            line.material = new THREE.LineBasicMaterial({
                                vertexColors: true,
                                transparent: true,
                                opacity: 0.8
                            });
                        }

                        if (isFriend) {
                            line.computeLineDistances();
                        }

                        const colorAttr = line.geometry.attributes.color;
                        if (colorAttr) {
                            const r1 = c1.r, g1 = c1.g, b1 = c1.b;
                            const r2 = c2.r, g2 = c2.g, b2 = c2.b;
                            // Only upload to GPU if colors have actually changed
                            if (
                                colorAttr.array[0] !== r1 || colorAttr.array[1] !== g1 || colorAttr.array[2] !== b1 ||
                                colorAttr.array[3] !== r2 || colorAttr.array[4] !== g2 || colorAttr.array[5] !== b2
                            ) {
                                colorAttr.array[0] = r1; colorAttr.array[1] = g1; colorAttr.array[2] = b1;
                                colorAttr.array[3] = r2; colorAttr.array[4] = g2; colorAttr.array[5] = b2;
                                colorAttr.needsUpdate = true;
                            }
                        }
                        line.geometry.computeBoundingSphere();

                        // 3. Update material opacity dynamically
                        const material = line.material as THREE.LineBasicMaterial;
                        if (material) {
                            let finalOpacity = isAnyDisabled ? 0.1 : 0.5;
                            if (material.opacity !== (isSelected ? 1.0 : finalOpacity)) {
                                material.opacity = isSelected ? 1.0 : finalOpacity;
                            }
                        }
                    }

                    // 4. Update sprite label styling and position dynamically (Only rebuild texture on change)
                    if (sprite) {
                        const targetColor = '#ffffff';
                        const targetHeight = isSelected ? 13.5 : 10.5;

                        if (sprite.color !== targetColor) {
                            sprite.color = targetColor;
                        }
                        if (sprite.textHeight !== targetHeight) {
                            sprite.textHeight = targetHeight;
                        }

                        const targetOpacity = isAnyDisabled ? 0.1 : 1.0;
                        const targetTransparent = true;
                        if (sprite.material.opacity !== targetOpacity) {
                            sprite.material.opacity = targetOpacity;
                        }
                        if (sprite.material.transparent !== targetTransparent) {
                            sprite.material.transparent = targetTransparent;
                        }

                        const middlePos = {
                            x: start.x + (end.x - start.x) / 2,
                            y: start.y + (end.y - start.y) / 2,
                            z: start.z + (end.z - start.z) / 2
                        };
                        // Only assign position if it has changed to avoid unnecessary triggering
                        if (
                            sprite.position.x !== middlePos.x ||
                            sprite.position.y !== middlePos.y ||
                            sprite.position.z !== middlePos.z
                        ) {
                            Object.assign(sprite.position, middlePos);
                        }
                    }

                    // 5. Update transparent click hitbox cylinder position and orientation
                    if (hitMesh) {
                        const midX = start.x + (end.x - start.x) / 2;
                        const midY = start.y + (end.y - start.y) / 2;
                        const midZ = start.z + (end.z - start.z) / 2;
                        
                        if (
                            hitMesh.position.x !== midX ||
                            hitMesh.position.y !== midY ||
                            hitMesh.position.z !== midZ
                        ) {
                            hitMesh.position.set(midX, midY, midZ);
                        }

                        const dx = end.x - start.x;
                        const dy = end.y - start.y;
                        const dz = end.z - start.z;
                        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        
                        const dir = new THREE.Vector3(dx, dy, dz).normalize();
                        const alignVector = new THREE.Vector3(0, 0, 1);
                        const quaternion = new THREE.Quaternion().setFromUnitVectors(alignVector, dir);
                        
                        hitMesh.quaternion.copy(quaternion);
                        hitMesh.scale.set(1, 1, length);
                    }

                    return true;
                }}
                linkDirectionalParticles={link => {
                    if (!enableParticlesRef.current) return 0;
                    if (link.type === 'friend') return 0;
                    const selNode = selectedNodeRef.current;
                    if (!selNode) return 0;
                    const sourceId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
                    const targetId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;
                    
                    const isConnected = String(sourceId) === String(selNode.id) || String(targetId) === String(selNode.id);
                    return isConnected ? 2 : 0;
                }}
                linkDirectionalParticleWidth={6}
                linkDirectionalParticleSpeed={0.01}
                linkDirectionalParticleColor={() => {
                    const bgType = graphData.globalBackground || 'default';
                    return bgType === 'sky' ? '#333333' : '#ffffff';
                }}
                //linkLineDash={(link:any) => link === interimLink ? [2, 2] : []}
                d3VelocityDecay={0.35}
                onNodeClick={handleClick}

                onNodeRightClick={handleRightClick}
                onLinkRightClick={handleLinkRightClick}
                onLinkClick={handleLinkClick}
                onNodeDrag={handleNodeDrag}
                onNodeHover={handleHover}
                d3AlphaDecay={0.02}
                //dagMode={"radialin"}
                //nodeThreeObjectExtend={true}
                onBackgroundRightClick={handleBackgroundClick}
                onBackgroundClick={(event) => {
                    // 起動直後やデータロード直後の誤作動（初期化イベント等による背景クリック）による選択解除を防ぐため、500ms以内のイベントは無視する
                    if (Date.now() - mountTime.current < 500) {
                        return;
                    }
                    // 背景左クリック時にすべての選択を解除（Escキーと同じ挙動）
                    setSelectedNode(null);
                    setSelectedNodeList([]);
                    setSelectedLink(null);
                }}
                onNodeDragEnd={(node:any) => {
                    if (layoutMode === 'force') {
                        const shouldPin = isCtrlDown.current;
                        
                        // ForceON時のドラッグ終了処理
                        graphData.nodes.forEach((n: any) => {
                            if (n._isActiveDrag) {
                                if (shouldPin) {
                                    // Ctrlキーが押されている場合：位置固定状態をトグル
                                    if (n._wasPinnedBeforeDrag) {
                                        // 元々固定されていた場合は固定を解除（アンピン）
                                        delete n.fx;
                                        delete n.fy;
                                        delete n.fz;
                                    } else {
                                        // 元々固定されていなかった場合は固定（ピン留め）
                                        n.fx = n.x;
                                        n.fy = n.y;
                                        n.fz = n.z;
                                    }
                                } else {
                                    // 通常（Ctrlなし）：固定状態を維持、または固定しない
                                    if (n._wasPinnedBeforeDrag) {
                                        // 元々固定されていた場合は新しい位置で固定を維持
                                        n.fx = n.x;
                                        n.fy = n.y;
                                        n.fz = n.z;
                                    } else {
                                        // 元々固定されていなかった場合は固定しない（自由移動）
                                        delete n.fx;
                                        delete n.fy;
                                        delete n.fz;
                                    }
                                }
                            } else {
                                // 無関係なノード：一時的な固定から復元
                                if (n._wasPinnedBeforeDrag) {
                                    n.fx = n._originalFx;
                                    n.fy = n._originalFy;
                                    n.fz = n._originalFz;
                                } else {
                                    delete n.fx;
                                    delete n.fy;
                                    delete n.fz;
                                }
                            }
                            // 一時フラグのクリーンアップ
                            delete n._isActiveDrag;
                            delete n._originalFx;
                            delete n._originalFy;
                            delete n._originalFz;
                            delete n._wasPinnedBeforeDrag;
                        });
                        
                        // 物理シミュレーションを再起動して反映
                        fgRef.current?.d3ReheatSimulation();
                    } else {
                        // ForceOFF時は単純にドラッグされたノードを固定
                        node.fx = node.x;
                        node.fy = node.y;
                        node.fz = node.z;
                        selectedNodeList.forEach(n => {
                            n.fx = n.x;
                            n.fy = n.y;
                            n.fz = n.z;
                        });
                    }

                    // px, py, pzを削除 
                    delete node.px;
                    delete node.py;
                    delete node.pz;

                    // dx, dy, dzを削除
                    delete node.dx;
                    delete node.dy;
                    delete node.dz;


                    // ドラッグによる選択は行わない（クリックのみで選択状態にする仕様）

                    if (interimLink) {
                        addToHistory('add_link', interimLink);
                        setInterimLinkState(null);
                    }

                    lastDragEndTime.current = Date.now();
                    isDraggingNode.current = false;
                    
                    if (fgRef.current) {
                        fgRef.current.refresh();
                    }
                }}
                />
            </div>
            
            {/* R3Fのレイヤー */}
            {graphData.globalBackground !== 'none' && (
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
                        style={{ 
                            background: 
                                graphData.globalBackground === 'sky' ? '#87CEEB' : 
                                graphData.globalBackground === 'snow' ? '#e0f7fa' :
                                graphData.globalBackground === 'sunset' ? '#ff9e5e' :
                                'black' 
                        }}
                        camera={{ position: [0, 0, 40], near: 0.1, far: 1000, fov: 100 }}
                    >
                        {graphData.globalBackground === 'sky' ? <SkyScene /> : 
                         graphData.globalBackground === 'snow' ? <SnowScene /> :
                         graphData.globalBackground === 'sunset' ? <SunsetScene /> :
                         <SpaceScene />}
                        {/* <OrbitControls enableZoom={true} enablePan={false} enableDamping dampingFactor={0.2} autoRotate={true} rotateSpeed={-0.001} />
                        <Portals />
                        <ambientLight intensity={0.5} />
                        <pointLight position={[10, 10, 10]} /> */}
                    </Canvas>
                </div>
            )}
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
