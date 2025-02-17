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
}

interface GraphData {
    nodes: NodeData[];
    links: any[];
}

interface MindMapGraphProps {
    graphData: GraphData;
    onHover: (x: number, y: number) => void;
    onNodeEdit: (node: any) => void;
    onLinkEdit: (link: any) => void;
}

const MindMapGraph = forwardRef((props: MindMapGraphProps, ref: any) => {
    const fgRef = useRef<any>();
    const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
    const isDraggingNode = useRef<boolean>(false);
    const dragCounter = useRef<number>(0);
    const isHovering = useRef<boolean>(false);
    const label_key = "name";
    const z_layer = -300;
    const [rotateVec, setRotateVec] = useState<THREE.Vector3>(new THREE.Vector3(0,0,3000));
    const [lookAtTarget, setLookAtTarget] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, z_layer));

    useImperativeHandle(ref, () => ({
        getGraphData: () => {
            return props.graphData;
        },
        refreshNode: (node:any) => {
            console.log('refreshNode', node);
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
            const newLinks = props.graphData.links.filter(l => l.index !== link.index);
            props.graphData.links = newLinks;
            fgRef.current.refresh();
        },
        refreshLink: (link: any) => {
            console.log('refreshLink', link);
            const newLinks = props.graphData.links.map(l => 
                l.index === link.index ? link : l
            );
            props.graphData.links = newLinks;
            fgRef.current.refresh();
        },
        searchNodes: (searchText: string) => {
            if (!searchText) return [];
            return props.graphData.nodes.filter(node => 
                node.name && node.name.toLowerCase().includes(searchText.toLowerCase())
            );
        },
        selectNode: (node: any) => {
            handleClick(node, null as any);
        }
    }));
    // node.idと一致するnodeをgraphDataから削除する関数
    const deleteNode = (nodeId: number) => {
        props.graphData.nodes = props.graphData.nodes.filter(node => node.id !== nodeId);
        props.graphData.links = props.graphData.links.filter(link => 
            link.source.id !== nodeId && link.target.id !== nodeId
        );
    };

    const handleClick = useCallback((node: NodeData | null, event: MouseEvent) => {
        setSelectedNode(node);
        if (node && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
            const distance = 500;
            const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

            setLookAtTarget(new THREE.Vector3(node.x, node.y, node.z));

            if (fgRef.current) {
                fgRef.current.cameraPosition(
                    { x: node.x, y: node.y, z: node.z + distance },
                    { x: node.x, y: node.y, z: node.z },
                    600
                );
            }
            console.log('Node clicked:', node);
        }
    }, [fgRef]);
    
    const handleRightClick = (node: NodeData | null, event: MouseEvent) => {
        props.onNodeEdit(node);
    };

    const handleLinkRightClick = (link: any) => {
        props.onLinkEdit(link);
    };

    const handleHover = (node: NodeData | null, prevNode: NodeData | null) => {
        isHovering.current = !!node;
    };

    const handleNodeDrag = (dragNode:any) => {
        isDraggingNode.current = true;
    
        //onNodeDragが実行される回数をカウントしておき、100回に1回しか実行しない
        dragCounter.current += 1;
        if (dragCounter.current < 100) return;

        dragCounter.current = 0;
        for (let node of props.graphData.nodes) {
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
        const distance = 500;
        let coords = fgRef.current.screen2GraphCoords(event.layerX, event.layerY, distance);

        let nodeId = Math.max(...props.graphData.nodes.map((item:any) => item.id)) + 1;
        let groupId = 1
        if(props.graphData.nodes.length > 0){
            groupId = Math.max(...props.graphData.nodes.map((item:any) => item.group)) + 1
        }
        //enableNavigationControls={true}にしたとき、なぜかhandleBackgroundClickが走り、-Infinityのnodeが追加されるため暫定処置
        if (nodeId === -Infinity) {
            return;
        }
        let new_node = { id: nodeId, img: "new_node.png", group: groupId, style_id: 1, fx: coords.x, fy: coords.y, fz: coords.z, isNew: true };
        props.graphData.nodes.push(new_node);
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

    const snapInDistance = 220;
    const snapOutDistance = 250;

    const setInterimLink = (linkId: number, source: any, target: any) => {
        // 既存のリンクと同じsourceとtargetの組み合わせがあるかチェック
        const existingLink = props.graphData.links.find(link => 
            (link.source.id === source.id && link.target.id === target.id) ||
            (link.source.id === target.id && link.target.id === source.id)
        );

        // 既存のリンクがある場合は追加しない
        if (existingLink) {
            return;
        }

        if (linkId < 0){
            linkId = props.graphData.links.length > 0 ? Math.max(...props.graphData.links.map((link: any) => link.index)) + 1 : 1;
        }
        const newLink = { index: linkId, source: source, target: target, name: source.name + ' to ' + target.name };
        props.graphData.links.push(newLink);
        setInterimLinkState(newLink);
    };

    const removeLink = (link: any): number => {
        const removedIndex = link.index;
        props.graphData.links = props.graphData.links.filter(l => l.index !== removedIndex);
        return removedIndex;
    };

    useEffect(() => {
        if (fgRef.current) {
            // ノード間の反発力を設定
            fgRef.current.d3Force('charge').strength(-50);
            // リンクの距離を設定
            fgRef.current.d3Force('link').distance(200);

            const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.17, 0.2, 0.95);
            fgRef.current.postProcessingComposer().addPass(bloomPass);
        }
    }, [fgRef]);

    return (
        <>
            <ForceGraph3D
                ref={fgRef}
                graphData={props.graphData}
                nodeThreeObject={(node) => {
                    const sprite = nodeThreeObjectImageTexture(node);
                    if (sprite instanceof THREE.Sprite) {
                        const material = sprite.material as THREE.SpriteMaterial;
                        if (selectedNode && node.id === selectedNode.id) {
                            material.color = new THREE.Color(0xffffff);
                            material.opacity = 1;
                        } else {
                            material.color = new THREE.Color(0xe0e0e0);
                            material.opacity = 1;
                        }
                    }
                    return sprite;
                }}
                enableNavigationControls={true}
                backgroundColor="#010101"
                linkColor={(link) => link === interimLink ? 'rgb(246, 147, 177)' : 'rgba(255,255,255,1)'}
                linkWidth={(link) => link === interimLink ? 4 : 2}
                nodeId="id"
                nodeLabel={label_key}
                linkDirectionalParticleWidth={1}
                d3VelocityDecay={0.4}
                onNodeClick={handleClick}
                onNodeRightClick={handleRightClick}
                onLinkRightClick={handleLinkRightClick}
                onNodeDrag={handleNodeDrag}
                onNodeHover={handleHover}
                d3AlphaDecay={0.2}
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
