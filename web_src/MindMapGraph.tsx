import React from 'react'
import ReactDOM from 'react-dom/client'
import _ from 'lodash'
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as d3force from 'd3-force'
import * as THREE from 'three'
import SVGNodeData from './SvgNodeData'
import satori from 'satori'
import { html } from "satori-html";

import {CSS2DObject, CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';


import { useState, forwardRef, useImperativeHandle, useMemo} from 'react'


import { Canvas } from '@react-three/fiber'
import { Html, Loader } from '@react-three/drei'
import { TextureLoader, SpriteMaterial, Sprite } from 'three'
import { OrbitControls } from '@react-three/drei'
import { render, useFrame, useThree, useGraph } from '@react-three/fiber'
import ThreeForceGraph from 'three-forcegraph'

import './index.css'


const { useRef, useCallback, useEffect } = React;

const MindMapGraph = forwardRef((props:any, ref:any) => {
    const fgRef = useRef<any>();

    // 選択されたノードを追跡するstate
    const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
    // 複数選択されたノードを追跡するstate
    const [selectedNodeList, setSelectedNodeList] = useState<NodeData[]>([]);


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
    }

    interface GraphData {
        nodes: NodeData[];
        links: any[];
    }

    const [graphData, setGraphData] = useState<GraphData>({nodes:[], links:[]});
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
            //setObj3D((oldObj3D) => {
            //    const tmp_ndoes = { ...oldObj3D }
            //    delete tmp_ndoes[node.id];
            //    return tmp_ndoes;
            //});
            console.log('refreshNode', node);
            //nodeにisNewがある場合、キーを削除する
            if (node && _.has(node, 'isNew')) {
                delete node.isNew;
                graphData.links.forEach(link => {
                    if (link.source.id === node.id || link.target.id === node.id) {
                        refreshLink(link);
                    }
                });
            }
            // 更新日時を設定
            node.updatedAt = new Date().toISOString();
            fgRef.current.refresh();
        },
        deleteNode: (node: any) => {
            console.log('deleteNode', node);
            deleteNode(node.id);
            fgRef.current.refresh();
        },
        deleteLink: (link: any) => {
            console.log('deleteLink', link);
            setGraphData(prevData => ({
                ...prevData,
                links: prevData.links.filter(l => l.index !== link.index)
            }));
            fgRef.current.refresh();
        },
        refreshLink: (link: any) => {
            refreshLink(link);
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
        addLink: (source: any, target: any) => {
            const existingLink = graphData.links.find((link: any) => link.source.id === source.id && link.target.id === target.id);
            if (!existingLink) {
                const newIndex = graphData.links.length > 0 ? Math.max(...graphData.links.map((l: any) => l.index)) + 1 : 1;
                const newLink = { index: newIndex, source: source, target: target, isNew: true };
                graphData.links.push(newLink);
                refreshLink(newLink)
                fgRef.current.refresh();
            }
        },
        // 新規ノード追加用のインターフェース
        addNode: () => {
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
        }
    }));
    // node.idと一致するnodeをgraphDataから削除する関数
    const deleteNode = (nodeId: number) => {
        setGraphData(prevData => ({
        nodes: prevData.nodes.filter(node => node.id !== nodeId),
        links: prevData.links.filter(link => link.source.id !== nodeId && link.target.id !== nodeId)
        }));
    };
    const refreshLink = (link: any) => {
        console.log('refreshLink', link);
        //linkにisNewがある場合、キーを削除する
        if (link && _.has(link, 'isNew')) {
            delete link.isNew;
            link.name = `${link.source.name || ''} to ${link.target.name || ''}`;
        }
    };
    const handleClick = useCallback((node: NodeData | null, event: MouseEvent) => {
        // Ctrlキーが押されている場合は複数選択モード
        if (event && (event.ctrlKey ||event.shiftKey)  && node) {
            // ノードが通常選択されている場合無視する
            if (selectedNode && node.id == selectedNode.id) {
                return;
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
            console.log('Node clicked:', node);

        }
        // 選択されたノードを更新（これは常に行う）
        setSelectedNode(node);
    }, [fgRef, selectedNode,selectedNodeList, graphData]);
    
    const handleRightClick = (node: NodeData | null, event: MouseEvent) => {
        setSelectedNodeList([]);
        props.onNodeEdit(node)
        //deleteNode(node.id);
    };

    const handleLinkRightClick = (link: any) => {
        props.onLinkEdit(link)
    };
    const handleLinkClick = (link: any) => {
        console.log('handleLinkClick', link);
    };
    const handleHover = (node: NodeData | null, prevNode: NodeData | null) => {
        isHovering.current = !!node;
    };

    const handleNodeDrag = (dragNode:any) => {
        // Ctrlキーが押されていない場合は何もしない
        if (!(window.event as KeyboardEvent)?.ctrlKey) {
            return;
        }

        isDraggingNode.current = true;
    
        //onNodeDragが実行される回数をカウントしておき、100回に1回しか実行しない
        dragCounter.current += 1;
        if (dragCounter.current < 100) return;

        dragCounter.current = 0;
        for (let node of graphData.nodes) {
          console.log("onNodeDrag loop")
          if (dragNode.id === node.id) {
            continue;
          }
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
        //クリック位置からnodeのx,y,z_layerを探索する処理
        //let distance = camera.position.distanceTo(new THREE.Vector3(0, 0, z_layer));
        const distance = 700;
        let coords = fgRef.current.screen2GraphCoords(event.layerX, event.layerY, distance );
        /*
        let iterations = 0;
        while (iterations < 10) {
            const diff = coords.z - z_layer;
            if (Math.abs(diff) <= 5) {
            break;
            }
            // Increase adjustment magnitude for faster convergence.
            distance += diff * 0.5;
            coords = fgRef.current.screen2GraphCoords(event.layerX, event.layerY, distance);
            iterations++;
        }
        */

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
            fz: /*z_layer*/coords.z, 
            name: "",
            isNew: true,
            createdAt: now,
            updatedAt: now
        };
        setGraphData(prevData => ({
            ...prevData,
            nodes: [...prevData.nodes, new_node]
        }));
        setSelectedNodeList([]);
        props.onNodeEdit(new_node);
    };
       
    const nodeThreeObject = (node: any) => {
        const nodeEl = document.createElement('div');
        nodeEl.textContent = node[label_key];
        nodeEl.className = 'node-label2';
        return new CSS2DObject(nodeEl);
    };

    interface Obj3DCache {
        [key: string]: THREE.Group;
    }

    const notoSansJP = fetch('/assets/ZenOldMincho-Regular.ttf').then((res) =>
        res.arrayBuffer()
    )

    const [Obj3Ds, setObj3D] = useState<Obj3DCache>({});
    const nodeThreeObjectImage = (node: {id:number,name:string}) => {
        const conv_svg = async () => {
            const styles = [
                "margin: 2em 0; font-size: 8px; color: #6091d3; background: #FFF; border: solid 1px #6091d3; border-radius: 7px;",
                "margin: 2em 0; font-size: 8px; color: #232323; background: #fff8e8; border-left: solid 3px #ffc06e;",
                "margin: 2em 0; font-size: 8px; color: #00BCD4; background: #e4fcff; border-top: solid 3px #1dc1d6;",
                "margin: 2em 0; font-size: 8px; color: #2c2c2f; background: #cde4ff; border-top: solid 3px #5989cf; border-bottom: solid 3px #5989cf;",
                "margin: 2em 0; font-size: 8px; color: #565656; background: #ffeaea; border: dashed 2px #ffc3c3; border-radius: 8px;",
                "margin: 2em 0; font-size: 8px; background: #f4f4f4; border-left: solid 3px #5bb7ae; "
            ];

            const markup:any = html`<div style="
                                    min-height: 30px;
                                    min-width: 100px;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    ${styles[node.id%styles.length]}
                                    transform: scale(1,-1);">
                                    ${node.name}
                                </div>`;
            const svg = await satori(markup, {
                width: 0,
                height: 0,
                fonts: [
                    {
                        name: 'Noto Sans JP',
                        data: await notoSansJP,
                    },
                ],
            });
        
            const obj3d = SVGNodeData(svg);
            obj3d.scale.set(1,1,1)
            obj3d.position.set(-50, -30, 0);

            const setObj = (key:string, value:THREE.Group) => {
                setObj3D((oldObj3D) => {
                    return { ...oldObj3D, [key]: value };
                });
            };

            setObj(node.id.toString(), obj3d);
        };

        if ((node.id.toString() in Obj3Ds) === false) {
            conv_svg();
        }
        
        return Obj3Ds[node.id.toString()];
    }
      
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

    const nodeThreeObjectImageTexture = (node: any) => {
        if (node.id < 0) {
            return nodeThreeObjectCustomMesh(node);
        }
        const imgTexture = new THREE.TextureLoader().load(`./assets/${node['img']}`);
        imgTexture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({ map: imgTexture });
        const sprite = new THREE.Sprite(material);
        const aspectRatio = node.size_x / node.size_y;
        sprite.scale.set(node.size_x, node.size_x / aspectRatio, 1);

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(50, 20, 1),
            new THREE.MeshLambertMaterial({
                color: 'rgba(250,250,250,0.9)',
                transparent: true,
                opacity: 0.75
            })
        );

        return sprite;
    };

    const [interimLink, setInterimLinkState] = useState<any>(null);

    const distance = (node1: any, node2: any) => {
        return Math.sqrt(
            Math.pow(node1.x - node2.x, 2) +
            Math.pow(node1.y - node2.y, 2) +
            Math.pow(node1.z - node2.z, 2)
        );
    };

    const snapInDistance = 220; // Define snapInDistance with an appropriate value
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


    useEffect(() => {
        if (fgRef.current) {
            // ノード間の反発力を設定
            fgRef.current.d3Force('charge').strength(-50);
        
            // リンクの距離を設定
            fgRef.current.d3Force('link').distance(200);

            const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.2, 0.9);
            fgRef.current.postProcessingComposer().addPass(bloomPass);
        }
    }, [fgRef]);

    return (
        <>
            <ForceGraph3D
                ref={fgRef}
                graphData={{'nodes' : graphData.nodes, 'links' : graphData.links}}
                nodeThreeObject={(node) => {
                    const sprite = nodeThreeObjectImageTexture(node);
                    if (sprite instanceof THREE.Sprite) {
                        const material = sprite.material as THREE.SpriteMaterial;
                        if (selectedNode && node.id === selectedNode.id) {
                            material.color = new THREE.Color(0xffffff);
                            material.opacity = (node.disabled) ? 0.05 : 1;
                        } else if (selectedNodeList.some(n => n.id === node.id)) {
                            console.log('selectedNodeList:', selectedNodeList);
                            material.color = new THREE.Color(0x4169e1);
                            material.opacity = (node.disabled) ? 0.05 : 1;
                        } else {
                            material.color = new THREE.Color(0xe0e0e0);
                            material.opacity = (node.disabled) ? 0.05 : 1;
                        }
                    }
                    return sprite;
                }}
                enableNavigationControls={true}
                backgroundColor="#010101"
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
                    const sprite = new SpriteText(`${link.name}`);
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
                //nodeThreeObjectExtend={true}
                onBackgroundClick={handleBackgroundClick}
                onNodeDragEnd={(node:any) => {
                    node.fx = node.x;
                    node.fy = node.y;
                    isDraggingNode.current = false;  
                    setInterimLinkState(null);
                }}
            />
        </>
    );
});

export default MindMapGraph;
