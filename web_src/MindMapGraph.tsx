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


import { useState, forwardRef, useImperativeHandle} from 'react'


import { Canvas } from '@react-three/fiber'
import { Html, Loader } from '@react-three/drei'
import { TextureLoader, SpriteMaterial, Sprite } from 'three'
import { OrbitControls } from '@react-three/drei'
import { render, useFrame, useThree, useGraph } from '@react-three/fiber'
import ThreeForceGraph from 'three-forcegraph'

import './index.css'


const { useRef, useCallback, useEffect } = React;

const MindMapGraph = forwardRef((props:any, ref:any) => {

    interface NodeData {
        id: number;
        img: string;
        group?: number;
        x?: number;
        y?: number;
        z?: number;
        fx?: number;
        fy?: number;
        fz?: number;
        isNew?: boolean;
    }

    interface GraphData {
        nodes: NodeData[];
        links: any[];
    }

    const [graphData, setGraphData] = useState<GraphData>({nodes:[], links:[]});
    const setRotateVecFunc = () => {
        return new THREE.Vector3(0,0,3000);
    };   

    const fgRef = useRef<any>();
    const isDraggingNode = useRef<boolean>(false);
    const dragCounter = useRef<number>(0);
    const isHovering = useRef<boolean>(false);
    const label_key = "name";
    const z_layer = -300
    const [rotateVec, setRotateVec] = useState<THREE.Vector3>(setRotateVecFunc);
    const [lookAtTarget, setLookAtTarget] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, z_layer));
    useImperativeHandle(ref, () => ({
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
            }
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
            console.log('refreshLink', link);
            setGraphData(prevData => ({
                ...prevData,
                links: prevData.links.map(l => 
                    l.index === link.index ? link : l
                )
            }));
            fgRef.current.refresh();
        }
    }));
    // node.idと一致するnodeをgraphDataから削除する関数
    const deleteNode = (nodeId: number) => {
        setGraphData(prevData => ({
        nodes: prevData.nodes.filter(node => node.id !== nodeId),
        links: prevData.links.filter(link => link.source.id !== nodeId && link.target.id !== nodeId)
        }));
    };

    // マウス操作とデータ取得のuseEffect
    useEffect(() => {

/*
        console.log('Mouse operation useEffect initialized');
        var GraphCanvas = document.getElementsByTagName('canvas')[0];
        let isPanning = false;
        let isTranslating = false;
        let lastX = 0;
        let lastY = 0;
        const tempLookAt = new THREE.Vector3(0,0,z_layer);
        // パン機能、平行移動機能の実装
        const handleMouseDown = function(e: MouseEvent) {
            if (!isHovering.current && fgRef.current) {

                if (e.button === 0) { // 左ボタンまたは右ボタン
                    isTranslating = true;
                    lastX = e.clientX;
                    lastY = e.clientY;
                    // 移動開始時に現在のlookAtTargetを初期値として設定
                    tempLookAt.copy(lookAtTarget);
                    e.preventDefault();
                }
                else if (e.button === 2) { // 右ボタン
                    isPanning = true;
                    lastX = e.clientX;
                    lastY = e.clientY;
                    e.preventDefault();
                }
            }
        };

        const handleMouseMove = function(e: MouseEvent) {
        if ((isTranslating || isPanning) && !isDraggingNode.current && fgRef.current) {
                const camera = fgRef.current.camera();
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;
                
                // カメラの向きに基づいて移動方向を調整
                const right = new THREE.Vector3();
                const up = new THREE.Vector3();
                camera.getWorldDirection(up);
                right.crossVectors(up, camera.up);
                
                // 移動量をカメラのz軸に応じて調整
 
                let move_scale = fgRef.current.cameraPosition().z / 1000 + 1;
                const moveX = right.multiplyScalar(-deltaX * move_scale);
                const moveY = camera.up.clone().multiplyScalar(deltaY * move_scale);
                
                if (isTranslating) {
                    // カメラと注視点を同時に移動
                    camera.getWorldDirection(tempLookAt);
                    tempLookAt.add(camera.position);
                    tempLookAt.z = z_layer;
                    const newLookAt = tempLookAt.clone()
                        .add(moveX)
                        .add(moveY);
                    const newPosition = camera.position.clone()
                        .add(moveX)
                        .add(moveY);
                    
                    fgRef.current.cameraPosition(
                        newPosition,
                        newLookAt,
                        0
                    );
                    // マウス移動中は一時的な値として保持
                    tempLookAt.copy(newLookAt);
                } else {
                    // カメラのみ移動
                    const newPosition = camera.position.clone()
                        .add(moveX)
                        .add(moveY);
                    
                    fgRef.current.cameraPosition(
                        newPosition,
                        tempLookAt,
                        0
                    );
                }

                lastX = e.clientX;
                lastY = e.clientY;
            }
        };

        const handleContextMenu = function(e: MouseEvent) {
            e.preventDefault();
        };

        const handleMouseUp = function(e: MouseEvent) {
            if (!isHovering.current && fgRef.current) {

                if (e.button === 0 || e.button === 2) {
                    if (isTranslating && !tempLookAt.equals(lookAtTarget)) {
                        // 移動が完了したときにのみlookAtTargetを更新
                        setLookAtTarget(new THREE.Vector3().copy(tempLookAt));
                    }
                    isPanning = false;
                    isTranslating = false;
                }
            }
        };

        const handleMouseLeave = function() {
            isPanning = false;
            isTranslating = false;
        };

        // イベントリスナーの設定
        GraphCanvas.addEventListener('mousedown', handleMouseDown);
        GraphCanvas.addEventListener('mousemove', handleMouseMove);
        GraphCanvas.addEventListener('contextmenu', handleContextMenu);
        GraphCanvas.addEventListener('mouseup', handleMouseUp);
        GraphCanvas.addEventListener('mouseleave', handleMouseLeave);
*/
        // データ取得
        const controller = new AbortController();
        
        const fetchData = async () => {
            try {
                const response = await fetch('./datasets/output.json', {
                    signal: controller.signal
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }
                const jsonData = await response.json();

                //z軸固定
                jsonData.nodes = jsonData.nodes.map((node:any) => {
                    node.fz = z_layer;
                    node['x'] = node['x']
                    node['y'] = node['y']
                    delete node['vx']; 
                    delete node['vy']; 
                    //delete node['fx']; 
                    //delete node['fy']; 
                    delete node['__bckgDimensions']; 
                    return node;
                })
                
                setGraphData(jsonData);
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    return; // フェッチがキャンセルされた場合は何もしない
                }
                console.error('Error fetching data:', error);
            }
        };

        if (graphData.nodes.length === 0 && graphData.links.length === 0) {
            fetchData();
            console.log('Fetching data');
        }

        // クリーンアップ関数でフェッチをキャンセル
        return () => {
            controller.abort();
        };
/*
        // クリーンアップ関数
        return () => {
            console.log('Cleaning up mouse operation useEffect');
            GraphCanvas.removeEventListener('mousedown', handleMouseDown);
            GraphCanvas.removeEventListener('mousemove', handleMouseMove);
            GraphCanvas.removeEventListener('contextmenu', handleContextMenu);
            GraphCanvas.removeEventListener('mouseup', handleMouseUp);
            GraphCanvas.removeEventListener('mouseleave', handleMouseLeave);
        };
*/
    }, [graphData.nodes.length, graphData.links.length]); // データの状態に基づいて実行
/*
    // ズーム機能の実装（lookAtTargetの依存関係を持つ）
    useEffect(() => {
        console.log('Wheel useEffect called, lookAtTarget:', lookAtTarget);
        var GraphCanvas = document.getElementsByTagName('canvas')[0];

        const handleWheel = function(e: WheelEvent) {
            e.preventDefault();
            if (fgRef.current) {
                const camera = fgRef.current.camera();
                const distance = camera.position.distanceTo(lookAtTarget);
                const delta = e.deltaY;
                const newDistance = distance * (1 + delta * 0.005);
                
                // ズーム制限（最小距離: 100, 最大距離: 8000）
                if (newDistance > 100 && newDistance < 8000) {
                    const direction = camera.position.clone().sub(lookAtTarget).normalize();
                    const newPosition = lookAtTarget.clone().add(direction.multiplyScalar(newDistance));
                    
                    fgRef.current.cameraPosition(
                        newPosition,
                        lookAtTarget,
                        100  // アニメーション時間を短縮
                    );
                }
            }
        };

        // 既存のwheelイベントリスナーを削除してから新しいものを追加
        console.log('Removing old wheel event listener');
        GraphCanvas.removeEventListener('wheel', handleWheel, {passive: false} as any);
        console.log('Adding new wheel event listener');
        GraphCanvas.addEventListener('wheel', handleWheel, {passive: false} as any);

        // クリーンアップ関数
        return () => {
            console.log('Cleaning up wheel useEffect');
            GraphCanvas.removeEventListener('wheel', handleWheel, {passive: false} as any);
        };
    }, [lookAtTarget, fgRef]); // lookAtTargetとfgRefの更新時に再設定

*/
    const handleClick = useCallback((node: NodeData | null, event: MouseEvent) => {
        if (node && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
            const distance = 500;
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
    }, [fgRef]);
    
    const handleRightClick = (node: NodeData | null, event: MouseEvent) => {
        props.onNodeEdit(node)
        //deleteNode(node.id);
    };

    const handleLinkRightClick = (link: any) => {
        props.onLinkEdit(link)
    };

    const handleHover = (node: NodeData | null, prevNode: NodeData | null) => {
        isHovering.current = !!node;
    };

    const handleBackgroundClick = (event:any) => {
        let camera = fgRef.current.camera();
        //クリック位置からnodeのx,y,z_layerを探索する処理
        //let distance = camera.position.distanceTo(new THREE.Vector3(0, 0, z_layer));
        const distance = 500;
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
        let new_node = { id: nodeId, img: "new_node.png", group: groupId, style_id: 1, fx: coords.x, fy: coords.y, fz: /*z_layer*/coords.z, isNew: true };
        graphData.nodes.push(new_node);
        fgRef.current.refresh();
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
            new THREE.BoxGeometry(50, 20, 1),
            new THREE.MeshLambertMaterial({
                color: 'rgba(250,250,250,0.9)',
                transparent: true,
                opacity: 0.75
            })
        );

        const MultilineText = new SpriteText(node[label_key], 3);
        MultilineText.color = node.color;
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

    const nodeThreeObjectImageTexture = ( node:any ) => {
        const imgTexture = new THREE.TextureLoader().load(`./assets/${node['img']}`);
        imgTexture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({ map: imgTexture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(200, 60, 1);

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
        const newLink = { index: linkId, source: source, target: target, name: source.name + ' to ' + target.name };
        setGraphData(prevData => ({
            ...prevData,
            links: [...prevData.links, newLink]
        }));
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
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.001, 0.9);
        //fgRef.current.postProcessingComposer().addPass(bloomPass);
        //fgRef.current.d3Force('collision', d3force.forceCollide((node:any) => 100));
    }, [fgRef]);

    return (
        <>
            <ForceGraph3D
                ref={fgRef}
                graphData={{'nodes' : graphData.nodes, 'links' : graphData.links}}
                enableNavigationControls={true}
                backgroundColor="#202030"
                linkColor={(link) => link === interimLink ? 'rgb(246, 147, 177)' : 'rgba(255,255,255,1)'}
                nodeId="id"
                //linkDirectionalArrowLength={6}
                //linkDirectionalArrowRelPos={1}
                nodeLabel={label_key}
                //nodeAutoColorBy="group"
                linkDirectionalParticleWidth={1}
                //linkLineDash={(link:any) => link === interimLink ? [2, 2] : []}
                d3VelocityDecay={0.4}
                onNodeClick={handleClick}

                onNodeRightClick={handleRightClick}
                onLinkRightClick={handleLinkRightClick}
                onNodeDrag={(dragNode:any) => {
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

                }}
                onNodeHover={handleHover}
                d3AlphaDecay={0.02}
                nodeThreeObject={nodeThreeObjectImageTexture}
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
